# Kameleo desktop findings

Research date: 10 October 2026. This is an evidence ledger for the independent Vesper Browser and Vesper Workbench design. It records what this particular installed package exposes; it does not establish complete behavior, detection parity, or performance superiority.

## Target and method

The target is the installed `Kameleo/resources/app.asar`, SHA-256 `bad1857aa484fe7f75552d43eb05a8637edd2258f213bb2c043e3cebb28acd9d`. The existing complete REA 6.3.0 JavaScript analysis was reused rather than analyzing the package again:

- Parent evidence: `ev_107c71c96c9ba0aeddfaaf6bd9a3d237e70663f209230d935862093da5d61be4`.
- Private portable record: `.workbench/research/kameleo-electron.json`, 668,490,102 bytes.
- Application graph: 33,679 nodes and 69,046 edges. Its coverage is partial; no package integrity contradictions were reported.

The follow-up used REA's streaming JSON reader, `inspect_analysis_view`, and exact literal `trace_application_feature` requests against the complete original Evidence. The initial module-path selector was rejected because many bundled module identities share the same source path. The corrected requests select exact source-module node IDs. No package bootstrap code was executed. Targeted ASAR-member inspection used a format-aware reader and verified member digests against REA observations; it did not launch the vendor application or read user profiles.

## Findings

| Question | Established evidence | Interpretation and boundary |
| --- | --- | --- |
| How does the desktop renderer reach native desktop helpers? | `main.preload.js` exposes an `electron` bridge; literal invocations include `start-engine`, `save-profile`, and `get-export-profiles-options`. Corresponding literal handler observations exist in `main.js`. | A narrow desktop bridge is packaged. REA observes static syntax and infers channel pairing; it does not prove registration or invocation in a running app. |
| Is the desktop shell the browser/profile engine? | The `start-engine` handler calls a separate service. The packaged service constructs an executable path for `Kameleo.Engine.exe`, spawns it with the engine directory as its working directory, and configures hidden/detached execution on Windows. | The inspected desktop code separates presentation and engine lifecycle. This does not reveal the native engine's browser patches or prove its runtime process topology. |
| How is engine readiness represented? | Packaged code performs loopback HTTP requests with a three-second request timeout, health checking, bounded polling, an already-running branch, and a connect/restart choice. | Reachability, readiness, ownership and failure are separate concerns. Their actual timing and failure behavior still need controlled runtime observation. |
| Does `save-profile` prove browser-state persistence? | The handler opens a JSON save dialog and writes supplied content. The preload invocation is at line 152; the matching main handler spans lines 417–426. | It establishes a file-save helper. It does **not** establish the engine's `.kameleo` archive format, cookie persistence, database layout, encryption, or synchronization behavior. |
| What does the export-options helper do? | It selects a directory, enumerates existing filenames, and returns folder/export-path metadata. Preload line 145 matches main lines 449–471. | Desktop selection and naming are visible. Archive serialization remains in a separate boundary and is not established by this helper. |
| What is known about proxy routing? | The Electron shell's packaged command-line setup disables proxy use for the shell. The application graph also contains proxy-related endpoint candidates. | Shell configuration must not be confused with profile-browser routing. Upstream authentication, DNS handling, WebRTC, QUIC and fail-closed behavior are not proved by those strings or by the shell switch. |

Member identities used for corroboration:

- `client-gui-electron/main.js`: SHA-256 `90b76d05dde36ccc4ac570df899dd7cccf07f303369a51f649ce3869b2fb5a15`; source-module node `jag_node_fd53782788299b385cc441f0263aa49113cefbab3fcf8f7f21c132da9e4e3114`.
- `client-gui-electron/main.preload.js`: SHA-256 `37e3663ae40ddded24e22e85bb689abeba62870ff091c6b1de45f41fdf4a84cd`; source-module node `jag_node_e1597475a02b4f25c0fe42427ab075cdc88c8485c0f46f8e2ec06917cc5f9aeb`.
- Authenticated main-module view: `ev_acb9bc14e4200e7c77108211e365c19e19c51963b8a14fbbe2f674226a6e9ea2`, private record `.workbench/research/kameleo-module-main.js.json`.
- Authenticated preload-module view: `ev_59d3c0a4b13d98cf0c60ceb9a4c3ee15e7884607489830d7c2360e2875e283b6`, private record `.workbench/research/kameleo-module-main.preload.js.json`.

