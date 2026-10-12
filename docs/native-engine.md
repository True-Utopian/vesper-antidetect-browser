# Vesper native engine

Vesper Browser 0.4.0 and Workbench 0.5.0 by **true-utopian** manage local
Chromium and optional Brave profiles. Vesper's controller, transport, gateway,
profile manager and qualification runner are original code. Native fingerprint
privacy uses upstream Brave; this release does not contain a custom compiled
Vesper browser kernel or promise Kameleo, Multilogin or Dolphin parity.

## Use it

Open **Engine updates**, choose Brave and download a pinned version. **Test
engine** creates a temporary, isolated profile and checks first-script behavior
in pages, cross-process frames, dedicated workers, shared workers, service
workers and a popup. **Test, back up and activate** requires stopped, unleased
profiles, repeats the test, archives profiles, then changes the selection. A
failed test is retained in the engine list and cannot change the active engine.
HTTP mutations queue behind activation; direct profile mutations reject while
its maintenance lock is held. User profiles are never used as canary fixtures.

Create or edit a profile, select **Brave**, then **Standard** under native
fingerprint protection. Chromium supports **Off**. Brave also supports Off for
controlled comparisons. Locale, timezone, hardware concurrency and screen
settings remain explicit profile policies. Use start pages for controlled
startup; managed launches open a new tab instead of restoring saved site tabs
before the policy controller connects. Cookies, storage and history persist.

Workbench's built-in Inspect automation accepts engine, protection, locale,
timezone and CPU threads (`cpu`) inputs. The optional Workbench add-on uses
Browser-owned profiles and the same authenticated API and guarded CDP endpoint.
It does not maintain a second fingerprint controller or need a vendor account.

## Supported behavior

The independent CDP controller admits newly created pages, cross-process
frames and workers before their scripts run. It sets supported native CDP
CPU, ICU locale and timezone policies and recursively attaches to new targets.
The profile's native language preferences cover navigator languages and HTTP
Accept-Language. A private loopback gateway delays automation resume commands
until the policy is ready. Service workers use a native before-script debugger
breakpoint because their script fetch must proceed before renderer emulation
commands can complete. Unsupported commands, lost controller ownership and
policy failures prevent further admission rather than silently continuing.

Headless Chromium uses its native virtual display for frame and popup screen
consistency. Headed cross-process frames retain the physical display metrics;
top-level emulation cannot redefine those metrics. Workers have no screen API.
Brave may alter reported screen values as part of its own native privacy policy.

Brave's versioned native content settings map standard protection to ASK (3)
and Off to ALLOW (1). Vesper writes that one setting while a profile is stopped
and removes stale site overrides for that same setting. Other native
preferences and Shields remain intact; malformed preference files fail without
being replaced. Upstream Brave owns its protection algorithm, site/session
seeding and compatibility rules. Vesper does not offer fabricated custom noise,
seed controls, arbitrary device personas or a strict mode unsupported by the
qualified build.

The qualification fixture measures native canvas pixels: Off profiles agree,
Standard profiles differ, and repeated reads and a same-origin worker agree
within each tested profile. This is bounded evidence, not proof of detection
bypass, stable identities across sessions, every protected surface or every
website. Initial browser boot targets, restored service-worker behavior,
headed cross-process screen masking, TLS impersonation and OS/DNS/UDP/WebRTC
leak behavior are not qualified. CDP is a capability for trusted local
automation, not a sandbox against a hostile automation client.

## API and source

All HTTP endpoints below are under `/api/v1` on the authenticated loopback
Browser service. OpenAPI is at `/api/v1/openapi.json`.

| Endpoint | Purpose |
| --- | --- |
| `GET /fingerprint/capabilities` | Native modes, supported engines and explicit limitations |
| `GET /profiles/{id}/fingerprint` | Requested policy, controller health and target counts; does not navigate |
| `GET /profiles/{id}/environment` | Measure an open page; requires its automation lease when owned |
| `GET /engine/versions` | Staged engines and retained canary results |
| `POST /engine/qualify` | Fresh isolated test of an already staged build |
| `POST /engine/activate` | Fresh test, profile backups and guarded selection |

Qualification and activation bodies use
`{"family":"brave","buildId":"1.97.56"}` or a pinned Chromium revision.
Profile settings use
`{"engine":"brave","fingerprint":{"protection":"standard"}}`.
TypeScript client methods include `fingerprintCapabilities`, `fingerprint` and
`qualifyEngine`. The standard-library Python client includes
`fingerprint_capabilities`, `fingerprint`, `engine_versions` and `engine_action`.

Implementation lives in `packages/vesper-browser/src/native-preferences.ts`,
`target-policy.ts`, `cdp-connection.ts`, `cdp-gateway.ts` and `engine-canary.ts`.
Engine executable SHA-256 in canary results identifies the launcher, not every
file in a browser distribution. Activation always reruns qualification instead
of trusting a historic pass.

## Evidence and remaining native work

