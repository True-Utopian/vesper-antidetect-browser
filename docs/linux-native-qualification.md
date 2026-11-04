# Qualified Linux native runtime

## Current local pair — 4 November 2026

Browser **0.4.13** / Workbench **0.5.18** passed packaged and actual installed qualification on Windows and Linux, including 13 installed API checks with durable disconnected notification replay, native/proxy/Python integration, normal quit/restart and the exact SDK restore walkthrough. The full original stores were preserved behind independently verified backups. See [replay acceptance and limits](run-event-replay.md#qualified-local-release). Matching Windows/Linux source CI gates public acceptance. The full implemented roadmap remains pending.

## Previous pair — 3 November 2026

Browser **0.4.10** and signed Workbench **0.5.15** passed installed qualification in an isolated non-root account. Both checksum-matching tar archives were freshly extracted and their actual per-user portable installers executed into new version directories. Installed ASAR/trust metadata and every native runtime component matched the packaged records. The original private store was fully backed up and verified before installation; original bytes remained intact except the intended add-on registry.

The included kernel passed fresh nine-case qualification before guarded activation in the installed fixture. Its 47 stopped profiles, including trash, received activation backups; visible profile records were unchanged. No Chromium recompilation occurred and the compiler cache was retained.

The installed pair passed **17 desktop/documentation/restart checks**, **nine API**, **seven proxy**, **six native identity** checks and Python scheduling. A fresh native profile reported PID/network namespaces and seccomp-BPF enabled. All eleven screenshots were reviewed: Browser profile table at launch/narrow sizes, embedded Workbench, Inspect, both real OS-opened localhost references, desktop references, calendar example and mobile guide. Normal Quit/restart retained every original profile and historical run.

The two final production graphs were separately audited with zero recorded npm vulnerabilities. A failed earlier candidate retained stale nested local-file dependencies; fresh dependency staging seeded from the verified source lock corrected it, and the packaged graph was checked against the audited graph.

The GPU-less host used explicit software rendering under Xvfb. Real OS documentation handoffs used an owned per-process browser handler without changing host associations. Physical GPU behavior, privileged Debian installation, additional distributions/architectures and broad fingerprint-family/vendor parity remain unqualified. Original 26-unit and direct/copy native evidence below applies to the unchanged kernel.

## Earlier 3 November acceptance — 0.4.9 / 0.5.13

Browser **0.4.9** and signed Workbench **0.5.13** passed renewed installed qualification. The existing versioned per-user installation was retained; its installer/signature/native checks had passed on 16 October, when a separate UI review timed out. That failed overall receipt remains preserved. No Chromium rebuild or replacement of cached native output was needed.

Fresh acceptance passes **17 desktop/documentation/restart checks**, with separate **nine API**, **seven proxy**, **six native identity** checks and Python scheduling. Both hardware presets agree in first script, worker, frame and HTTP hints; restart and executed archive import preserve seeded identity. Workbench runs through the installed Browser and saves a checksum-verified archive. A newly launched native profile reports PID/network namespaces and seccomp-BPF enabled.

All nine current screenshots were reviewed: native launch, narrow navigation, the cancelled fourteen-field Inspect form, both real OS-opened documentation windows, desktop references, calendar example and mobile guide. The toolbar wraps at narrow sizes. The fixed form actions remain visible; form/JSON/form preserves the selected native settings and Cancel creates no run. Idle disable/re-enable and normal Quit/restart preserve the enabled add-on and every original profile/run record.

The real `xdg-open` handoffs use an owned per-process `BROWSER` handler under Xvfb and open the correct credential-free localhost references in sandboxed native Chromium. The host's default associations are unchanged. Explicit software rendering remains necessary on this GPU-less host. Physical GPU behavior, privileged Debian installation and full vendor parity remain unqualified. Original compiler/unit/runtime results below apply to the unchanged native kernel.

## Earlier installed acceptance: 13 October 2026

On 13 October 2026, Browser **0.4.8** and signed Workbench **0.5.11** passed installed qualification in an isolated, non-root Ubuntu account. Both portable installers executed into new per-user version directories. Release hashes, executable permissions, local update signatures, the signed add-on and installed native component inventory matched their receipts.

The original Chromium 157.0.8100.0 kernel passed **26 native unit executions**, **nine direct cases** and **nine copied-runtime cases**. Fresh installed qualification preceded activation, backed up the stopped owned profile and preserved its settings. The installed kernel reported active PID namespaces, network namespaces and seccomp-BPF sandboxing.

The installed pair passed **34 checks**: four installation/restart checks, seven native integration checks, nine extended API/archive/extension/calendar checks, seven proxy checks and seven separately reviewed UI checks. The native automation saved a checksum-verified **73,279-byte** archive. Normal Quit/restart preserved the enabled signed add-on, original owned profile and saved run. All owned applications stopped normally after qualification.

The UI review used the actual installed Browser and native embedded Workbench. It covered the original moth emblem, the saved native archive, Inspect's 14 ordinary fields, a native 4-thread/4-GB preset, restricted WebGL/font selectors and seeded offline audio through form → JSON → form. Cancel created no run. Disabling and re-enabling the idle add-on retained all three saved runs. The 1380×860 launch window and a real 1000×720 resize were reviewed; the form footer remained visible, and narrower navigation and run content used their intended scrolling. Parent and child screenshots were reviewed separately and their native host bounds matched.

The GPU-less server required explicit software rendering: `VESPER_GRAPHICS_BACKEND=software` selects ANGLE SwiftShader on Linux. The default headed backend failed to create WebGL contexts; that failed receipt remains retained. Software rendering passed the unchanged strict assertions and normal sandbox checks. It does **not** qualify a physical GPU or disguise the software renderer. Desktop users retain the native default unless they opt in.

A first software-rendered qualification completed the native/API/proxy checks but failed because its helper read the Workbench descriptor before restart finished. The corrected helper waits up to 120 seconds for the descriptor and matching authenticated capabilities. A fresh installed retry completed every check and separate UI review. No compiler rebuild was started and the native output cache was preserved.

This acceptance covers per-user portable installation and the bounded [native policies](native-kernel-qualification.md). Privileged Debian installation, arbitrary OS/GPU personas, WebGPU, realtime/device audio, complete font packs, whole-browser network leak prevention, comparative capacity and detection avoidance remain unqualified. At the time of this 13 October record, Windows 0.4.7 / 0.5.10 still awaited its separate upgrade gate; current Windows acceptance is documented separately.

Private receipts and screenshots remain local under `test-results/desktop` and `.workbench`. No installers, keys, profiles, credentials, archives or vendor binaries are published.
