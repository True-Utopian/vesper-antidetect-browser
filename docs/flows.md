# Declarative flows

Managed mode loads `*.flow.json` files and the matching `*.manifest.json` files from `FLOWS_DIR`. Enable it with `DATABASE_URL`; the deployment then lists flow packs instead of raw automation modules. Raw scripts remain available in a deployment with `DATABASE_URL` unset.

The maintained format definitions are [state-registry.schema.json](../schemas/state-registry.schema.json) and [flow-pack.schema.json](../schemas/flow-pack.schema.json). The [owned-site pack](design/examples/owned-site.flow.json) and [manifest](design/examples/owned-site.manifest.json) show every step needed for sign-in, method selection, code entry and authenticated completion. A deployment manifest binds origin aliases and installed profile, proxy, identity and reconciliation policies. It must come from the operator, not an untrusted pack author.

## Compile before opening a browser

```ts
import { compileFlow, createPuppeteerFlowDriver, runFlow } from '../src/flows/index.js';

const compiled = compileFlow(pack, manifest);
const driver = createPuppeteerFlowDriver(page, compiled, {
  seed: runId,
  preset: 'natural-fast',
  signal,
  checkpoint,
});
try {
  const result = await runFlow(compiled, {
    runId, inputs, driver, journal, requestInput, signal, checkpoint,
    identityResolvers,
  });
  // The runtime handles a completed export or an explicit profile handoff.
  if (result.status === 'completed') console.log(result.mode);
} finally {
  driver.dispose?.();
}
```

`compileFlow` performs strict Draft 2020-12 validation and semantic checks for named references, refinement cycles, reachable branches, allowed origins, installed policies, retry permissions and definitely assigned values. It rejects remote schema references, oversized packs, unsupported screenshots and missing error routes. The compiled object contains frozen pack/manifest data, a SHA-256 hash, the input validator and the deduplicated predicate inventory. Runtime and build output both read the maintained files in the repository's `schemas/` directory; ship that directory with `dist/`.

## State recognition

`createPageObserver(page, compiled)` reads the chosen main frame in one bounded browser evaluation. It returns predicate outcomes, approved origin/path, document epoch, sample timing and a digest of relevant evidence. Raw text and field values used to evaluate predicates stay inside the page. Only explicit scrape actions return values to the interpreter, where they remain ephemeral.

`classify(registry, observation, history)` evaluates inherited hard requirements and exclusions before scoring optional support. Unknown evidence never satisfies an exclusion. A qualified descendant suppresses its declared ancestors; incomparable matches abstain. An empty support list scores 1 only after every hard guard passes. The score describes configured evidence, not a calibrated probability. Its evidence log includes every state's local guard outcomes, inherited-state IDs, qualification, support score and suppressing descendants. Local arrays stay bounded by schema limits; inherited guards are visible in their own state records.

Two stable fresh samples are required by the example pack. Blank, incomplete, stale, unsupported and ambiguous observations have no actionable current state. Blank grace permits waiting; it never permits acting on the last known page. The interpreter polls within pack deadlines and observes before and after actions. Popup flows, iframes, closed shadow DOM and canvas-only interfaces need a separate adapter; v1 does not infer their state from a screenshot.

## Steps and values

The finite step kinds are `action`, `input`, `branch`, `repeat`, `review` and `complete`. Actions are `fill`, `click`, `navigate`, `wait`, `scrape`, `chooseOption` and `bindIdentity`. Values are typed references to an input, answer or capture, or a fixed literal. There is no JavaScript evaluation, selector interpolation or URL interpolation.

Every action declares allowed current states, a postcondition, state-to-step branches and error/timeout/uncertainty routes. The executor checks current evidence at the input boundary after pacing. Fill also compares the final field value exactly in memory; a page-state match alone cannot prove the right text was entered. Step, attempt, input, visit, reconciliation and total-time budgets bound execution.

An input challenge is bound to its document and state. Choice challenges expose opaque option IDs and reviewed plain-text labels. The driver discovers stable keys, applies the source's pattern/type rules, and checks visibility, enabled state and attribute-based availability. It repeats those checks before selection. Changed labels, duplicate keys, expired challenges or unavailable options cannot silently select a substitute. The initial dialect sends all-options-unavailable to review.

`scrape` reads one bounded text or attribute value into memory. It fails on duplicate targets, missing values or overlength results. `bindIdentity` calls an installed read-only resolver, which must verify an authoritative authenticated session and compare its principal with the expected value. A DOM label is not sufficient evidence.

Packs with `identityPolicy: "required"` need a valid receipt at every completion. Anonymous packs may omit the receipt when the trusted manifest permits it. A pack cannot weaken a manifest requiring identity. Receipt validity is checked again at completion and revoked when its document epoch changes.

## Visual page branches and counted bodies

These controls are implemented in the unreleased Browser **0.4.14** / Workbench **0.5.19** source candidate. The accepted installed pair remains **0.4.13 / 0.5.18** until matching packaged and actual installed qualification passes. The public feature inventory remains unchanged meanwhile.

Open **Flow editor**, create or select a draft, then choose **Branch by page**. Its **Required states** are recognized actionable pages. **Add page route** adds another page and its destination; each accepted page needs a compatible destination. Branching observes fresh page evidence and selects a route without dispatching an action. Unknown, stale or ambiguous evidence does not choose a convenient branch; the existing review policy applies.