## Focused REA trace ledger

Exact channel seeds avoid broad textual guesses. An outgoing traversal from these channel nodes terminates at the node itself: the three successful results each contain one node, two observed facts and zero edges. This is useful evidence about the literal channel, but cannot be presented as an end-to-end GUI-to-engine trace. Incoming traversals are the follow-up for calling/handling relationships.

| Exact seed | Outgoing trace evidence | Scope |
| --- | --- | --- |
| `save-profile` | `ev_ebb99ec191bb27d86b4bfc6d9156fd97bf6e94d0eacf02995f2518ac398ef224` | Preload invocation and main handler observations; static only. |
| `start-engine` | `ev_2cf06a6ae57d79f60f506fe0502809b2a9c29d51dff4681ab4783e733f13e868` | Preload invocation and main handler observations; native engine execution remains outside this trace. |
| `get-export-profiles-options` | `ev_fddc629fd174dfb5a09bfa4e9a9a545dc8ee1ec0db118e4cdc27662217bb7a41` | Preload invocation and main handler observations; serialization remains outside this trace. |

The incoming traces each recover 14 nodes and 20 edges, with 24 observed and 12 inferred facts. They connect packaged assets, the configured preload, the literal channel and its handler. In the startup trace, edge `jag_edge_83c92218eee974aefcfba18be54a2a9bbe41175bd727d1946252d930b3671f51` pairs the preload asset with the main handler using `unique-exact-literal-channel`. The zero native-handoff count means the native engine implementation is not covered by these traces. A reported zero unknown-fact count in this selected subgraph does not override the parent graph's partial coverage.

| Exact seed | Incoming trace evidence |
| --- | --- |
| `start-engine` | `ev_201216f4e639ac7efd4135f1a78a3c657bb32f80a5c330d5bf59e9f3ad9fe744` |
| `save-profile` | `ev_2e00427bfde93388fc574cb0d915dae4a4f899454928a7eb03d5a519a58e2bea` |
| `get-export-profiles-options` | `ev_a4514e16caf00d88ca0b39786870268a09b798ce76ae448704fd5b197c73234f` |

### Candidate inventory qualification

The recorded graph includes 53 storage nodes, 16 with observations located in packaged frontend bundles, and 82 endpoint candidate nodes with observations located in desktop/frontend files. Bundle locations also contain dependency code, so those counts are not counts of first-party features.

Recorded route literals include create/update profile, advanced profile settings, folders, automation, default settings and VNC. They establish packaged route declarations, not available screens or successful actions. The only named storage key in this selected inventory is `theme`; many storage observations have unresolved key names. No account or browser-profile data was read.

Some endpoint candidates are form-control lookups such as `form.get("proxy")`, and others are HTTP method names. They must not be treated as network URLs. Targeted main-member inspection corroborates `/general/healthcheck`, `/general/terminate` and `/auth/status` as paths passed to the loopback request helper. The proxy-form candidates locate a relevant UI area, but do not prove proxy authentication, transport routing or leak protection. The compact private index is `.workbench/research/kameleo-storage-endpoints.json`, linked to the original parent evidence above.

### Semantic provenance and residual gaps

REA's companion semantic graph was queried rather than assuming the application graph proved data flow:

| Query against the complete original package Evidence | Result and evidence |
| --- | --- |
| Startup literal, backward provenance | Partial; no retained seed match; 15,651 relevant unresolved object-flow frontiers. `ev_c082c6b871a99f9727ce4c06e3f2eb2b49159b5cbf0a179c9cfd8c6c05c673b1`. |
| Health-check path literal, forward influence | Partial; no retained seed match; 15,651 relevant frontiers. `ev_9d321f448aec2e27cfa8773a1a2ab506dd401fd9b84047dec13969186ce9be4c`. |
| `proxy` property, backward provenance | Ambiguous; five property slots in two GUI bundles, four functions, zero resolved provenance relations and 15,656 frontiers. `ev_14a2ec5a3a8ce2d62ce789e1ef99df3146d8e8fb728252df81fc516e4d95d593`. |

