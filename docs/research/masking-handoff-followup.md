# Fingerprint engine handoffs: evidence and remaining work

By **true-utopian**. Research date: 12 October 2026. This follows the earlier [Kameleo](kameleo-kernel-boundary.md) and [Multilogin/Dolphin](vendor-native-engine-followup.md) investigations. Findings come from installed application code and bounded, execution-free analysis. Private profiles, credentials and encryption keys were not inspected. Vendor code and analysis extracts are not distributed with Vesper.

## What this pass establishes

| Product | New observation | What remains unresolved |
| --- | --- | --- |
| Kameleo | Managed options creation and file output; a native stream/read path into an opaque transform and JSON-like parser; guarded shared options consumed by canvas/WebGL and audio paths. Bounded instructions show actual byte/sample changes and connect selected consumers to Canvas2D, PNG export, WebGL readPixels and audio channel APIs. | Runtime execution, exact managed/native filename equivalence, complete setting coverage, renderer/worker propagation and the intelligent-canvas branch. Transform constants and private payloads were not recovered. |
| Dolphin Anty | Cached API config output and launch; native file-read/parse path; hardware-concurrency setting stored in a navigator configuration and read by a bound native property callback, with host fallback. | Remote persona generator, controlled runtime enforcement, worker/client-hint consistency and the other masking surfaces. The CPU chain is static evidence, not an executed property test. |
| Multilogin | Canonical REA native assembly corroborates preparation and launch calls. Completed decompilation shows WebGL parameter serialization and argument preparation. Bounded DLL analysis connects hardwareConcurrency to a native integer service and response path. | Adapter-to-native-service configuration equivalence, service implementation storage, runtime enforcement and the other masking surfaces. Serialized WebGL parameters do not establish rendered-output masking. |

Dolphin's modules named `masking` implement log and sensitive-value redaction; that name must not be mistaken for the browser fingerprint engine. Its current installed shell has a different digest from the earlier analysed copy. This investigation keeps those identities separate.

## Reproducible analysis anchors

These identify application-code artifacts, not user data. Addresses are valid only for the corresponding digest.

| Artifact | SHA-256 | Bound or next investigation anchor |
| --- | --- | --- |
| Kameleo managed interactor | `a5b22721d7a198c821aba7ee9f40b0ccea5ce246d0b5add903633ed71fd2f310` | Options builder token `0x0600003c`; canvas producer `0x06005192`. Canonical REA evidence `ev_a51305d192c92c85b9d26db2af1631a205006ce486bd29ab24899be50edbc9be` is retained privately. |
| Dolphin cached local API | `a21b299d91064c2c4146bd857e4d43ee6a6cdd12d9d64fb4080556bcf2a6d67c` | Bounded PathResolver, start service and BrowserInstance source ranges. REA evidence `ev_c11f136a90a0ff02d763f102fbdf451da22daa7599b637c0238b3973530dd542`; the inter-method handoff is analyst interpretation of those ranges. |
| Dolphin native browser DLL | `f1825deb65b31cab0f10c4b388a0531530ee7f60a685ee59383239bc72c6259b` | Matching filename literal at `0x18f2b3b5a`; follow references into file reading, decoding and consumers. |
| Multilogin Mimic adapter | `d8ee8b75cc15aac0f21bb74e5325e263462468d3924c0e0fb217dad5ece16150` | Preparation `0x14075e4e0`, fingerprint preparation `0x14075f3c0`, WebGL parameters `0x140767dc0`, argument preparation `0x140770300`, browser launch `0x1407711c0`. These are table-derived entry candidates. |

The REA application traces did not establish all relationships automatically. Unresolved receivers and incomplete semantic coverage remain in the private evidence. Supplemental decoding and source inspection do not acquire a new canonical REA evidence identifier.

The native follow-up used digest-checked PE function ranges, decoded instructions and constructor-bound virtual-table slots, rather than treating matching strings as enforcement. Its private records preserve ranges and limitations. Kameleo's native DLL is bound to SHA-256 `42a47e8fd46b0a841be9aca4041c4c92ea1820cd8048614ac4f8130adbce56cf`; Mimic's native DLL to `e4ebc500dc0f61496dd9db2b5e9d821649312c36966f8815c53fdcd9f6363898`.

REA completed default Ghidra analysis of the Mimic adapter. Canonical evidence includes WebGL parameter handling (`ev_fdd69db3252a2e8149184cfe0c059f952db7aad5248b68a9a5103a718fe3948e`), argument preparation (`ev_2c651a56b84a88ab9c26cfb04838c22315a95d2d85ab895e1f581ed4d30370f3`), fingerprint-preparation assembly (`ev_aae429e0ff753f74bac92459e2a79856159e3f052ba853e9ee3099507d0a6637`) and launch assembly (`ev_0346baec7b08d7e7cd459b8a1b56af27db8caa808ad776b2467d93a2cf9cf3cb`). Top-level preparation decompilation failed on a Go multi-return signature; launch decompilation failed when its decompiler process exited. Assembly results remain usable, but these failures limit the pseudocode/data-flow claims. No import was restarted to conceal the failures.

An isolated REA **6.4.0** installation now admits native Windows DLL sessions. The older 6.3.0 DLL limitation described in historical reports should not be interpreted as the current tool's limitation. Admission alone is not decompilation: native results require completed Ghidra analysis. [REA Windows native analysis documentation](https://github.com/morluto/rea/blob/main/docs/windows-ghidra-p0.md).

## Original Vesper contract to implement

Vesper needs its own documented configuration contract rather than a vendor's encrypted format. The proposed launch envelope binds a schema version, profile ID, exact engine digest, configuration digest and sidecar manifest. It distinguishes each requested surface from settings consumed by the kernel and behavior independently verified by a fixture. Proxy passwords are excluded from that envelope and its receipts.

The kernel must reject an unsupported schema, stale sidecar or mismatched engine/configuration before navigation. A consumption receipt must be associated with the exact Workbench run and retained in its verified export. Acceptance must cover concurrent profile isolation, restart, Unicode paths, missing sidecars and interrupted launches. This contract is **proposed**, not an implemented or qualified feature.

The expanded [surface audit](../fingerprint-surface-audit.md) measures actual Canvas2D/WebGL 1/2 read-outs, independent PNG exports, audio read/copy consistency and cross-context contradictions. It provides a broader baseline for future native work. No vendor engine is claimed fully recovered; no roadmap fingerprint feature becomes complete from this research alone.
