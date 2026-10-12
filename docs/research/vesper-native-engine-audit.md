# Vesper engine policy audit

This document records the pre-controller baseline. The subsequent 0.4.0
implementation and qualification boundaries are described in
[Native engine](../native-engine.md). Its proposed independent controller and
activation canary are now implemented; historic failures below remain evidence
of the original behavior.

Audited locally on 2026-10-11. This is an independent source and owned-fixture
audit. No vendor binary, user profile, running app or service was modified.
Temporary browser stores were removed after each probe. Experimental scripts
and raw results remain private under `.workbench/vesper-target-policy-probe.*`.

## Result

Vesper currently uses original profile management around upstream Chromium and
optional upstream Brave. Launch switches and browser CDP policy are real engine
controls; they are not a Vesper-compiled browser kernel. No JavaScript prototype
patches are needed for the bounded improvements demonstrated here.

The historical qualification evidence passes profile lifecycle and selected
page properties while recording concrete coherence failures. It does not
qualify a complete browser identity. The most useful next step is a single
pre-script target policy controller with explicit supported-target rules,
followed by repeatable upgrade canaries that reject unsupported requests.

## Historical evidence and bugs

Baseline source: `packages/vesper-browser/src/browser.ts`, `persona.ts`,
`scripts/engine-qualification.mjs`, `scripts/browser-observations.mjs`.
Evidence: `test-results/expansion/engine-qualification.json` at
2026-10-10T19:52:22Z and `test-results/vesper-browser/observations.json` at
2026-10-10T17:17:27Z. Root implementation work may supersede this baseline;
new results must be stored separately rather than reinterpreting old passes.

| Priority | Finding | Evidence and consequence |
| --- | --- | --- |
| High | Worker CPU policy is absent | Requested CPU 4 appears as 4 in page/frame, 12 in Chromium workers, and 10/5 in the two Brave workers. The existing iframe-only autoattach filter excludes workers. |
| High | Cross-process screen policy is rejected and hidden | Requested screen 1366×768 appears in Chromium main page, while its cross-origin frame exposes 1920×1080. An isolated CDP probe reproduces `Command can only be executed on top-level targets` for iframe `Emulation.setDeviceMetricsOverride`. The current catch resumes the target anyway. |
| High | Later top-level pages are configured after target creation | `targetcreated` configures pages asynchronously, catches failures and does not hold first navigation. The observations record popup initial viewport 1184×705, later 1200×800, and popup first request Accept-Language differs from the main request. A passing later snapshot cannot prove initial policy. |
| High | Qualification omits important assertions | The headed engine script asserts CPU/timezone in main/frame but records worker CPU without asserting it, does not assert iframe screen or locale, and only reports Brave screen deviation. The label “first-script parent/frame … screen” must not be interpreted as cross-target screen qualification. |
| Medium | Environment inspection covers one page | `environmentReport` reads the first page, not the full page/frame/worker graph. Its matching main screen says nothing about iframe screen. |
| Medium | Language controls are separate | ICU locale override is not navigator.language or HTTP Accept-Language. The existing main header `fr-FR` and popup header `fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7` differ. The canary must assert the exact contract across first requests as well as JS observations. |
| High | Engine activation has no policy canary gate | `activateEngine` checks stopped profiles, backs up archives and selects the staged executable, but does not launch it or qualify target policy. Backup/activation success cannot establish first-script behavior for a new engine build. |

Brave's report records a main screen of 1440×900 and a cross-frame screen of
1680×1050 for a requested 1366×768. Different canvas hashes between two Brave
profiles are a narrow privacy observation; they do not establish masking
quality, unlinkability, stable identities or compatibility with arbitrary sites.

## Actual local CDP experiments

Direct worker-only autoattach was tested against Chrome/157.0.8097.0 and
Brave's Chrome/155.0.8059.40 in fresh temporary stores. The paused worker accepted
all three commands: `Emulation.setHardwareConcurrencyOverride(4)`,
`Emulation.setLocaleOverride(fr-FR)` and
`Emulation.setTimezoneOverride(America/New_York)`. Its first message reported
CPU 4, fr-FR and America/New_York. No `--lang` switch was supplied in this
probe, so navigator.language correctly remained the host en-GB.