Choose **Repeat steps**, set **Times to repeat**, and choose **First step in body**. **Edit body** opens the body's action form. The last successful body route returns to the repeat controller. **After repeating** selects the next destination after the count is exhausted. The compiler rejects a body that completes before returning, a missing return route, or an exit that immediately re-enters that same body/controller. Error, timeout and uncertainty routes still lead to review.

Repeat counts are integers from 1 to 99. **Flow settings** must allow at least `count + 1` visits to the controller: the extra visit takes the final exit. Nested repeats also consume the shared step, visit and time budgets; raising one count does not raise those limits automatically. Bodies may contain actions, branches, inputs or nested repeats. There are no arbitrary expressions or unbounded while loops.

**Arrange flow** follows entry routes to place steps, while dragging changes their saved positions. Layout never changes execution order. **Show recovery routes** reveals the additional review/recovery edges. **Undo** and **Redo** restore draft edits and layout. **Save draft** validates the complete definition; **Publish flow** publishes only that saved revision. Existing admitted runs retain their original definition.

Saving changed execution content automatically advances its patch version. Unchanged and layout-only saves retain the version and hash. The library keeps a version floor across restart and Undo, so a later edit cannot reuse an already changed draft version. An explicitly supplied higher version is preserved. **Flow settings** shows the saved version; API clients should use the returned pack, hash and optimistic revision together. This keeps republished edits admissible without changing the coordinator's immutable-version safeguard or an older run's pinned definition.

A `branch` uses `requires` and `next` like an input route. A `repeat` additionally declares `count` and `body`; its `next` routes are its exits. Both retain the common `onError`, `onTimeout`, `onUncertain` and `recoveryByState` fields. The maintained schema and compiler enforce compatible recognized states at every route.

## Durable journal and restart

The interpreter accepts this storage interface:

```ts
interface FlowJournal {
  load(runId: string): Promise<FlowSnapshot | null>;
  save(snapshot: FlowSnapshot): Promise<void>;
}
```

`save` must atomically persist before it resolves. The coordinator must enforce a single fenced writer. Managed mode stores snapshots in PostgreSQL using revision checks. A snapshot contains the pinned pack hash, step and attempt counters, status, timestamps and any unresolved action intent. It contains no input values, challenge answers, scraped values or identity receipts.

The interpreter saves intent before an action and a dispatched marker before browser input. It records the observed outcome only after primitive checks and fresh postconditions pass. Failed storage stops execution. A timeout after dispatch leaves an uncertain action; it is not permission to click again. Controlled packs persist admitted repeat counts and the next body step before dispatch. A completed inner counter resets for the next outer iteration. Confirmed successful actions receive a fresh attempt budget on the next iteration; pending or uncertain mutations retain their fence. Counts cannot establish exactly-once effects on an external website.

`safe-repeat` is restricted to manifest-approved operations. `reconcile` requires an installed read-only resolver returning `applied`, `not-applied` or `unknown`. Unknown outcomes remain unresolved. Operator Continue cannot clear an unresolved mutation. Export recovery never replays website actions.

Set `resume: true` only after the coordinator has reconciled profile ownership and browser lifecycle. The interpreter checks the journal's pack hash, reconciles pending work, reclassifies the page and uses an explicit entry/recovery route. Inputs must be supplied again by the host runtime; derived values are reacquired. Expired total-time budgets are not reset by restart. A completed flow result is separate from a verified profile export.

For a pack containing branch/repeat controls, trusted resume retains the durably saved next step when that step accepts the freshly recognized page. A mismatch goes to review rather than rewinding a loop to its entry. Reconciliation of a pending mutation still needs its existing authoritative resolver; a counter never clears that requirement. Older packs retain their prior entry/recovery behavior.

## Host callbacks

`requestInput(title, fields, signal?)` returns a schema-validated answer. It must cancel and clear the outstanding challenge when its signal aborts. The managed runtime implements this against the existing challenge API. `checkpoint()` applies pause, cancellation and lease checks before further browser work.

Identity resolvers provide `bind(expected, {runId, signal})` and `verify(receipt, {runId, signal})`. They receive values in memory and return opaque receipts. Reconciliation resolvers receive the durable pending-action identifier; they must inspect an application receipt or ledger without resending the action. Pack resolver names are checked against the manifest and resolved from trusted server policy code.

`onEvent` receives allowlisted fields such as event type, run/step/action IDs, observed state, reason code and evidence score. Keep credentials, matched text, full URLs, cookies and network bodies out of these events. Automatic screenshots are disabled; live viewing and manual snapshots remain separate administrator features.

`afterAction(snapshot, operation)` runs after a successful `action-observed` checkpoint is durable, before the next step. Return `handoff` to yield with `{status: "handoff", snapshot}`; the checkpoint remains running with its next step recorded. The host can stop the candidate profile, transfer ownership and reattach a warm profile before calling the interpreter again. This callback runs outside action retry handling. Successful read-only scrape/bind/wait steps may run again to reacquire ephemeral data. Legacy packs retain mutation attempt histories; controlled packs clear only a confirmed successful attempt to allow the next explicit iteration.

## Verification

Run `npx tsx --test test/flows.test.ts` for compiler, classifier and interpreter tests. The suite exercises a complete flow, blank/stale/ambiguous evidence, failed writes, changed choices, wrong identity receipts and uncertain submission recovery. The browser adapter shares the guarded executor tests in `test/interaction.test.ts`. See the [validation record](validation.md) for the live environments that were actually exercised.
