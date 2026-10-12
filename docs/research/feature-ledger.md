# Vesper research and feature ledger

By **true-utopian**. Updated 11 October 2026.

The [completion gates](completion-gates.md) separate the installed desktop pair from newer local source changes, and list the unfinished work required for a complete product. The native Chromium build is running; it is not qualified or active.

This is a requirements inventory and evidence index for Vesper Browser and Vesper Workbench. It is not a claim of exhaustive vendor coverage, complete reverse engineering or product superiority. The reference applications are studied locally with REA; original product code remains separate from private research output.

## Reference coverage

| Reference | Scope established | Remaining scope |
| --- | --- | --- |
| Kameleo | Desktop ASAR analyzed by REA; shipped API contract inspected; engine PE identity and a managed Chroma interaction assembly recorded | Native kernel behavior, runtime lifecycle, fingerprint generation and policy enforcement |
| Multilogin | Installed desktop PE identity; native CLI functions decoded with REA; Go metadata candidates corroborated; profile-start command, request builder and response-wrapper boundaries | Wrapper's dynamic dispatch, desktop lifecycle, patched browser behavior, runtime storage and masking |
| Dolphin Anty | Public installer inspected without execution; authenticated ASAR/member hashes; bounded REA shell graph and exact `downloadLocalApi` IPC listener trace | Separate local API, native kernel, runtime lifecycle and fingerprint enforcement |
| Vesper | Independent Browser package, Workbench integration, real Chromium lifecycle and synthetic observations | Complete routing capture, environment consistency under all target types, Firefox/mobile implementations and comparative benchmarks |

The [Kameleo inspection record](../kameleo-inspection.md) contains prior static evidence identifiers and limits. The [desktop findings](kameleo-desktop-findings.md) record exact IPC traces, authenticated member identities and scoped semantic provenance. The [kernel interaction report](kameleo-kernel-boundary.md) records a focused managed assembly boundary and CIL call anchors. All raw observations, source-bearing evidence, analysis tools and vendor decompiler output stay under private gitignored `.workbench/research`.

The [Multilogin native findings](multilogin-native-findings.md) distinguish REA-decoded calls from supplemental Go metadata names and document the unresolved dispatch boundary. The initial unsupported symbol parser did not end the study: bounded candidate recovery and native instruction/xref validation established a real portion of the CLI launch contract.

## Documented feature inventory

Kameleo's public [profile lifecycle and settings reference](https://developer.kameleo.io/tutorials/managing-profiles/) and [fingerprint model](https://developer.kameleo.io/concepts/fingerprints/) inform the first column below. These are vendor-described behaviors, not local proof of their internals. Their configurable areas include profile lifecycle, proxy, locale, rendering, hardware, geolocation, extensions and storage.

Multilogin's public [profile tools](https://multilogin.com/help/en_US/browser-profiles), [fingerprint settings](https://multilogin.com/help/en_US/browser-profile-setup/profile-settings-fingerprint-section), [templates](https://multilogin.com/help/en_US/browser-profile-tools/profile-template-manager), [storage options](https://multilogin.com/help/en_US/browser-profile-setup/cloud-and-local-storage) and [automation tools](https://multilogin.com/help/en_US/api) supply additional reference workflows. Local storage, independent template instances, rendering options, extensions, cookie tools and automation integrations are documented capabilities; installed behavior still needs corroboration.

