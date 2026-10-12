# Interaction model

The implemented `src/interaction` module adds seeded input planning, a guarded Puppeteer executor, a consent-based recorder, and offline calibration/scoring tools. Existing `createActions` remains unchanged. No human dataset was supplied, so the bundled model is explicitly **uncalibrated**. Passing automated tests establishes implementation behavior, not equivalence to human interaction or success against anti-abuse systems.

## Use the executor

Build with `npm run build`, then import the module:

```js
import { createSynthesizedActions } from './dist/interaction/index.js';

const actions = createSynthesizedActions(page, {
  seed: runId,
  allowedOrigins: ['https://owned.example'],
  signal,
  checkpoint,
  timeoutMs: 30_000,
  rollover: false,
  fatigue: false,
  corrections: false,
  fieldPolicy: selector => selector === '#fixture-text'
    ? 'synthetic-free-text' : 'sensitive',
  beforeDispatch: async ({ kind, selector }) => {
    // Revalidate this flow's current ownership and action permission.
  },
});
await actions.fill('#fixture-text', 'a synthetic sample');
await actions.click('#save');
```

The additive API implements `goto`, `click`, `fill`, `type`, `press`, `waitFor`, `moveTo`, `setPace` and `checkpoint`, and adds `focus`, `scroll(selector, deltaY)` and `useModel(model)`. Selectors must resolve to one visible target. Allowed origins are exact HTTP(S) origins. They authorize browser actions; they are not a network firewall and do not prevent redirects or third-party resources. `goto` checks its destination and resulting origin.

Each instance serializes actions. It retains target/document handles and verifies document identity, URL, connectivity, visibility, enabledness and focus during input. It checks the hit target before a click. `beforeDispatch` runs before every effect, including geometry acquisition and pointer movement; target checks run again afterward. DOM changes still have a race window. Consequential actions need application receipts/idempotency as described in the [architecture](architecture.md).

`fill` uses keyboard selection and Backspace, then checks the exact final value in memory. `type` moves the caret to the end and verifies the appended value. Neither logs values. Sensitive fields use prompt exact text insertion without artificial pauses or mistakes. Unicode and uppercase graphemes use text insertion, not invented physical-key mappings. The physical timing model covers lowercase ASCII letters, digits and a small punctuation set; non-US layouts and IME composition are not calibrated.

Errors are sanitized `InteractionError` objects with `code` and `dispatched`. `dispatched=false` means this action sent no effects; `true` is conservative and can include scrolling/pointer preparation. Never automatically replay an uncertain submission. Abort/timeout or an unexpected error after dispatch blocks the adapter from further actions; its owner must reconcile browser state before replacing it. Held keys/buttons receive bounded best-effort release. A timed-out remote command may still complete, and release can finish a pending click. The adapter cannot prove cleanup of an unresponsive browser.

`setPace('fast')` removes planned waits for functional tests. Other existing pace presets scale timing and change the model distribution. For calibrated evaluation, omit the preset and score actual recorded events. Guards and CDP round trips add overhead, so observed timing can differ from the plan. Geometry acquisition uses `scrollIntoView`; call `scroll` to exercise wheel bursts specifically.

## Timing, corrections and pointer plans

Pure `planTyping`, `planPointer` and `planScroll` exports support seeded tests without a browser. A seed determines a schedule, not identical renderer/network timing. Plans contain text/key sequences in memory; do not persist plans containing credentials.

For down/up times `d_i`, `u_i`, the planner samples positive dwell `H_i` and down-to-down interval `G_i` jointly in log space:

```text
H_i = u_i - d_i
G_i = d_(i+1) - d_i
F_i = G_i - H_i                  # signed flight
G_i >= 1 ms => F_i >= 1 ms - H_i
```

