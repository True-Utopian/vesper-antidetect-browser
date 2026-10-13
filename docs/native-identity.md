# Native identity policies

Vesper Browser 0.4.8 and Workbench 0.5.11 add bounded native hardware presets and an observed-page consistency report. They retain the actual Chromium version, OS, client hints, screen and GPU. They do not supply a database of invented device fingerprints.

| Preset | CPU threads | Device memory | Other identity surfaces |
| --- | --- | --- | --- |
| `custom` | Manual or native | Manual or native | Existing profile controls |
| `native` | Native | Native | Native version, OS, display and rendering |
| `desktop-4` | 4 | 4 GB | Native version, OS, display and rendering |
| `desktop-8` | 8 | 8 GB | Native version, OS, display and rendering |

Choose Vesper native kernel, then Environment → Hardware identity in Browser. Workbench's Inspect form exposes the same presets. Native presets require Vesper. Conflicting CPU or memory overrides, synthetic screen dimensions and disabled WebGL are rejected. Custom settings retain individual controls. Existing profiles stay custom until explicitly changed.

An API create request can use:

```json
{"name":"Local QA","engine":"vesper","identityPreset":"desktop-4","locale":"en-GB","timezone":"Europe/London"}
```

`GET /api/v1/identity/presets` lists the presets. `GET /api/v1/profiles/{id}/environment` inspects the first existing HTTP/HTTPS tab, falling back to the first tab; it does not navigate a site. The report compares kernel and UA major version, full-version client hints, native platform, configured CPU/memory, language, formatting locale, timezone and viewport fit. Missing secure-context or permissions-policy hints are marked unavailable. An observed-page pass does not qualify workers or HTTP headers.

`GET /api/v1/profiles/{id}/fingerprint` distinguishes requested policy, selected-kernel qualification and an active launch owned by the controller. A stopped profile has no active protection. The report reads the saved qualification receipt; complete binary/runtime hashes are verified at launch, not on every report request. The TypeScript client supplies `identityPresets()`, `environmentReport(id)` and `fingerprintReport(id)`; leased requests still require matching ownership.

The optional policies cover RGBA8 Canvas 2D exports, WebGL debug renderer exposure, completed offline audio, and bounded installed-font discovery. They do not replace GPU rendering or WebGPU identities, cover realtime audio or media-device enumeration, or implement arbitrary OS personas. Full fingerprint-family roadmap gates remain pending.

Linux hosts without a working GPU can launch the desktop with `VESPER_GRAPHICS_BACKEND=software`. This explicitly selects ANGLE SwiftShader for owned browser processes and preserves the sandbox. The default continues to use the browser's native rendering selection. Software rendering is not hardware GPU impersonation; its renderer can remain observable. The JavaScript embedding accepts `graphicsBackend: 'software'` on Linux and rejects this option on other platforms.

Run `node scripts/qualify-native-identity.mjs --manifest <qualified-bundle>/vesper-kernel.json` from Workbench source after building it. It creates fresh stores and loopback fixtures, verifies the complete native bundle, and checks both hardware presets in first scripts, a frame, a dedicated worker, HTTP UA/memory/version headers, restart/archive retention and an actual Inspect run with verified archive. Its receipt deliberately sets installed proof false: source integration with an installed kernel is not installed desktop acceptance.
