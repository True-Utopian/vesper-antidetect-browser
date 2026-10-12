# Writing automations

Script mode loads trusted ES modules from `automations/` at startup. Leave `DATABASE_URL` unset to use this mode, and restart after changing a module. Run `npm run build` before using the included examples, which import `../dist/index.js`. Managed mode uses [declarative flows](flows.md) and a separate guarded executor.

The runtime handles profile creation, proxy allocation, input requests and export. Your script defines website actions and the success condition. Puppeteer attaches to the headed Kameleo Chroma profile created for that run.

```js
import { defineAutomation } from '../dist/index.js';

export default defineAutomation({
  id: 'my-form',
  title: 'Complete my form',
  description: 'Enter a value and leave the browser available for inspection.',
  inputSchema: {
    type: 'object',
    required: ['url', 'message'],
    additionalProperties: false,
    properties: {
      url: { type: 'string', title: 'Website URL' },
      message: { type: 'string', title: 'Message' },
    },
  },
  preset: 'natural-fast',
  profile: ({ inputs }) => ({
    language: 'en-GB,en',
    timezone: { value: 'automatic' },
    geolocation: { value: 'automatic' },
    webRtc: { value: 'automatic' },
    passwordManager: 'disabled',
  }),
  async run({ inputs, page, browser, actions, log, waitForFinish }) {
    await actions.goto(inputs.url);
    await actions.fill('textarea[name=message]', inputs.message);
    await actions.click('button[type=submit]');
    // Define a real application-specific success condition.
    await page.waitForSelector('[data-status=saved]', { visible: true });
    log('The application confirmed completion.');
    await waitForFinish();
  },
});
```

Use the existing `page` and `browser`. Ordinary Puppeteer methods are available. Do not call `puppeteer.launch()`, close the entire browser yourself, or add third-party fingerprint/stealth plugins. Kameleo's Puppeteer integration currently supports Chroma, not Junglefox. [Official integration](https://developer.kameleo.io/integrations/puppeteer/)

## Inputs and follow-up questions

`inputs` is validated against `inputSchema` and held in memory. `writeOnly: true` marks a field as sensitive for form presentation; use it for secrets. Schema validation is not a substitute for website-specific checks in your script. The runtime does not save submitted input objects or follow-up answers in run metadata.

```js
const { code } = await requestInput('Enter your current verification code', {
  type: 'object',
  required: ['code'],
  additionalProperties: false,
  properties: {
    code: { type: 'string', minLength: 6, maxLength: 6, writeOnly: true },
  },
});
await actions.fill('input[name=verificationCode]', code);
```

Only one challenge may be active per run. Answers must match the current challenge ID and schema. The run timeout continues while awaiting input, paused or waiting for Done. Cancel closes the worker and attempts to stop the profile.

Never put secrets in automation titles, schemas, filenames or logs. Known input/proxy values are redacted from script logs, and worker stdout/stderr are not forwarded. Arbitrary trusted code can still deliberately write files, transform secrets or send them elsewhere. This is not a sandbox for untrusted uploaded scripts. Browser state and exported `.kameleo` files may contain login sessions and other sensitive information by design.

## Fingerprint and profile configuration

The optional `profile({ inputs, runId, signal })` hook returns Kameleo `CreateProfileRequest` fields. This runtime requires local storage; a cloud setting is rejected because the export workflow uses a shared local filesystem. The profile name is reserved as `run-<id>` for crash recovery. Supported examples include `fingerprintId`, `language`, `canvas`, `webgl`, `webglMeta`, `audio`, `fonts`, `screen`, `timezone`, `geolocation`, `webRtc`, `hardwareConcurrency`, `deviceMemory`, `passwordManager`, `extensions`, `startPage` and `notes`. Refer to the installed SDK types for exact choices.

```js
profile: () => ({
  // Optional: choose a previously selected, compatible fingerprint.
  fingerprintId: process.env.FINGERPRINT_ID || undefined,
  screen: { value: 'manual', extra: { width: 1920, height: 1080 } },
  language: 'en-US,en',
  passwordManager: 'disabled',
})
```

When `fingerprintId` is omitted, Engine selects its recommended default fingerprint. This framework creates a new profile for each submitted run. Reusing a fingerprint sample is distinct from reusing a profile's cookies and storage. Changing the base fingerprint of a running profile is not supported here. Keep browser/platform fields coherent and leave Kameleo in charge of the user agent. [Profile fields and lifecycle](https://developer.kameleo.io/tutorials/managing-profiles/), [fingerprint concepts](https://developer.kameleo.io/concepts/fingerprints/)

The Engine and cached kernels stay available across runs. The runtime calls `InstallProfileKernel` before start, which avoids a missing-kernel surprise during the subsequent start call; a new kernel can still require a download on the first run. Fresh profile creation, proxy checks, quota waits, page loads and login challenges are not instantaneous. Measure timings on your own host instead of assuming a fixed startup latency.

Hooks run on the trusted coordinator. Awaited hooks have cancellation deadlines, and late profile creation/start results trigger cleanup. Hooks must not perform synchronous infinite loops or block the Node event loop. The main `run()` executes in a separate process, so its timeout can hard-stop runaway code. An Engine operation may outlive its client-side cancellation; ambiguous failures retain the profile/proxy for inspection rather than silently recycling them.

## Proxy selection

Return a provider request from `proxy({ inputs, runId, signal })`; credentials should come from protected server configuration. The returned lease is applied before the profile starts. Missing `proxy` uses the runtime's configured default provider request, or a direct browser connection if no default exists.

