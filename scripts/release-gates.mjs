import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const accepted = record => record?.state === 'passed' && Array.isArray(record.errors) && record.errors.length === 0;
const current = (record, versions) => record?.versions?.browser === versions.browser && record?.versions?.workbench === versions.workbench;
const surfacePolicies = ['webgl-debug-restriction','offline-audio-seed','local-font-discovery'];
const qualifiedSurfaces = record => surfacePolicies.every(policy => record?.surfacePolicies?.includes(policy));
const native = record => accepted(record) && record.nativeProof === true && record.implementation === 'native-chromium-patches' && sha(record.executableSha256) && qualifiedSurfaces(record) && ['baseline','seed-a','seed-a-restart','seed-b','invalid-fallback','surface-policy-a','surface-policy-a-restart','surface-policy-b','surface-policy-invalid'].every(name => record.cases?.some(value => value.name === name));

/** Conservative aggregate acceptance; a build, upstream/CDP test or old release cannot satisfy a native/installed gate. */
export function evaluateReleaseGates(input) {
  const gates = [], versions = input.versions;
  if (!versions?.browser || !versions?.workbench) throw Error('Expected Browser and Workbench versions are required');
  const add = (id, passed, detail) => gates.push({ id, state: passed ? 'passed' : 'pending', detail });
  const states = ['verified', 'source_tested', 'in_progress', 'planned'], counts = Object.fromEntries(states.map(state => [state, 0]));
  const checks = input.status?.groups?.flatMap(group => group.checks) ?? [], ids = new Set();
  for (const check of checks) {
    if (!check?.id || ids.has(check.id) || !states.includes(check.state)) throw Error('Invalid or duplicate roadmap check');
    ids.add(check.id); counts[check.state]++;
  }
  add('implemented-roadmap', checks.length > 0 && checks.every(check => check.state === 'verified'), `${counts.verified}/${checks.length} named checks desktop verified; source-tested, in-progress and planned checks remain pending`);
  add('source-suite', input.source?.passed > 0 && input.source?.failed === 0 && input.source?.suites === 2, 'Both Browser and Workbench source suites must finish without failures');
  add('packaged-windows-pair', accepted(input.packaged) && current(input.packaged, versions), 'Packaged native desktop pair must match the requested release');
  add('actual-installed-pair', accepted(input.installed) && current(input.installed, versions) && input.installed.actualInstalledProof === true, 'Actual per-user Browser–Workbench API qualification must match the requested release; owned packaged fixtures cannot satisfy it');
  add('actual-installed-proxies', accepted(input.proxies) && current(input.proxies, versions) && input.proxies.actualInstalledProof === true && Number.isSafeInteger(input.proxies.proxyRequests) && input.proxies.proxyRequests > 0 && input.proxies.run?.state === 'saved' && sha(input.proxies.run?.sha256) && Number.isSafeInteger(input.proxies.run?.archiveBytes) && input.proxies.run.archiveBytes > 0, 'The installed pair must route real bundled Chromium through an owned authenticated proxy, save a verified archive and preserve the original profiles and connections');
  add('actual-installed-ui', input.ui?.state === 'passed' && current(input.ui, versions) && input.ui?.actualInstalledProof === true && input.ui?.originalMothIconVisible === true && input.ui?.nativeEmbeddedWorkbench === true, 'Direct native desktop UI review of the actual installation must match the requested release');
  add('actual-installed-python', input.python?.state === 'passed' && input.python?.version === versions.workbench && input.python?.calendarDSTPreview === true && input.python?.futureScheduleCreatedPausedRemoved === true, 'Python calendar and schedule lifecycle must pass against this installed Workbench');
  add('production-dependencies', accepted(input.audit) && current(input.audit, versions) && input.audit?.metadata?.vulnerabilities?.total === 0, 'A completed production dependency audit must match this exact pair and contain zero recorded vulnerabilities');
  const revision = input.kernel?.revision, executableSha256 = input.build?.executableSha256;
  const build = !!revision && input.build?.revision === revision && input.build?.customKernelCompiled === true && input.build?.status === 'compiled-awaiting-native-qualification' && sha(executableSha256) && input.currentExecutableSha256 === executableSha256;
  add('native-compilation', build, 'Pinned custom executable must exist and still match its compiled SHA-256');
  add('native-unit-tests', build && input.units?.revision === revision && input.units?.status === 'native-unit-tests-passed' && input.units?.nativeTestExecutions === 26 && input.unitXmlVerified === true, 'All 26 native unit executions must have matching zero-failure XML results');
  add('direct-native-proof', build && native(input.direct) && input.direct.executableSha256 === executableSha256, 'Direct scalar/canvas and WebGL/audio/font fixtures, including restart, independent seeds and malformed-input fallback, must qualify this custom binary');
  add('copied-native-runtime', build && input.copied?.revision === revision && input.copied?.executableSha256 === executableSha256 && input.copied?.nativeUnitExecutions === 26 && native(input.copied?.qualification) && input.copied.qualification.executableSha256 === executableSha256 && input.runtimeFilesVerified === true, 'Copied custom runtime and all component/resource hashes must pass independent qualification');
  const retention = input.integration?.retentionVerification;
  const retained = input.integration?.installedKernelRetained === true && retention?.backupVerified === true && retention?.idlePreflightPassed === true && retention?.runtimeFilesVerified === true && retention?.executableSha256 === executableSha256;
  add('installed-native-integration', build && accepted(input.integration) && current(input.integration, versions) && qualifiedSurfaces(input.integration) && input.integration.actualInstalledProof === true && input.integration.nativeProof === true && (input.integration.installedKernelChanged === true || retained) && input.integration.executableSha256 === executableSha256 && input.integration.run?.state === 'saved', 'Guarded activation or verified retention and a saved Browser-owned Workbench run must use this installed pair and the exact custom kernel with all three qualified surface policies');
  add('linux-native-runtime', accepted(input.linux) && current(input.linux, versions) && input.linux.platform === 'linux' && input.linux.installerExecuted === true && input.linux.sandboxVerified === true && input.linux.nativeKernelQualified === true && input.linux.visualReviewPassed === true, 'Real Linux install, launch, sandbox, custom-kernel qualification and installed UI review are required; package structure/source CI do not satisfy this gate');
  const publications = ['browser', 'workbench'].map(product => input.publication?.[product]);
  add('public-source-ci', current(input.publication, versions) && publications.every(record => !!record?.main && record.workflow?.sha === record.main && record.workflow?.status === 'completed' && record.workflow?.conclusion === 'success'), 'Both public main branches must contain this release and have passing CI at their current recorded commits');
  const complete = gates.every(gate => gate.state === 'passed');
  return { schemaVersion: 1, author: 'true-utopian', at: new Date().toISOString(), versions, state: complete ? 'complete' : 'incomplete', productComplete: complete, counts, gates, limitation: 'This records named release acceptance only; it makes no claim of perfect detection avoidance or complete vendor parity.' };
}