| Requirement family | Vesper Browser today | Vesper Workbench today | Acceptance gap |
| --- | --- | --- | --- |
| Create, edit, launch, stop | Implemented; revisions and durable run leases | Native shell, dashboard and versioned authenticated API | Broader lifecycle stress and capacity qualification |
| Persistent profiles | Separate Chromium user-data directories | Ownership and verified archive handling | Broader IndexedDB, workers and cache isolation |
| Duplicate, import, export | Independent archive format; proxy cleared on copy | Upload and download controls | Cross-PC encrypted cookies; migration policy |
| Delete, trash, restore | Reversible stopped-profile trash; leased/running records protected | Full Browser manager opens from native Workbench | Retention expiry and permanent deletion policy |
| Folders, tags, notes, search | Metadata editor, filters and bounded bulk controls | Run filters and shared Browser manager | Large inventory performance |
| Profile templates | Revisioned independent snapshots; proxy credentials excluded | Shared manager and resolver hooks | Broader template migration |
| Authenticated proxies | HTTP and SOCKS5 bridges | Inventory, policy and health probes | Whole-browser DNS/UDP capture and outage tests |
| Locale and timezone | Standard controls; first-script cross-site frame regression fixed | Profile editing | Popup initialization, service workers and all target types |
| Screen and viewport | Screen/viewport/device scale controls and observed report | Shared manager | Brave rounds owned-site dimensions; popup/all-target consistency |
| WebRTC policy | Non-proxied UDP disabled for proxied profiles | Backend configuration | Verify candidate and network behavior; no masking-parity claim |
| Geolocation and permissions | Coordinates, accuracy and native context permission | Shared manager and API | Every origin/target qualification |
| Browser identity and client hints | Real Chromium/Windows identity | Unsupported vendor settings rejected | Original coherent persona design and engine validation |
| Canvas, WebGL, audio, fonts | Installed: native Chromium surfaces and optional upstream Brave. New source: original RGBA8 canvas patch awaiting compiled proof | Native candidate staging and qualification in source | WebGL/WebGPU, audio, fonts, media and full coherence remain unfinished |
| CPU, memory and media exposure | Installed: CDP CPU policy. New source: immutable native CPU/memory flags and HTTP memory client hint patch | Native-only memory editor and API in source | Custom binary proof pending; stock-engine workers retain native CPU; media/device modeling unfinished |
| Firefox and mobile environments | Pending | Adapter boundary available | Original engine implementation; device testing |
| Extensions and start pages | Installed: local immutable MV3 ZIP catalog, permission display, assignments and portable profile copies | Actual installed 0.4.2/0.5.4 pair passed startup worker, content script, persistent storage and checksum-verified export/import | Broader compatibility, removal and version storage migration |
| Cookie import/export tools | Strict JSON schema and lease protection; profile archives | Shared manager | Cross-PC cookie decryption; session cookies may expire on restart |
| Local/cloud profile storage | Local only; independent owner and private discovery | Persistent embedded coordinator; optional external PostgreSQL | Multi-node local coordination qualification; no vendor cloud dependency |
| Team roles and sharing | Pending | Single administrator token | Accounts, roles and explicit profile sharing |
| Puppeteer automation | Lease-protected local CDP; TypeScript/Python clients | Trusted scripts and durable flows; TypeScript/Python clients | Additional SDK/framework qualification |
| Batch and scheduling | Capacity limit and bounded bulk operations | Installed timezone-aware calendar rules and London DST wall-time lifecycle passed; encrypted-input schedules, missed-interval coalescing and admission quarantine | Wakeup, sustained-load and capacity benchmarks |
| Browser updates | Pinned Chromium/Brave staging, verification, stopped-profile backups | Signed offline installer selection and data backup | Hosted feed, automatic rollback and full updater-cycle qualification |
| Visual flow editor | Shared engine policies | Graph/layout, structured inspector, undo/redo, draft revisions, validation and immutable publication | Rich branching/recognition controls still require advanced JSON |
| Mobile app/cloud phones | Pending | Pending | Local device/emulator integration; browser emulation is insufficient |
| Desktop applications/installers | Windows full installer; Linux light packages | Independent partner installer with packaged runtime | Unsigned development release; native Linux and AppImage qualification |
| Public API contracts | Versioned OpenAPI, revisions, leases and cursor replay | Versioned OpenAPI, idempotent admission and run recovery | Schema coverage across additional clients and durable Workbench event replay |

## Independent improvements to pursue

These are Vesper's design choices, not inferred vendor internals:

- Publish repeatable observations of supported settings, including their limits, alongside each browser build.
- Give profile storage and automation orchestration separate public APIs and independently buildable packages.
- Connect both applications to one Browser-owned store through the authenticated client; retain embedded operation for a single Workbench.
- Preserve failure evidence and original profiles when saving or browser shutdown cannot be confirmed.
- Measure startup, export and concurrency resource usage before tuning performance.
- Keep the core workflow usable offline with local fixtures; proxies remain operator-supplied.

## Open research questions

| Question | Evidence needed | Status |
| --- | --- | --- |
| How does the desktop delegate launch and profile export? | Exact IPC/function traces and controlled runtime observations | Partially answered for Kameleo desktop; native investigation ongoing |
| Where do browser settings cross into the engine? | Typed settings, function references and browser observations | Public contracts known; enforcement unresolved |
| Which settings remain stable across launches and upgrades? | Repeated same-profile observations on owned fixtures | Vesper persistence checked; vendor comparison unresolved |
| What happens if an upstream proxy disappears? | Local test proxy, request traces and packet capture | Vesper fixture blocks origin navigation without direct fallback; browser-wide guarantee unresolved |
| What is the measurable performance difference? | Same-machine repeated controlled workload | Vesper single-run observations available; comparative result absent |

The next completed research pass must update these statuses with specific evidence IDs, target hashes, search boundaries and residual unknowns. A string match is a lead; a static function trace is an inference about implementation; a controlled run qualifies only its measured scenario.
