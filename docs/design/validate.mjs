#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const load = async name => JSON.parse(await readFile(path.join(directory, name), 'utf8'));
const reserved = new Set(['unknown', 'blank', 'ambiguous', 'settling', 'unsupported', 'invalidated']);
const [stateSchema, flowSchema] = await Promise.all([load('schemas/state-registry.schema.json'), load('schemas/flow-pack.schema.json')]);
const ajv = new Ajv2020({ strict: true, allErrors: true });
ajv.addSchema(stateSchema);
const structural = ajv.compile(flowSchema);
const equalSets = (a, b) => a.length === b.length && a.every(item => b.includes(item));
const intersection = (a, b) => new Set([...a].filter(item => b.has(item)));
const setEquals = (a, b) => a.size === b.size && [...a].every(item => b.has(item));

/** Proposal linter only. It never opens a browser, calls a resolver or contacts an origin. */
export function validatePack(pack, manifest) {
  const errors = [];
  const error = message => errors.push(message);
  if (!structural(pack)) return { valid: false, errors: structural.errors.map(item => `${item.instancePath || '/'} ${item.message}`) };
  if (!manifest || typeof manifest !== 'object') return { valid: false, errors: ['A separate trusted deployment manifest is required.'] };
  const registry = pack.registry;
  const states = registry.states;
  const targets = registry.targets;
  const steps = pack.steps;
  const hasState = id => Object.hasOwn(states, id);
  const hasStep = id => Object.hasOwn(steps, id);
  const hasTarget = id => Object.hasOwn(targets, id);
  const requireState = (id, where, allowUnknown = false) => { if (!(hasState(id) || allowUnknown && id === 'unknown')) error(`${where}: unknown state ${id}`); };
  const requireStep = (id, where) => { if (!hasStep(id)) error(`${where}: unknown step ${id}`); };
  const requireTarget = (id, where, unique = false) => {
    if (!hasTarget(id)) error(`${where}: unknown target ${id}`);
    else if (unique && targets[id].cardinality !== 'one') error(`${where}: action/container target must have cardinality one`);
  };
  const requireOrigin = (id, where) => { if (!registry.originRefs.includes(id)) error(`${where}: undeclared origin alias ${id}`); };
  const pathCheck = (originRef, pathname, where) => {
    requireOrigin(originRef, where);
    const origin = manifest.origins?.[originRef];
    if (!origin) return;
    try { const url = new URL(pathname, origin); if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.username || url.password || url.search || url.hash || url.pathname !== pathname) error(`${where}: path must preserve the bound origin and have no query/fragment`); }
    catch { error(`${where}: invalid bound path`); }
  };
  const predicateCheck = (predicate, where) => {
    if (predicate.target) requireTarget(predicate.target, where);
    if (predicate.originRef) pathCheck(predicate.originRef, predicate.pathname, where);
  };

  for (const alias of registry.originRefs) {
    try {
      const value = manifest.origins?.[alias]; const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value || url.username || url.password) error(`manifest.origins.${alias}: expected an exact HTTP(S) origin`);
    } catch { error(`manifest.origins.${alias}: missing/invalid origin`); }
  }
  if (!manifest.profilePolicyIds?.includes(pack.execution.profilePolicyId)) error('execution.profilePolicyId: policy is not installed');
  if (!manifest.proxyPolicyIds?.includes(pack.execution.proxyPolicyId)) error('execution.proxyPolicyId: policy is not installed');
  if (manifest.identityPolicy === 'required' && pack.identityPolicy !== 'required') error('identityPolicy: the trusted manifest requires authenticated identity');
  pathCheck(pack.start.originRef, pack.start.pathname, 'start');
  if (registry.policy.maxObservationAgeMs < registry.policy.stableForMs) error('policy: maximum observation age is below required stable duration');
  if (registry.policy.unknownTimeoutMs < registry.policy.blankGraceMs) error('policy: unknown deadline must cover the blank grace');
  for (const [id, state] of Object.entries(states)) {
    if (reserved.has(id)) error(`states.${id}: reserved runtime state cannot be overridden`);
    for (const parent of state.refines || []) requireState(parent, `states.${id}.refines`);
    state.require.forEach(p => predicateCheck(p, `states.${id}.require`));
    state.forbid.forEach(p => predicateCheck(p, `states.${id}.forbid`));
    const evidenceIds = new Set();
    for (const support of state.support) { if (evidenceIds.has(support.id)) error(`states.${id}: duplicate evidence ID ${support.id}`); evidenceIds.add(support.id); predicateCheck(support.predicate, `states.${id}.support`); }
  }
  const visited = new Set(); const visiting = new Set();
  function refinement(id) {
    if (visiting.has(id)) { error(`states.${id}: refinement cycle`); return; }
    if (visited.has(id) || !hasState(id)) return;
    visiting.add(id); for (const parent of states[id].refines || []) refinement(parent); visiting.delete(id); visited.add(id);
  }
  Object.keys(states).forEach(refinement);

  function inspectInputSchema(value, trail = 'inputSchema') {
    if (!value || typeof value !== 'object') return;
    if (value.$ref && !value.$ref.startsWith('#')) error(`${trail}: only local schema references are accepted`);
    if (value.writeOnly && Object.hasOwn(value, 'default')) error(`${trail}: secret defaults are forbidden`);
    for (const [key, child] of Object.entries(value)) inspectInputSchema(child, `${trail}.${key}`);
  }
  if (pack.inputSchema.type !== 'object') error('inputSchema: inputs must be an object schema');
  inspectInputSchema(pack.inputSchema);
  try { new Ajv2020({ strict: true }).compile(pack.inputSchema); } catch { error('inputSchema: not a valid supported local Draft 2020-12 schema'); }

  const matchers = new Map();
  for (const [id, source] of Object.entries(pack.choices)) {
    source.states.forEach(state => { requireState(state, `choices.${id}.states`); if (hasState(state) && !states[state].actionable) error(`choices.${id}: source state must be actionable`); });
    requireTarget(source.container, `choices.${id}.container`, true);
    requireStep(source.onStale, `choices.${id}.onStale`); requireStep(source.onAllUnavailable, `choices.${id}.onAllUnavailable`);
    if (hasStep(source.onStale) && !(steps[source.onStale].kind === 'input' && steps[source.onStale].input.kind === 'choice' && steps[source.onStale].input.choiceSource === id)) error(`choices.${id}: onStale must create a new challenge for this source`);
    if (hasStep(source.onAllUnavailable) && steps[source.onAllUnavailable].kind !== 'review') error(`choices.${id}: all-unavailable branch must request review`);
    const ruleIds = new Set(); const exactKeys = [];
    const compiled = [];
    for (const pattern of source.patterns) {
      if (ruleIds.has(pattern.id)) error(`choices.${id}: duplicate pattern ID`); ruleIds.add(pattern.id);
      if (pattern.match.keyEquals !== undefined) { exactKeys.push(pattern.match.keyEquals); compiled.push(key => key === pattern.match.keyEquals); }
      else {
        const expression = pattern.match.keyPattern;
        // Deliberately restricted: literals plus at most one repeated simple character class.
        if (!/^\^[a-zA-Z0-9_-]*(?:\[(?:a-z|A-Z|0-9|-)+\][+*])?[a-zA-Z0-9_-]*\$$/.test(expression)) { error(`choices.${id}: keyPattern is outside the bounded pattern grammar`); compiled.push(() => false); }
        else { const re = new RegExp(expression); compiled.push(key => key.length <= 100 && re.test(key)); }
      }
    }
    for (const key of exactKeys) if (compiled.filter(match => match(key)).length > 1) error(`choices.${id}: overlapping rules for a declared exact key`);
    matchers.set(id, compiled);
  }

  const edges = [];
  const seeds = new Set();
  function edge(from, to, kind, state) { requireStep(to, `${from}.${kind}`); if (hasStep(to)) edges.push({ from, to, kind, state }); }
  function routesCheck(from, routes, kind, allowedStates) {
    for (const [state, to] of Object.entries(routes || {})) {
      requireState(state, `${from}.${kind}`, kind === 'recovery');
      if (allowedStates && !allowedStates.includes(state)) error(`${from}.${kind}: route state is outside the declared postcondition`);
      edge(from, to, kind, state);
      if (hasStep(to) && !steps[to].requires.includes(state)) error(`${from}.${kind}: destination ${to} does not accept ${state}`);
    }
  }
  for (const [state, to] of Object.entries(pack.entryByState)) {
    requireState(state, 'entryByState'); requireStep(to, 'entryByState'); seeds.add(to);
    if (hasState(state) && !states[state].actionable) error('entryByState: automatic entry requires an actionable state');
    if (hasStep(to) && !steps[to].requires.includes(state)) error(`entryByState: ${to} does not accept ${state}`);
  }
  requireStep(pack.onUnexpectedStep, 'onUnexpectedStep'); seeds.add(pack.onUnexpectedStep);
  if (hasStep(pack.onUnexpectedStep) && steps[pack.onUnexpectedStep].kind !== 'review') error('onUnexpectedStep must request review');
  for (const [id, step] of Object.entries(steps)) {
    for (const state of step.requires) {
      requireState(state, `steps.${id}.requires`, step.kind === 'review');
      if (step.kind !== 'review' && hasState(state) && !states[state].actionable) error(`steps.${id}: non-review step requires a non-actionable state`);
    }
    routesCheck(id, step.recoveryByState, 'recovery');
    if (step.kind === 'review') continue;
    if (step.kind !== 'complete') {
      for (const branch of ['onError', 'onTimeout', 'onUncertain']) {
        edge(id, step[branch], branch);
        if (hasStep(step[branch]) && steps[step[branch]].kind !== 'review') error(`steps.${id}.${branch}: failure/uncertainty branches must review, not dispatch more input`);
      }
    }
    if (step.kind === 'input') {
      if (!equalSets(Object.keys(step.next), step.requires)) error(`steps.${id}: input next routes must cover exactly its required states`);
      routesCheck(id, step.next, 'success', step.requires);
      if (step.input.kind === 'text' && step.input.minLength > step.input.maxLength) error(`steps.${id}: input minimum length exceeds maximum`);
      if (step.input.kind === 'choice') choiceReference(step.input.choiceSource, id, step.requires);
    }
    if (step.kind === 'action') {
      const op = step.do;
      if (op.target) requireTarget(op.target, `steps.${id}.do.target`, true);
      if (op.originRef) pathCheck(op.originRef, op.pathname, `steps.${id}.do`);
      step.postcondition.states.forEach(state => requireState(state, `steps.${id}.postcondition`));
      step.postcondition.require.forEach(p => predicateCheck(p, `steps.${id}.postcondition.require`));
      if (!equalSets(Object.keys(step.next), step.postcondition.states)) error(`steps.${id}: next routes must cover exactly the postcondition states`);
      routesCheck(id, step.next, 'success', step.postcondition.states);
      if (op.op === 'chooseOption') choiceReference(op.choiceSource, id, step.requires);
      if (op.op === 'bindIdentity' && !manifest.identityResolvers?.includes(op.resolver)) error(`steps.${id}: identity receipt resolver is not installed`);
      if (step.retry.mode === 'safe-repeat') {
        const permitted = op.op === 'wait' || op.op === 'fill' && manifest.safeRepeatTargets?.includes(op.target) || op.op === 'navigate' && manifest.safeNavigationPaths?.includes(`${op.originRef}:${op.pathname}`);
        if (!permitted) error(`steps.${id}: operation is not approved for safe-repeat`);
      }
      if (step.retry.mode === 'reconcile' && !manifest.reconciliationResolvers?.includes(step.retry.resolver)) error(`steps.${id}: reconciliation resolver is not installed`);
    }
  }
  function choiceReference(sourceId, stepId, acceptedStates) {
    const source = pack.choices[sourceId];
    if (!source) { error(`steps.${stepId}: unknown choice source`); return; }
    if (!acceptedStates.every(state => source.states.includes(state))) error(`steps.${stepId}: choice source does not allow every required state`);
    edge(stepId, source.onStale, 'choice-stale'); edge(stepId, source.onAllUnavailable, 'choice-unavailable');
    for (const destination of [source.onStale, source.onAllUnavailable]) if (hasStep(destination) && !source.states.every(state => steps[destination].requires.includes(state))) error(`choices.${sourceId}: destination does not accept every source state`);
  }

  const reached = new Set([...seeds].filter(hasStep)); const pending = [...reached];
  while (pending.length) {
    const from = pending.pop();
    for (const edge of edges.filter(edge => edge.from === from)) if (!reached.has(edge.to)) { reached.add(edge.to); pending.push(edge.to); }
  }
  for (const id of Object.keys(steps)) if (!reached.has(id)) error(`steps.${id}: unreachable`);
  if (![...reached].some(id => steps[id].kind === 'complete')) error('No reachable complete step');

  // Definite assignment: success produces answers/captures/receipts; review/recovery
  // starts with no ephemeral derived values. A complete node needs a prior binding.
  const inputKeys = (pack.inputSchema.required || []).filter(key => Object.hasOwn(pack.inputSchema.properties || {}, key));
  const base = new Set(inputKeys.map(key => `input:${key}`));
  const universe = new Set(base);
  function output(step) {
    if (step.kind === 'input') return `answer:${step.answerKey}`;
    if (step.kind === 'action' && step.do.op === 'scrape') return `capture:${step.do.outputKey}`;
    if (step.kind === 'action' && step.do.op === 'bindIdentity') return `receipt:${step.do.receiptKey}`;
    return null;
  }
  for (const step of Object.values(steps)) if (output(step)) universe.add(output(step));
  const available = new Map(Object.keys(steps).map(id => [id, new Set(universe)]));
  function transfer(edge) {
    const source = steps[edge.from];
    if (edge.kind !== 'success' || source.kind === 'review') return new Set(base);
    const values = new Set(available.get(edge.from));
    const produced = output(source); if (produced) values.add(produced);
    if (source.kind === 'action') {
      if (source.do.value?.source === 'answer') values.delete(`answer:${source.do.value.key}`);
      if (source.do.op === 'chooseOption') values.delete(`answer:${source.do.answerKey}`);
      if (source.do.op === 'navigate') for (const key of values) if (key.startsWith('receipt:')) values.delete(key);
    }
    return values;
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of reached) {
      const inbound = edges.filter(edge => edge.to === id).map(transfer);
      if (seeds.has(id)) inbound.push(new Set(base));
      const next = inbound.length ? inbound.reduce(intersection) : new Set(base);
      if (!setEquals(next, available.get(id))) { available.set(id, next); changed = true; }
    }
  }
  for (const [id, step] of Object.entries(steps)) {
    const requireValue = value => { if (value?.source !== 'literal' && value?.source && !available.get(id).has(`${value.source}:${value.key}`)) error(`steps.${id}: ${value.source}:${value.key} is not assigned on every incoming route`); };
    if (step.kind === 'action') { requireValue(step.do.value); requireValue(step.do.expected); if (step.do.op === 'chooseOption') requireValue({ source: 'answer', key: step.do.answerKey }); }
    if (step.kind === 'complete' && (pack.identityPolicy === 'required' || step.identityReceipt) && !available.get(id).has(`receipt:${step.identityReceipt}`)) error(`steps.${id}: identity receipt is not assigned on every incoming route`);
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

async function main() {
  const pack = process.argv[2] ? JSON.parse(await readFile(path.resolve(process.argv[2]), 'utf8')) : await load('examples/owned-site.flow.json');
  const manifest = process.argv[3] ? JSON.parse(await readFile(path.resolve(process.argv[3]), 'utf8')) : await load('examples/owned-site.manifest.json');
  const result = validatePack(pack, manifest);
  if (!result.valid) { console.error(JSON.stringify(result, null, 2)); process.exitCode = 1; return; }
  const negativeCases = [
    ['reserved-state', candidate => { candidate.registry.states.unknown = structuredClone(candidate.registry.states['app-shell']); }],
    ['refinement-cycle', candidate => { candidate.registry.states['app-shell'].refines = ['signin']; }],
    ['unknown-target', candidate => { candidate.steps['fill-username'].do.target = 'missing'; }],
    ['unsafe-submit-retry', candidate => { candidate.steps['submit-signin'].retry = { mode: 'safe-repeat', maxAttempts: 2, backoffMs: 100, justification: 'Not sufficient permission.' }; }],
    ['missing-error-route', candidate => { candidate.steps['submit-signin'].onError = 'missing'; }],
    ['missing-choice-branch', candidate => { candidate.choices['verification-methods'].onAllUnavailable = 'missing'; }],
    ['missing-receipt', candidate => { candidate.steps.finish.identityReceipt = 'unbound'; }],
    ['identity-policy-downgrade', candidate => { candidate.identityPolicy = 'anonymous'; delete candidate.steps.finish.identityReceipt; }],
    ['missing-policy', candidate => { candidate.execution.proxyPolicyId = 'not-installed'; }],
    ['unsafe-pattern', candidate => { candidate.choices['verification-methods'].patterns[2].match = { keyPattern: '^(a+)+$' }; }],
    ['wildcard-pattern', candidate => { candidate.choices['verification-methods'].patterns[2].match = { keyPattern: '^sms-.$' }; }],
    ['origin-escape', candidate => { candidate.start.pathname = '//other.test/signin'; }]
  ];
  // Negative checks use the bundled fixture so a caller-supplied pack needs no fixture keys.
  const fixture = await load('examples/owned-site.flow.json'); const fixtureManifest = await load('examples/owned-site.manifest.json');
  const outcomes = negativeCases.map(([name, mutate]) => { const candidate = structuredClone(fixture); mutate(candidate); return { name, rejected: !validatePack(candidate, fixtureManifest).valid }; });
  console.log(JSON.stringify({ valid: true, negativeChecks: outcomes }, null, 2));
  if (outcomes.some(outcome => !outcome.rejected)) process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