Worker `Schema.getDomains` listed Runtime, Debugger, Profiler, HeapProfiler and
Schema even though those Emulation commands succeeded. Domain enumeration is
therefore not a valid gate for these methods on the tested builds.

A browser-level controller excluding `tab` and including `page`, `iframe`,
`worker`, `shared_worker` and `service_worker` was recursively installed before
resuming attached targets. On Chromium, main page, cross-origin frame,
dedicated worker and 20 popup first scripts per headed/headless mode reported
CPU 4/fr-FR/America/New_York. This experiment records unsupported methods rather
than enforcing production fail-closed behavior. Shared and service workers
were included in the filter but not exercised in this initial probe.

Repeated locale calls sometimes returned `Another locale override is already
in effect`, while first observations already matched the requested locale.
Treat this exact case as satisfied only after observing the requested canonical
locale on the paused target. Do not turn it into a blanket exception for other
protocol failures. A worker-only experiment without an existing override did
not produce this error.

Allowing `tab` and `page` together in the browser-root filter fails explicitly:
`Filter should not simultaneously allow "tab" and "page", page targets are
attached via tab targets`. A separate tab-root experiment accepted its filter
but produced mixed early CPU/old ICU observations in popups. The page-only
root filter is the demonstrated path on these builds.

`--screen-info={1366x768 devicePixelRatio=1}` gave the first page, cross-origin
frame and popup a native 1366×768 display in headless Chromium. In headed mode
the flag is ignored and the host 1920×1080 display remains. This is an upstream
headless display facility, not a portable headed persona. Its format and scope
are documented in [Chromium's headless screen-info source](https://chromium.googlesource.com/chromium/src/+/HEAD/components/headless/screen_info/).

## Proposed target controller

Use one long-lived browser-root CDP session owned by Vesper. Register attachment
listeners before enabling autoattach, use flattened sessions, pause new targets,
exclude `tab`, and explicitly include page/iframe/worker/shared_worker/service_worker.
For every child, first register its listener, apply supported scalar policy,
recursively enable its autoattach, then resume it. Deduplicate by session ID and
await initial attachment jobs before navigation or returning a usable endpoint.
The installed protocol types and [official CDP Target definitions](https://github.com/ChromeDevTools/devtools-protocol/blob/master/pdl/domains/Target.pdl)
describe paused attachment and target filtering.

Separate scalar policy from top-level page metrics. CPU, locale and timezone
were demonstrated on workers; screen/viewport metrics are top-level only.
Permission/geolocation and request-language configuration need their own target
and origin rules. Do not apply page-only operations to worker sessions.
Install policy before Vesper start-page navigation. Newly created tabs, popup
navigation, workers within OOPIFs, nested workers, prerender/activation and
restored sessions require distinct lifecycle tests.

On requested-policy failure, record target type, failed command and a scrubbed
error, prevent execution, and surface a meaningful profile failure. The previous
`finally(resume).catch(() => {})` is unsuitable for strict policies. Bound every
wait and detach handler so destroyed targets cannot deadlock browser shutdown.
One controller must coexist with ordinary Puppeteer/Workbench attachment; a
second automation client must not silently reset policy or resume targets early.

## Native route and distinctions

| Layer | What it actually means for Vesper |
| --- | --- |
| Upstream native switches/preferences | Chromium's proxy/WebRTC/WebGL/image flags, headless display and Brave's own privacy implementation. Version-specific behavior still needs qualification. |
| CDP emulation | Supported engine protocol overrides before script execution. No JS getter patching, but not a custom kernel and not every API/target is supported. |
| JavaScript injection | Code in documents that changes exposed objects or prototypes. It is absent from the proposed controller and would require a separate invasive contract. |
| Original native engine | A source-controlled Chromium patch series, reproducible compiled binaries, renderer/worker propagation, upstream security updates and native tests. This has not been built here. |

A feasible first native research patch is a small immutable profile-policy
descriptor propagated to every renderer/worker creation path, backed by native
tests for an explicitly selected setting such as hardware concurrency. It must
define semantics for dedicated/shared/service workers and OOPIF renderer swaps,
not merely wrap the existing CDP page override. Avoid an enormous unrelated
“mask everything” fork as the first patch. Brave integration is useful upstream
native privacy, but rebranding it does not make it Vesper's compiled engine.

## Upgrade canaries that mean something

Canaries must sample the first fixture script/message, assert every requested
value, and preserve requested/observed values and method errors on failure.
Exercise main, same-origin frame, true cross-site OOPIF, popup repeats, new tabs,
dedicated/nested/shared/service workers, page reload, stop/restart and imported
archives. Include actual Vesper API and Workbench client paths with automation
leases. Check native privacy mode using repeated canvas and OffscreenCanvas
observations in the same profile and multiple profiles without assuming random
values imply quality. Assert headed limitations honestly and headless display
coherence where supported. Use fresh owned stores and origins for each build.

Also test permission-sensitive geolocation, disabled graphics/image requests,
first request language headers, WebRTC candidate behavior and an unavailable
upstream proxy. HTTP failure alone cannot qualify DNS/UDP/OS routing: that needs
separately scoped capture. Lifecycle/archive passes must not stand in for
fingerprint-policy passes. Persist the executable version/hash, policy,
context matrix, exact assertions and failure log before engine activation.

The new `scripts/native-fingerprint-qualification.mjs` is an original suite
covering the actual Browser API/client and Workbench Runtime child automation
paths in temporary stores. It saves context values and explicit failures to
`test-results/native-engine/qualification.json`. It must run against the built
implementation; creating the suite alone is not a passing qualification.

## Local native build prerequisites

Read-only inventory on this PC:

| Item | Observed |
| --- | --- |
| OS/filesystem | Windows 11 Home 10.0.26200 x64; C: NTFS on CT1000E100SSD8 SSD |
| CPU/RAM | Ryzen 5 5500, 6 cores/12 threads; 15.8 GiB RAM |
| Disk | C: about 72.44 GiB free (77.78 GB decimal), below the documented 100 GB floor |
| Visual Studio | Build Tools 2022 17.14.37314.3 and Build Tools 2026 18.3.11520.95 registered and complete |
| C++ tools | MSVC 14.44.35207 (2022) and 14.50.35717 (2026); VC.Tools.x86.x64 registered |
| Desktop/MFC workload | `vswhere -requires Microsoft.VisualStudio.Workload.NativeDesktop` and `VC.ATLMFC` returned no installation; components not verified as present |
| SDK | Include tree only 10.0.26100.0; required current-main SDK not found |
| SDK debugging tools | x64 dbghelp.dll/cdb.exe not found at the standard Windows Kits path |
| Utilities | Git 2.53.0.windows.2, Python 3.14.3 and separate Python 3.10, Ninja 1.13.2 available |
| Chromium checkout tools | gclient, GN and clang-cl not on PATH; no checkout markers in this workspace or checked conventional C:/src, C:/chromium, C:/depot_tools/user equivalents. This is not an exhaustive whole-PC search. |

Current-main [Chromium Windows build instructions](https://chromium.googlesource.com/chromium/src/+/main/docs/windows_build_instructions.md)
require Windows 10+, 8 GB RAM minimum, 100 GB free NTFS disk, Visual Studio 2026
with Desktop C++ and MFC/ATL, SDK 10.0.28000.2270 and sufficiently recent SDK
debugging tools. Installed VS 2026 meets the version condition, but this PC is
not yet qualified to build current-main Chromium. A pinned older branch needs
its own exact prerequisites rather than blindly applying main's toolchain.

No installer, checkout, SDK update, system setting, antivirus exclusion or
vendor mutation was performed. Building before making space and supplying the
missing branch-specific tools would not be a meaningful native implementation.