Local REA follow-ups are recorded in
`research/kameleo-native-engine-followup.md` and
`research/vendor-native-engine-followup.md`. These distinguish observed
configuration serialization, managed launch calls, ASAR bindings and PE
markers from unproven native enforcement. Vendor source and binaries are not
redistributed. REA's Windows provider does not admit the inspected native DLLs
as a full decompilation target, and the exact native consumption path remains
unresolved. The available CLI was used because this session had no REA MCP.

`research/vesper-native-engine-audit.md` records the baseline leaks and local
build prerequisites. The controller above fixes the observed shared/service
worker CPU leak, conflicting Puppeteer auto-attachment and unsupported OOPIF
screen command. Building an original Chromium masking fork remains separate
work. The earlier audit recorded missing disk space, C++/ATL tools and SDK
debuggers. Those Windows prerequisites are now installed, the pinned Chromium
checkout is prepared, and compilation is running. Windows and Linux application
packaging does not establish that a custom browser kernel has been compiled.

Run `npm run check` for source checks. On this development machine,
`npm run qualify:native` uses the explicitly recorded local Chromium and Brave
executables in isolated stores and writes private evidence to
`test-results/native-engine/qualification.json`. Its Browser–Workbench case
executes automation and verifies the saved profile archive. Packaging commands
remain `package:windows`, `package:linux`, `package:workbench-addon` and
`package:source`. Linux package structure can be checked here; Linux runtime
execution still requires a Linux machine.

After building Windows packages and the add-on, `npm run qualify:desktop`
tests the actual packaged Browser and signed Workbench add-on in a temporary
store, including the editor, native embedding, first-script values and verified
archive. Its native-picker fixture applies only to that isolated test instance.
After source packaging, `npm run package:native-manifest` verifies the local
installer/add-on signatures and checksums and records this bounded evidence in
`release/NATIVE-ENGINE-0.4.0.json`. It does not mark the user's running
installation as upgraded or replace the earlier broad release acceptance.

Native source references:
[Brave protection mapping](https://github.com/brave/brave-core/blob/v1.97.56/components/brave_shields/core/browser/brave_shields_utils.cc),
[Brave content settings registry](https://github.com/brave/brave-core/blob/v1.97.56/chromium_src/components/content_settings/core/browser/content_settings_registry.cc),
[Chromium virtual display](https://chromium.googlesource.com/chromium/src/+/HEAD/components/headless/screen_info/),
[Chromium Windows build requirements](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/windows_build_instructions.md).

## Original Vesper kernel acceptance

The original patches in `native/chromium/patches` target Chromium
**157.0.8100.0**, revision `4afca57b57f531a92ffc15af0ffb5cf0038fb273`.
The Windows toolchain includes Visual Studio Build Tools, ATL/MFC and the
Windows SDK/debugger. The build produces Chrome and the required Blink unit
test executables. The current build is **unqualified** until every gate below
passes.

1. Compile the pinned source and record executable/patch hashes.
2. Pass 26 native unit-test executions for scalar defaults/overrides and canvas.
3. Run `scripts/qualify-native-kernel.mjs` on the raw executable, without CDP
   environment overrides or JavaScript fingerprint shims. Test first scripts,
   frames, workers, popup, startup extension worker, memory client hints and
   RGBA8 canvas reads/exports across seed changes, repeats and malformed inputs.
4. Run `scripts/package-native-kernel.mjs` with the generated runtime dependency
   list. Qualify the copied executable again and hash its component DLLs,
   resource packs and locale files. Copying only `chrome.exe` is insufficient.
5. Stage the exact copied binary through `POST /api/v1/engine/native/stage`,
   then activate `family: "vesper"`. The host reruns native qualification,
   requires stopped profiles and creates a profile backup before selection.
6. Launch an extension-enabled Workbench Inspect run using that selected binary;
   verify page/startup-worker CPU and memory, coherent canvas and a saved archive.

For the final integration gate, run:

```sh
node scripts/activate-native-kernel.mjs --manifest /path/to/vesper-kernel.json --data-root /path/to/running-desktop-data
node scripts/activate-native-kernel.mjs --manifest /path/to/vesper-kernel.json --data-root /path/to/running-desktop-data --activate
```

The first command performs a read-only preflight. Activation requires idle
Browser profiles, no run leases or unfinished Workbench cleanup, and paused
schedules. An unavailable or busy desktop leaves the qualified runtime pending.
Existing Chromium profiles retain their configured engine; activation does not
silently convert them to Vesper.

The implemented native source covers CPU count, device-memory reporting/client
hints and deterministic RGBA8 Canvas2D/OffscreenCanvas reads and exports.
WebGL/WebGPU, audio, fonts, media-device modeling, coherent persona generation,
float canvas formats and a native Linux build remain separate acceptance work.
Stock Chromium is rejected, including its startup extension worker's unmodified
CPU value. A passing stock-browser CDP test cannot satisfy native proof.
