# Native WebGL, audio and font policy

Vesper Browser 0.4.6 and Workbench 0.5.8 expose three optional native privacy controls. They require a qualified Vesper kernel; stock Chromium and Brave cannot satisfy these controls. Existing profiles keep their previous defaults.

| Control | Implemented scope | Remaining work |
| --- | --- | --- |
| Restricted GPU details | Disable `WEBGL_debug_renderer_info` in WebGL 1 and 2, including extension discovery and unsupported-enum behavior. | Pixel and shader identity, limits, WebGPU and internally coherent hardware personas. |
| Seeded offline audio | Project the three lowest sample mantissa bits using a persisted profile seed, channel and absolute frame. Apply once before offline completion delivery; retain shared buffer and copy semantics. | Realtime audio, device enumeration and broader DSP surfaces. |
| Restricted local fonts | Deny Local Font Access before permission prompts, hide local unique face discovery and restrict named font families to an essential allowlist. | System fallback, Unicode coverage and a distributable coherent font pack. |

## Passing checks

- Latest full source suite: 182 passing tests (39 Browser, 143 Workbench/root), zero failures and one optional external PostgreSQL test skipped. New regressions bind Linux shared libraries to native receipts, distinguish conditional input validation from schemas that need JSON, and retain relative module dependencies in immutable asset revisions.
- Standalone native C++ policy: 4,141 assertions pass. These cover sample stability, independent seeds/channels, chunk offsets, special floats, bounded changes and font-family parsing; they are not 4,141 browser features.
- Four modified Chromium translation units compile in isolation with the pinned native toolchain: WebGL extension discovery, offline audio completion, font cache and Local Font Access.
- Browser API tests check policy validation, persisted identity, restart/archive behavior and rejection without the required native receipt. Workbench's Inspect schema and profile mapping forward the same settings.
- The expanded first-script fixture runs on the bundled stock browser across eight contexts. Native admission correctly rejects that stock browser. This proves fixture execution, not native masking.
- Browser 0.4.6 and the signed Workbench 0.5.8 add-on passed 22 packaged Windows checks: six desktop/control checks, nine extended API checks and seven saved-proxy checks. This includes saving the three native settings and refusing an unqualified kernel. The production dependency audit recorded zero vulnerabilities.

## Native runtime acceptance

The Windows native browser compiled with the surface patch and canvas export-scope correction. All 26 native unit executions, nine direct cases and nine copied-runtime cases passed. Guarded activation in the actual installed Browser and Workbench passed seven integration checks and saved a verified archive. Installed restart/archive/import identity passed four additional checks. See the [qualification record](native-kernel-qualification.md). Neither isolated compilation nor source tests alone qualify a native binary.

Native acceptance requires unit tests, direct runtime checks, copied-runtime checks and installed Browser–Workbench integration. The runtime checks compare WebGL discovery/error behavior, offline sample reads/copies/events/restarts and independent seeds, and font metrics/local discovery against an upstream baseline. Each receipt must name the specific passing surface policies before those settings can launch.

The actual Browser 0.4.6 / Workbench 0.5.8 upgrade passed nine extended API checks, seven saved-proxy checks, Python scheduling and three native-input/refusal checks before native activation. Direct Windows review confirmed the moth mark, fitted profile table, embedded Workbench and saved proxy run, and the proxy editor. The subsequent native integration now proves enforcement of the bounded controls by the installed native binary. The installed Inspect dialog still falls back to JSON for its conditional schema; the source correction requires separate packaging and installed acceptance.

The source Inspect form and its form/JSON round-trip passed a separate browser UI check. The new Linux inventory verifier passed three checks on Ubuntu, including shared-library symlinks, tampered/missing libraries and outside-directory rejection. These are not native enforcement or installed-package proofs.

The release audit requires all nine native fixture cases and the three surface capabilities in direct and copied receipts, plus those capabilities in installed integration; an older scalar/canvas receipt cannot complete these gates. PowerShell UTF-8 receipts with a byte-order mark are accepted without ignoring their recorded state. An isolated Ubuntu build account has passed 177 public-source tests and 4,141 standalone assertions and fetched the pinned Chromium source. Linux runtime, sandbox, copied-runtime and installer acceptance remain pending. No complete vendor masking parity or detection-avoidance claim is made.