With rollover enabled, flight may be negative. The scheduler preserves down order and does not press an already-held key again. With rollover off, it requires at least 20 ms positive flight. Repeated keys, corrections and text-insertion boundaries also prevent unsafe overlap. Aalto's study establishes that rollover and individual variation exist; it does not validate these constants. Its dataset has research/noncommercial licensing conditions. [Aalto typing study](https://userinterfaces.aalto.fi/136Mkeystrokes/)

The uncalibrated fixture uses dwell median 80 ms/log sigma 0.35, interval median 180 ms/log sigma 0.45, log-space correlation 0.25, session log offset sigma 0.15, and bounds of 35–220 ms dwell and 20–600 ms interval. Eligible word boundaries have an 0.08 chance of a 150–900 ms pause. These are test settings, not measured population parameters.

Corrections require both `corrections:true` with `fieldPolicy:'synthetic-free-text'` and a nonsensitive text/textarea field marked `data-interaction-synthetic="true"`. Password/email/OTP/token/payment/identifier-like metadata overrides that permission. Unknown fields receive no synthetic mistakes. Fixture text must contain only lowercase letters and spaces. Burst probability is 0.006 per eligible position, at most one burst per field; length is one/two characters with probabilities 0.8/0.2. It inserts substituted fixture characters, waits 200–1200 ms, backspaces them, then types the intended sequence. Use only fields without autosave or external effects.

Optional fatigue is a bounded stress scenario. Active typing time excludes explicit reading/correction pauses. Once-per-active-minute AR(1) log drift uses `rho=0.9`, noise sigma 0.02 and trend `log(1.2)/20` per minute; its multiplier is clamped to 1–1.25. It is disabled for sensitive fields and is not a validated physiological model.

