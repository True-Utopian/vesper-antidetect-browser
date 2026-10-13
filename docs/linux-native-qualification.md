# Qualified Linux native runtime

On 13 October 2026, Browser **0.4.8** and signed Workbench **0.5.11** passed installed qualification in an isolated, non-root Ubuntu account. Both portable installers executed into new per-user version directories. Release hashes, executable permissions, local update signatures, the signed add-on and installed native component inventory matched their receipts.

The original Chromium 157.0.8100.0 kernel passed **26 native unit executions**, **nine direct cases** and **nine copied-runtime cases**. Fresh installed qualification preceded activation, backed up the stopped owned profile and preserved its settings. The installed kernel reported active PID namespaces, network namespaces and seccomp-BPF sandboxing.

The installed pair passed **34 checks**: four installation/restart checks, seven native integration checks, nine extended API/archive/extension/calendar checks, seven proxy checks and seven separately reviewed UI checks. The native automation saved a checksum-verified **73,279-byte** archive. Normal Quit/restart preserved the enabled signed add-on, original owned profile and saved run. All owned applications stopped normally after qualification.

The UI review used the actual installed Browser and native embedded Workbench. It covered the original moth emblem, the saved native archive, Inspect's 14 ordinary fields, a native 4-thread/4-GB preset, restricted WebGL/font selectors and seeded offline audio through form → JSON → form. Cancel created no run. Disabling and re-enabling the idle add-on retained all three saved runs. The 1380×860 launch window and a real 1000×720 resize were reviewed; the form footer remained visible, and narrower navigation and run content used their intended scrolling. Parent and child screenshots were reviewed separately and their native host bounds matched.

The GPU-less server required explicit software rendering: `VESPER_GRAPHICS_BACKEND=software` selects ANGLE SwiftShader on Linux. The default headed backend failed to create WebGL contexts; that failed receipt remains retained. Software rendering passed the unchanged strict assertions and normal sandbox checks. It does **not** qualify a physical GPU or disguise the software renderer. Desktop users retain the native default unless they opt in.

A first software-rendered qualification completed the native/API/proxy checks but failed because its helper read the Workbench descriptor before restart finished. The corrected helper waits up to 120 seconds for the descriptor and matching authenticated capabilities. A fresh installed retry completed every check and separate UI review. No compiler rebuild was started and the native output cache was preserved.

This acceptance covers per-user portable installation and the bounded [native policies](native-kernel-qualification.md). Privileged Debian installation, arbitrary OS/GPU personas, WebGPU, realtime/device audio, complete font packs, whole-browser network leak prevention, comparative capacity and detection avoidance remain unqualified. The Windows user's installation remains 0.4.7 / 0.5.10 until its separate idle/backup upgrade gate passes.

Private receipts and screenshots remain local under `test-results/desktop` and `.workbench`. No installers, keys, profiles, credentials, archives or vendor binaries are published.
