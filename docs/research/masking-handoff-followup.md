# Fingerprint engine handoffs: evidence and remaining work

By **true-utopian**. Research date: 12 October 2026. This follows the earlier [Kameleo](kameleo-kernel-boundary.md) and [Multilogin/Dolphin](vendor-native-engine-followup.md) investigations. Findings come from installed application code and bounded, execution-free analysis. Private profiles, credentials and encryption keys were not inspected. Vendor code and analysis extracts are not distributed with Vesper.

## What this pass establishes

| Product | New observation | What remains unresolved |
| --- | --- | --- |
| Kameleo | A managed options builder serializes the constructed Chroma options object, passes the resulting string into an encryption boundary, then writes it beneath the selected profile folder. A separate canvas producer removes an old sidecar and conditionally writes a new one immediately before options generation. | Exact opaque filenames and switches; native reader/decoder; individual masking algorithms; propagation into renderers and workers. The write path is static evidence, not proof of a successful vendor launch. |
| Dolphin Anty | The actual cached local API was identified separately from the Electron shell. Its shipped source takes config and command from a remote start response, writes config to `Default/User Preferences`, and launches Anty with command-derived arguments. | The remote generator, config decoding, native setters and actual read-out behavior. A matching filename literal in the native DLL is an investigation seed, not a proven reader. |
| Multilogin | A structurally validated Go function table in the installed adapter identifies fingerprint preparation, WebGL parameter, argument preparation and browser-launch entries. | Native call edges, serialized handoff, native Chromium consumers and controlled runtime behavior. Function names alone do not prove masking. |

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

An isolated REA **6.4.0** installation now admits native Windows DLL sessions. The older 6.3.0 DLL limitation described in historical reports should not be interpreted as the current tool's limitation. Admission alone is not decompilation: native results require completed Ghidra analysis. [REA Windows native analysis documentation](https://github.com/morluto/rea/blob/main/docs/windows-ghidra-p0.md).

## Original Vesper contract to implement

Vesper needs its own documented configuration contract rather than a vendor's encrypted format. The proposed launch envelope binds a schema version, profile ID, exact engine digest, configuration digest and sidecar manifest. It distinguishes each requested surface from settings consumed by the kernel and behavior independently verified by a fixture. Proxy passwords are excluded from that envelope and its receipts.

The kernel must reject an unsupported schema, stale sidecar or mismatched engine/configuration before navigation. A consumption receipt must be associated with the exact Workbench run and retained in its verified export. Acceptance must cover concurrent profile isolation, restart, Unicode paths, missing sidecars and interrupted launches. This contract is **proposed**, not an implemented or qualified feature.

The new [surface audit](../fingerprint-surface-audit.md) measures actual read-outs and cross-context contradictions. It provides a broader baseline for future native work. No vendor engine is claimed fully recovered; no roadmap fingerprint feature becomes complete from this research alone.