Pointer plans use cubic Bézier geometry and `u(s)=10s^3-15s^4+6s^5`. Control-point offsets are bounded by `min(60 px, 0.15*distance)`, smooth jitter by `min(1.5 px, 0.03*targetSize)`, and duration by 120–900 ms. An occasional bounded overshoot stays near the target center and returns before clicking. The executor rechecks layout/hit testing; a changed target stops the action. Wheel plans split at most 10,000 px into 3–10 decaying bursts with 35–90 ms spacing. Actual scrolling depends on page handlers and bounds, so the flow must verify the resulting state. These are geometric generators, not proof of human motor behavior. [Movement options](https://pptr.dev/api/puppeteer.mousemoveoptions), [Wheel input](https://pptr.dev/api/puppeteer.mouse.wheel)

## Collect consented fixture traces

Use `installInteractionRecorder(page, options)` on an owned page with explicit participant consent and synthetic tasks. Required `RecorderOptions` metadata: `source`, `split`, opaque `participantId`, unique `sessionId`, `taskId`, `deviceClass`, `keyboardLayout`, `syntheticTask:true`, `consent:{granted:true,purpose:'owned-site-synthetic-testing'}`, and `allowedOrigins`. Do not use names, emails or account IDs as labels.

Mark each recorded fixture field or pointer surface:

```html
<textarea id="fixture-text"
  data-interaction-synthetic="true"
  data-interaction-field="typing-fixture"></textarea>
```

The recorder captures relative key times and supported key names only on marked nonsensitive fields. Pointer/wheel capture is confined to marked surfaces. It ignores password/OTP/identifier-like metadata, repeated down events and unsupported key names. Final values, clipboard contents and page bodies are never read by the recorder. Key traces still reconstruct synthetic text and can contain identifying behavior: keep them private, minimize retention and honor withdrawal.

Call `await recorder.stop(assertions)` on the same document. It returns an `InteractionTrace`; overflow/navigation fails instead of silently returning a complete-looking trace. Supply these booleans from the owned application's assertions: `correctValue`, `correctFocus`, `noDuplicateSubmit`, `noSecretCapture`, `keysReleased`. Those assertions and the human/synthetic source label are operator/test-harness attestations, not independent proof. Store trace arrays in an ignored private directory such as `.workbench/interaction-data/`.

## Fit and score

```sh
npm run build
node scripts/calibrate-interaction.mjs --input .workbench/interaction-data/train.json --output .workbench/interaction-data/model.json --version owned-keyboard-1
node scripts/score-interaction.mjs --model .workbench/interaction-data/model.json --human .workbench/interaction-data/human-holdout.json --synthetic .workbench/interaction-data/synthetic-holdout.json --output .workbench/interaction-data/score.json
```

Inputs are trace arrays or `{ "traces": [...] }`. Outputs are created exclusively with private file permissions where supported; existing files are not overwritten. A failed/insufficient score exits 1 and still writes its report. Malformed inputs also exit 1. Resolve build errors before running these scripts.

Calibration accepts passing, explicitly consented human training traces in one device/layout stratum. At least ten valid timing pairs are required to fit; that is a fit minimum, not sufficient human validation. It fits global log dwell/interval timing, repeat/word-boundary/letters/other transition classes, then per-digraph groups. Sparse groups shrink toward their parent:

```text
w = balancedWeight / (balancedWeight + kappa)
mean = w*observedMean + (1-w)*parentMean
covariance = w*observedCovariance + (1-w)*parentCovariance + smallDiagonalRegularizer
```

Default `kappa` is 50. Each participant contributes total fitting weight 100, divided among sessions and pairs; model `count` is this normalized weight, not independent sample size. Training participant/session labels detect holdout leakage. `calibrated:true` means a fit was performed, not that holdout validation passed. Pointer geometry, correction probabilities and fatigue constants are not learned by this fitter.

Scoring requires human and synthetic holdouts disjoint from training identities/sessions, in the same stratum with matching task sets. It balances human participants/tasks/sessions and synthetic sessions, then scores observed dwell, signed flight and interval distributions. Programmatic `metrics` can additionally require pointer speed, whole-trace path efficiency, wheel delta or duration; traces must contain those features. Use one defined pointer task per trace for path efficiency. Missing features or undefined timing correlations fail coverage.

```text
d_j = Wasserstein1(human_j, synthetic_j) / max(humanIQR_j, floor_j)
D = mean(d_j)
C = mean(abs(humanSpearman - syntheticSpearman) / 2)
R = mean(abs(humanRate - syntheticRate))
score = 100*exp(-(0.55*D + 0.25*C + 0.20*R))
```

`C` covers dwell/interval and successive-interval correlation; `R` covers rollover and Backspace rates. Floors: 10 ms for key timing, 50 px/s for pointer speed, 0.05 efficiency, 25 px wheel delta, 50 ms duration. Initial acceptance requires 20 held-out people with at least two sessions each, passing correctness assertions, a fitted model, lower score bound 85, and upper bounds `D<=0.20`, `C<=0.10`, `R<=0.05`, maximum individual `d_j<=0.50`. These are proposed engineering thresholds, not a human-identity classifier. [Wasserstein distance](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.wasserstein_distance.html)

Default 2,000 bootstrap resamples cluster human sessions by participant and synthetic traces by session/seed. Reports contain percentile 95% intervals. Run each device/layout stratum separately; there is no simultaneous fleet-wide confidence guarantee across strata. Do not repeatedly tune against the final holdout. The programmatic API allows lower sample thresholds for diagnostic tests; those results must not be presented as full coverage. [Bootstrap reference](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bootstrap.html)

## Validation limits

Run `npx tsx --test test/interaction.test.ts` for timing, rollover, correction exclusions, trajectories, fit/holdout separation, scoring gates, exact fill, focus loss, cancellation and late-command tests. They use synthetic traces and mocked browser effects; they do not replace live event-conformance testing or a consented human study. No participant data was collected for this implementation.

Browser-dispatched `isTrusted` events do not establish human presence. CDP timing does not reproduce every physical keyboard, OS dialog or IME path, and delays do not hide automation. Use documented staging/test configurations for an owned site's challenge integrations. [DOM event trust](https://dom.spec.whatwg.org/#dom-event-istrusted), [Puppeteer typing](https://pptr.dev/api/puppeteer.keyboard.type), [Turnstile testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