```js
proxy: () => ({
  provider: 'inventory',
  country: 'GB',
  requireVerified: ['country'],
  maxLatencyMs: 2500,
  minRemainingMs: 30 * 60 * 1000,
})
```

```js
proxy: () => ({
  provider: 'iproyal',
  country: 'GB',
  requireVerified: ['country'],
  iproyal: { lifetime: '1h' },
})
```

See the proxy documentation for provider configuration and verification scope. A lease reserves its observed exit IP within this runtime; it does not guarantee global exclusivity or permanent IP stability. The browser must stop before a lease is released. A failed or uncertain stop retains the lease for inspection.

## Input pacing

These script-helper presets control timing and visible pointer motion. Managed flows use the [interaction model](design/interaction-model.md); the table below describes `createActions`, not that model's distributions.

| Setting | `fast` | `natural-fast` | `natural` |
| --- | ---: | ---: | ---: |
| Typing delay, ms | 0 | 15 | 60 |
| Typing jitter, ±ms | 0 | 10 | 25 |
| Before-action delay, ms | 0 | 60 | 180 |
| Before-action jitter, ±ms | 0 | 25 | 60 |
| Pointer duration, ms | 0 | 80 | 250 |
| Pointer steps | 1 | 6 | 14 |
| Mouse-down/up delay, ms | 0 | 20 | 50 |

All delay fields accept 0–10,000 ms. Pointer steps must be an integer from 1–100. Jitter samples uniformly within the configured range and clamps at zero. Actual elapsed time includes Puppeteer calls, scheduling and network latency, so pointer duration is a pacing budget rather than a frame-accurate guarantee.

```js
preset: {
  typingDelayMs: 25,
  typingJitterMs: 12,
  actionDelayMs: 80,
  actionJitterMs: 35,
  pointerDurationMs: 160,
  pointerSteps: 10,
  clickDelayMs: 35,
}
```

Switch within a script with `actions.setPace('fast')` or `actions.setPace({ typingDelayMs: 35, typingJitterMs: 10 })`. Omitted custom fields use fast defaults. A submission's `preset` overrides the automation default. `createActions(page, { random: () => 0.5 })` supports deterministic timing in tests.

Helpers:

- `goto(url)` waits for `domcontentloaded`; wait for your application's real ready condition next.
- `click(selector)` waits for a visible target, optionally moves to its center, then clicks it.
- `moveTo(selector)` scrolls the target into view and moves the helper's tracked pointer to its center with a smooth interpolation. Native mouse activity can make the tracked starting point stale.
- `fill(selector, text)` supports inputs and textareas; it focuses the control, clears through its native value setter and input event, then types. It does not fill contenteditable controls.
- `type(selector, text)` focuses and appends. Fast mode issues one `keyboard.type(text)` call; paced mode checks cancellation between characters.
- `press(key)` sends a Puppeteer keyboard key; focus must already be correct.
- `waitFor(selector)` waits for visibility.
- `checkpoint()` is the cooperative pause/cancellation boundary.

Selectors use Puppeteer's own selector semantics. Helpers do not guess alternate elements or recover from changed page structure. Prefer stable labels, IDs or test attributes and add explicit checks around state transitions.

## Pause, completion and export

Pause is cooperative: the dashboard first requests pause and only shows `paused` after a helper or `checkpoint()` acknowledges it. Raw Puppeteer calls continue until your next checkpoint. Only acknowledged pause gives the human sole control of script actions. Do not run concurrent Puppeteer tasks in the same profile when a clean handoff is required.

`await done()` ends the automation and requests save immediately. It does not return normally. `await waitForFinish()` leaves the live session available until the operator selects Done, then requests the same save. Returning from `run()` without either is treated as incomplete: the profile is stopped and retained, with no export.

The save sequence is worker disconnect → graceful profile stop → Engine export to a unique temporary `.kameleo` path → local nonempty-file check and SHA-256 → atomic rename → `saved`. `engineExportDir` and `localExportDir` must refer to the same shared mounted directory from their respective hosts. `automationDoneAt` precedes `savedAt`; a script completing is not proof its archive is ready. Cleanup has a 10-second bound and export has a separate 120-second bound by default (`cleanupTimeoutMs` and `exportTimeoutMs` for library callers). Late successful export responses remove their temporary file instead of publishing an already-timed-out result.

If export fails, the run becomes `export_failed`. Retry Export retries only shutdown/export; it never repeats website actions. A terminal run with `cleanupRequired: true` reserves its capacity slot until the browser is confirmed stopped, preventing a second session from overlapping an uncertain old one. Known interrupted profiles are reconciled before admitting new work after restart. Retry Export can also recover such failed/cancelled runs when their profile ID is known. An unresolved create with no recoverable profile ID needs operator inspection of the Engine; do not bypass that admission hold by increasing concurrency.

Profiles are not deleted automatically. The file check/hash verifies the artifact on disk; actual restoration compatibility is a separate import test. Export/import preserves the profile ID, so importing alongside that same profile may conflict. [Kameleo export behavior](https://developer.kameleo.io/tutorials/managing-profiles/)

Included scripts: `demo` fills and verifies `/demo` and immediately saves; `inspect` leaves a page open for a human; `challenge-demo` demonstrates follow-up input. These examples do not automate third-party account login. Your own authorized scripts can implement application-specific flows and pause for ordinary verification challenges.