The proxy result locates `/proxy`, `/form/controls/proxy` and `/profileData/proxy`. Their values and presence coverage remain unknown. The unmatched literal queries cannot negate the literal observations already present in the application graph or the inspected member text. These are explicit limits of this retained semantic coverage.

A narrower follow-up analyzed four selected inert members: the actual package descriptor, `index.js`, main and preload. These files were extracted into the private `.workbench/research/kameleo-shell-members` directory. Main/preload digests were checked against the original Evidence before extraction. The selected directory is a **different target**, SHA-256 `92d32a4606e85fd6da88f0ce42b94c863fc2a19a148b5ba03d876f650d380d05`, and must not be substituted for the whole ASAR.

- Focused analysis: `ev_fe93331a68b55b5e3fd4dfb60c1dcacd16cd4216441510beeb1589c4810dfe8b`, private record `.workbench/research/kameleo-focused-shell-analysis.json`.
- Exact `fetch` semantic node at main line 755: `jsrg_node_3542fcda24ece1111085bafcea77e9882e1b2db9c02f7a0dfbcacbd11090bc86`.
- Backward provenance: `ev_ca471dfd874e1ea2649f10c5d0f2fac0b87dd1bc03eeed13c1f234bcbd073694`. Three nodes and two resolved relations link the method parameter at line 753 to the request's method field. Method value and dynamic request resolution remain unknown; overall status is ambiguous.
- Forward influence: `ev_260797867e008607906d7842f2fa11ca5bde08adc9a2ab104c03c3a9a226c88a`. The selected request is found, but no downstream relation was retained and one request-resolution frontier remains. This does not prove a successful response.

The focused companion graph reports unknown overall coverage. Webpack import/member resolution and missing dependencies still prevent a complete child-process/HTTP trace. Exact-node selection exposes a small verified provenance relationship; it does not turn unresolved engine calls into proven execution.

Private reproductions use `.workbench/research/kameleo-channel-traces.mjs`, `.workbench/research/kameleo-incoming-traces.mjs`, `.workbench/research/kameleo-semantic-research.mjs` and `.workbench/research/kameleo-focused-request-traces.mjs`. They import REA's packaged workflow implementation and preserve its Evidence output. Their cached package path is machine-specific; they are research helpers, not product dependencies. The original full JSON remains authoritative for the package. Small seed summaries are indexes, not substitutes for authenticated Evidence.

## Consequences for our original design

Vesper Browser should own browser/profile state and expose a small, versioned local contract. Vesper Workbench should consume that contract for automation, inspection and scheduling. A browser profile must remain usable when the workbench is closed. A run should acquire a profile lease, report startup progress, and distinguish a busy profile, an unreachable engine, an unready browser and a failed proxy.

The desktop architecture suggests testable product requirements, not code to copy. Our implementation should use its own process ownership checks, state transitions, archive schema and user interface. The current local backend already has independent profile directories, encrypted proxy credentials and recovery records; separate packaging and reliable ownership across two clients remain work to qualify.

## Coverage still open

| Required question | Current status | Evidence needed next |
| --- | --- | --- |
| Desktop bridge and engine lifecycle boundary | Partially answered | Controlled runtime startup/shutdown and crash scenarios on a disposable profile; corroborate static paths. |
| Complete GUI-to-engine profile create/update/start/stop flow | Partially answered | Focused renderer API-service semantics and native dispatch traces, then controlled runtime outcomes. |
| Archive/state persistence and cross-profile isolation | Unresolved for Kameleo internals | Native archive/storage analysis and round-trip tests using synthetic state. |
| Profile proxy routing and transport leaks | Unresolved | Controlled HTTP/SOCKS proxy fixtures and packet/routing observations; distinguish app-shell traffic from profile traffic. |
| Fingerprint coherence, browser kernels and actual masking behavior | Unresolved | Native/browser-kernel evidence and a surface inventory covering initial navigation, frames, workers and service workers. |
| Performance and reliability advantage | Unresolved | Same hardware, workloads, engine versions and concurrency; publish distributions and failure rates. |

The broader [inspection record](../kameleo-inspection.md) contains the native executable identity. Electron analysis alone cannot answer native engine, kernel or fingerprint-corpus questions. This report includes no vendor implementation or recovered source for distribution.
