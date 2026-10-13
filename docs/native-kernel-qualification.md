# Windows native kernel qualification

By **true-utopian**. Verified locally on 13 October 2026.

The pinned Chromium 157.0.8100.0 kernel compiled successfully with the four original Vesper patches. The actual Browser 0.4.6 installation and Workbench 0.5.8 add-on now admit this qualified kernel for profiles that select the Vesper engine. Existing profile settings remain unchanged.

| Gate | Observed result |
| --- | --- |
| Native compilation | Passed; compiled executable digest checked again before qualification and activation |
| Native unit tests | All 26 executions passed with zero-failure XML results |
| Direct runtime | All nine cases passed, covering first-script page, frame, worker, extension and popup observations; restart, independent seeds and malformed-input fallback |
| Copied runtime | All nine cases passed against a fresh runtime copy; component and resource inventory verified |
| Installed activation | Fresh host qualification and backup of 22 stopped profiles completed before activation |
| Browser–Workbench integration | Seven checks passed; the native Inspect run finished and saved a checksum-verified 76,436-byte archive |
| Installed persisted identity | Four checks passed: canvas/offline-audio identity survives restart and archive/import, fresh profiles differ, and original profile metadata stays intact |

The copied-runtime failure was caused by inherited Windows directory permissions: Chromium's restricted application-container subprocess could not read/execute its copied program. Packaging now prepares read/execute inheritance for restricted application packages on a fresh, empty binary directory. It does not grant write access, alter profile permissions, disable the sandbox or overwrite an earlier runtime. Failed copies remain available locally for inspection.

## Qualified scope

Native hardware concurrency, supported device-memory buckets and memory HTTP client hints, deterministic RGBA8 Canvas2D read/export behavior, WebGL debug-renderer restriction, seeded completed offline audio, and bounded local-font discovery restrictions passed the owned fixtures. Canvas exports from WebGL 1/2 retain their native pixel/readback agreement.

This does not qualify full GPU/shader/WebGPU identity, realtime audio or device identities, system Unicode/font fallback isolation, a coherent font pack, arbitrary browser/OS personas, whole-browser network leak prevention or detection avoidance. Those roadmap checks remain open. Real Linux compilation, sandbox, copied-runtime and installer acceptance remain separate gates.

Private receipts are retained locally at `test-results/native-kernel/qualification.json`, the qualified runtime's `native-qualification.json`, `test-results/native-kernel/installed-native-integration.json`, and `test-results/native-kernel/installed-native-identity.json`. No runtime binaries, credentials, profile archives or raw private reports are published with this source update.

## Bundled installed engine — Browser 0.4.7 / Workbench 0.5.9

The actual installed application now uses its own qualified `resources/vesper-kernel/chrome.exe`, with the sandbox enabled. Each full Windows installer passed nine native cases on its copied runtime. After the guarded upgrade, fresh nine-case qualification and stopped-profile backups preceded activation. Seven installed integration checks and four restart/archive identity checks passed. The native run saved a verified 76,518-byte archive. Inspect ordinary fields and form/JSON switching are installed and directly reviewed. Full source checks passed 191 tests. [Detailed acceptance](validation.md#bundled-native-windows-release-13-october-2026). Broader masking and real Linux execution remain pending.
