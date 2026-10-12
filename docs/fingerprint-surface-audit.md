# Fingerprint surface audit

By **true-utopian**. This original Workbench-side diagnostic observes a selected browser executable on an owned loopback fixture using a disposable profile store. It does not change browser identity, open existing profiles, request device permissions or implement masking.

From the Vesper Workbench checkout:

```text
node scripts/fingerprint-surface-audit.mjs --executable <owned-browser-executable>
```

The local report is written to `test-results/fingerprint-surfaces/observations.json`. It includes the executable SHA-256, observations, HTTP headers, mismatches and limitations. Raw host observations stay local and are excluded from source publication.

| Observation | Context coverage |
| --- | --- |
| UA, low/high entropy client hints, platform, languages, CPU, memory and timezone | Initial document, same-origin frame, cross-origin frame, dedicated/shared/service workers, reload and browser restart |
| Actual Canvas2D read-out and repeat read-out | Supported document and OffscreenCanvas contexts |
| WebGL vendor/renderer metadata and texture limit | Supported document and worker contexts; this does not measure graphics rendering equivalence |
| WebGPU adapter metadata, features and texture limit | Where available; missing support is recorded |
| Offline audio read-out and text measurements | Where supported; font measurements use five families and are not a complete font inventory |
| Screen values and media-device exposure | Observed where available; no device identifiers or labels are collected |
| HTTP UA and low-entropy client hints | Loopback requests compared with initial document values |

Diagnostics compare supported values between contexts and lifecycle points, detect HTTP/JavaScript contradictions and check Chrome's UA major against its Chromium brand. Optional APIs that are unavailable do not receive invented results. The report remains `observed` even with zero mismatches, and `nativeProof` is always `false`.

The 12 October baseline ran against the existing upstream Chromium runtime: **eight contexts, zero diagnosed mismatches, no fixture errors**. This does not qualify Vesper's compiling custom kernel, headed screen behavior, masking policies, coherent persona generation, complete surface coverage, proxy/network leak prevention or vendor parity. The fixture records screen/media exposure but does not yet assess their complete consistency. WebGL/WebGPU metadata does not establish masking of rendered output.

Five source regressions cover consistent observations without native promotion, worker/graphics contradictions, HTTP/client-hint contradictions, absent optional APIs and changed canvas read-outs, and a Chrome identity that is internally contradictory despite matching across contexts. The complete source check passed **164 tests**: 29 Browser and 135 Workbench/root, with no failures and one optional external PostgreSQL test skipped.

Native acceptance still requires the separate build, native unit, direct runtime, copied runtime and installed Browser–Workbench gates described in [completion gates](research/completion-gates.md).