async function hash(file) { const value = createHash('sha256'); for await (const bytes of createReadStream(file)) value.update(bytes); return value.digest('hex'); }
export async function collectReleaseEvidence(root, { copiedRuntimeManifest } = {}) {
  const json = async path => { try { return JSON.parse((await readFile(join(root, path), 'utf8')).replace(/^\uFEFF/,'')); } catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return undefined; throw error; } };
  const browser = await json('packages/vesper-browser/package.json'), workbench = await json('package.json');
  const input = { versions: { browser: browser?.version, workbench: workbench?.version } };
  for (const [key, path] of Object.entries({ status: 'docs/status.json', packaged: 'test-results/desktop-followup/packaged-pair.json', installed: 'test-results/native-engine/installed-pair-qualification.json', proxies: 'test-results/proxy-inventory/installed-pair.json', ui: 'test-results/desktop-followup/actual-ui.json', python: 'test-results/desktop-followup/installed-python.json', audit: 'test-results/desktop-followup/production-audit.json', kernel: 'native/chromium/kernel.json', build: '.workbench/kernel-toolchain/build-result.json', units: '.workbench/kernel-toolchain/test-result.json', direct: 'test-results/native-kernel/qualification.json', integration: 'test-results/native-kernel/installed-native-integration.json', linux: 'test-results/desktop/linux-runtime-qualification.json', publication: '.workbench/publication-current.json' })) input[key] = await json(path);
  try {
    const log = await readFile(join(root, 'test-results/desktop-followup/check.log'), 'utf8');
    const passes = [...log.matchAll(/^ℹ pass (\d+)\r?$/gm)].map(match => Number(match[1])), failures = [...log.matchAll(/^ℹ fail (\d+)\r?$/gm)].map(match => Number(match[1]));
    input.source = { suites: passes.length === failures.length ? passes.length : 0, passed: passes.reduce((a,b) => a+b,0), failed: failures.reduce((a,b) => a+b,0) };
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (input.build?.customKernelCompiled === true) {
    try { input.currentExecutableSha256 = await hash(input.build.executable); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    input.unitXmlVerified = Number.isFinite(Date.parse(input.units?.at));
    for (const [name, count] of [['upstream-memory-regression',1],['scalars-default',8],['scalars-policy',8],['canvas',9]]) {
      try {
        const xmlPath = join(root, `.workbench/kernel-toolchain/${name}.xml`), xml = await readFile(xmlPath, 'utf8'), rootTag = /<testsuites\s[^>]*>/.exec(xml)?.[0];
        if ((await stat(xmlPath)).mtimeMs < Date.parse(input.units.at) - 1000) input.unitXmlVerified = false;
        const attribute = name => new RegExp(`\\b${name}="(\\d+)"`).exec(rootTag ?? '')?.[1];
        if (Number(attribute('tests')) !== count || attribute('failures') !== '0' || (attribute('errors') !== undefined && attribute('errors') !== '0') || (attribute('disabled') !== undefined && attribute('disabled') !== '0') || /<failure\b|<error\b|<skipped\b/.test(xml)) input.unitXmlVerified = false;
      } catch (error) { if (error.code !== 'ENOENT') throw error; input.unitXmlVerified = false; }
    }
    try {
      const manifestPath = copiedRuntimeManifest ? resolve(copiedRuntimeManifest) : join(JSON.parse((await readFile(join(root, '.workbench/kernel-toolchain/native-runtime-package.log'), 'utf8')).replace(/^\uFEFF/,'')).output, 'vesper-kernel.json');
      input.copied = JSON.parse(await readFile(manifestPath, 'utf8'));
      const { verifyNativeRuntime } = await import(pathToFileURL(join(root, 'packages/vesper-browser/dist/native-kernel.js')).href);
      await verifyNativeRuntime(join(resolve(manifestPath, '..'), input.copied.executable), input.copied.runtimeFiles);
      input.runtimeFilesVerified = true;
    } catch (error) { input.runtimeFilesVerified = false; input.copied = undefined; }
  }
  return input;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2); let copiedRuntimeManifest;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--require-complete') continue;
    if (args[i] === '--copied-runtime' && args[i + 1] && !args[i + 1].startsWith('--') && !copiedRuntimeManifest) copiedRuntimeManifest = args[++i];
    else throw Error('Usage: node scripts/release-gates.mjs [--require-complete] [--copied-runtime <vesper-kernel.json>]');
  }
  const root = resolve(import.meta.dirname, '..'), report = evaluateReleaseGates(await collectReleaseEvidence(root, { copiedRuntimeManifest }));
  await mkdir(join(root, 'test-results/release'), { recursive: true });
  await writeFile(join(root, 'test-results/release/gates.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (process.argv.includes('--require-complete') && !report.productComplete) process.exitCode = 1;
}
