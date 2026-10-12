# Profile workspace and plugin boundaries

Research date: 11 October 2026. Scope: the user's supplied Kameleo and Multilogin screenshots, existing REA artifact evidence, and focused static profile-route traces. These findings guide an original Vesper Browser interface and an optional Vesper Workbench plugin, both by true-utopian. They do not establish complete reverse engineering or native fingerprint parity.

## Evidence boundaries

Screenshots establish visible controls and layout at capture time. They do not establish that an action succeeds, how profiles are stored, what a proxy routes, or what a browser kernel enforces. The capture titles say Kameleo 5.3.0 and Multilogin 12.15.0; they are not version identifiers for independently analyzed binaries.

| Screenshot | SHA-256 | Visible evidence |
| --- | --- | --- |
| Kameleo profile workspace | `bffe0d8b6c671bda20fdf3027b887226573631cb12b2f6184d8f48d363046c61` | Navigation, search, selection, configuration/proxy/state columns, row launch and overflow menu |
| Multilogin profile workspace | `ae394c0435e108104a44b530984fa4c35f5672fb40a6ffccbaa31a15551d7334` | Running/favorites/folders/trash navigation, table, bulk toolbar, notes/tags/storage, pagination |
| Multilogin row menu | `afb0631d5c3472e8ce00aa2585c12040c0e3aa087a54c48ca1bbf7b90713e376` | Action names, grouped menu, and keyboard shortcuts |

The screenshots remain private in the user-supplied clipboard files. Their paths, dimensions, and hashes are indexed in `.workbench/research/profile-workspace-screenshots.json`. No account values from their rows are reproduced here.

The Kameleo package identity remains SHA-256 `bad1857aa484fe7f75552d43eb05a8637edd2258f213bb2c043e3cebb28acd9d`. Existing REA evidence `ev_107c71c96c9ba0aeddfaaf6bd9a3d237e70663f209230d935862093da5d61be4` was reused through REA's streaming reader and authenticated workflow implementation. The parent graph has partial coverage. No vendor application, bundle bootstrap, or user profile was executed or read.

## What the screens require

Both screenshots give most of the available area to the profile list. Profiles are the primary workspace. Persistent navigation and a compact action bar surround that list; configuration belongs to the selected profile or a dedicated editor.

| Area | Observed affordance | Original Vesper requirement |
| --- | --- | --- |
| Navigation | Profiles, running profiles, favorites, folders/groups, settings; Multilogin also shows trash | Persistent navigation with real counts and a clear active location |
| Main workspace | Selectable table rows, search, toolbar, inline launch and row menu | A dense, readable profile table with selection, search, sorting, and row actions |
| Profile identity | Name, browser/version/OS configuration, proxy, state | Show identity and launch readiness together; expose actual configured engine and proxy state |
| Organization | Storage, folder, notes, tags, favorite star | Persist editable folder, notes, tags, and favorites locally; label storage capabilities accurately |
| Bulk work | Selection checkboxes and toolbar actions | Apply start, stop, move, export, and trash operations to selected IDs with per-profile outcomes |
| Collection scale | Selection/total footer, page size, pagination, column control | Show visible/selected totals, configurable columns, and reliable access to large collections |
| Editing | Edit, rename, clone, move to folder | Dedicated profile editor, inline rename, intentional clone semantics, and folder assignment |
| State and recovery | State column, running filter, trash bin | Launch/stop progress, actionable failures, durable trash, and restoration |

The Multilogin menu visibly offers Proxies, Cookies, Run CookieRobot, Extensions, Transfer, Start headless, Edit, Rename, Clone, Move to folder, Copy profile ID, Export profile, Convert storage, and Move to trash bin. The visible shortcuts are Ctrl+E, F2, Ctrl+Shift+C, and Ctrl+Shift+M for edit, rename, clone, and folder movement respectively.

Those menu labels are a capability inventory, not proof of implementation. Vesper should expose actions that work, and explain unavailable capabilities where relevant. Transfer and storage conversion require a defined destination and storage backend; local-only operation should not imply a cloud service. CookieRobot is a vendor-named feature and should inform an independently named, explicitly specified automation feature rather than a copied brand or an unexplained button.

## Focused REA route traces

Two new exact-node incoming traces reuse the canonical Evidence. Each returns one seed, seven nodes, six edges, eleven observed facts, two inferred facts, and zero native handoffs. They connect packaged route declarations to a webpack module, chunk, asset, and artifact containment graph. The traversal also carries a package association to `@angular/google-maps`; that association is not evidence that the maps dependency implements profile creation. These traces do not resolve profile creation or update all the way into the native engine.

| Route | Exact node | New trace evidence |
| --- | --- | --- |
| `create-profile` | `jag_node_f7b661d05ec734201eb5b538088daba9f7069b1a1c313011308694c9839bdcde` | `ev_f76e0d6faf5643eb12bba0d1da2a7886ff18d1b4ce55aa526f36cd9e00f87363` |
| `update-profile` | `jag_node_06d75940338c743a174126a7d83555f8e8ba4778917304b0abdb014efa1af819` | `ev_b0f1cee9815a04ecc312085cfc1fbe41547affb538bf36973286c979132ff971` |

The selected inventory also observes `dashboard`, `folders`, `automation`, `default-settings`, `vnc`, `:profileId`, and `:profileId/advanced`. These are static route declarations. A zero unknown count in these tiny traces does not make the parent application's coverage complete.

Private reproducibility files are `profile-workspace-rea.mjs`, `profile-workspace-index.json`, and `profile-workspace-*-trace.json` under `.workbench/research`. The index is a projection, not a substitute for canonical Evidence.

## Profile action and service observations

Format-aware, inert ASAR member inspection independently verified frontend member hashes against the canonical REA observations. This supplemental inspection is **analyst static interpretation**, not a new REA provider observation. It retains identifier candidates and offsets privately, and never executes the inspected JavaScript.

| Member | SHA-256 | Observed anchors and interpretation |
| --- | --- | --- |
| Dashboard chunk `962.1074c152ca385ee6.js` | `1080c29e56cd53198d0cbb6cae7b652a8e8819d0d7928aae374a2810fa471940` | Row Start click binding near character 32,462; bulk Start binding near 15,835; profile mutation/service fields near 52,889. The table delegates actions and carries selection/loading/state conditions. |
| Service/routes chunk `892.e4d804ceb941c878.js` | `d77ee353d93ba91703db044f4e27af4c3b19e25902a09a6512df51d00068c4f5` | Dashboard route near 60,452; create/update routes near 60,726/60,898. Start/stop/create/export service methods near 75,942/76,528/77,113/78,295 delegate to a profile API service. |
| Generated API client `main.e5be361099620805.js` | `4f06576aa67f3075d381d09d5e0fd4f79ee31711a521c1b3881b712d762b3580` | Profile path constants near 20,823–21,237 and cookie service constants near 6,527. Declared paths are distinct from successful HTTP operations. |

Offsets are zero-based UTF-16 character positions in minified member text, not native addresses or source lines. Canonical source-module node identities and member hashes are preserved in the private index.

The dashboard's packaged syntax contains bulk start, stop, export, move, remove and upgrade identifiers, per-row start/stop/export/delete handlers, selected-profile state, and loading/state-dependent disabling. The service's start mutation passes a profile ID to `StartProfile`, invalidates profile data after the operation, and clears loading state during finalization. Stop has a corresponding service operation. Create/update normalize submitted configuration; export submits a profile ID and output path. These are static behaviors visible in the member syntax, with unresolved cross-module/runtime outcomes.

The generated client declares `/profiles`, `/profiles/new`, `/profiles/{profileId}`, `/profiles/{profileId}/start`, `/stop`, `/status`, `/export`, `/duplicate`, `/test-proxy`, and `/profiles/import`. The trailing operation paths are relative to `/profiles/{profileId}`. A separate cookie client declares `/profiles/{guid}/cookies`. These observations help define questions about lifecycle, export, duplication, proxy testing and cookie management; Vesper should use its own versioned contract and archive format.

The private `profile-workspace-member-observations.mjs` and JSON preserve the inspection boundary. Textual identifier matches in other chunks remain candidates, especially where embedded dependencies share the bundle. No vendor implementations are reproduced in product files.

## Browser core and optional Workbench

The packaged desktop preload/main boundary and separate engine lifecycle were already established in [Kameleo desktop findings](kameleo-desktop-findings.md). Its `save-profile` channel is a file-save helper, while export options select a directory and filenames; neither proves engine archive persistence. Native Multilogin analysis independently recovered a CLI-to-launcher wrapper and a request builder, with an unresolved interface dispatch: [Multilogin native findings](multilogin-native-findings.md).

Vesper Workbench as an optional plugin is an **original product requirement**, not a claim about either vendor's plugin implementation. The screenshots' extension/plugin icons do not establish a desktop plugin protocol. Browser extensions inside a profile and desktop Workbench plugins are separate concepts.

| Boundary | Owner and contract |
| --- | --- |
| Browser core | Profile identity/configuration, folders/tags/notes, storage, proxy references, lifecycle, cookies/extensions, import/export, and process ownership |
| Local browser service | Versioned profile operations, validation, state/events, launch leases, truthful engine capabilities, and automation endpoint ownership |
| Workbench plugin | Automation pipelines, scheduling, run history, artifacts, inspector/debugging workflows, and its optional navigation/actions |
| Plugin host | Installation/enable/disable state, version compatibility, declared capabilities, scoped profile access, and contribution registration |

Browser must remain fully usable when Workbench is absent or disabled. Workbench must consume the core service rather than create a second profile database or silently own Browser processes. A run acquires a lease for specific profile IDs, observes launch readiness, and releases or explicitly retains ownership on cancellation. Disabling the plugin removes its contributed navigation and actions while preserving profiles and ordinary browsing.

## Acceptance criteria and unresolved scope

The implementation is reviewable when the main screen is a profile table with working create/edit/start/stop flows, persisted organization, usable search/selection, actual per-row status, keyboard/menu actions, and honest capability labels. Selection must use profile IDs across filtering and pagination. Bulk failures must report each failed row and leave successful outcomes intact. Cloning must define whether it copies configuration, cookies, browser state, or some combination. Export/import must validate a documented independent schema before changing local profiles.

Workbench installation and disablement must be testable without breaking profile CRUD, browser launch, or storage. Plugin contributions must appear only while enabled, and unsupported versions must produce a clear compatibility result.

This report partially answers UI composition, profile actions, and desktop/service boundaries. It leaves vendor archive internals, runtime action completion, desktop plugin protocols, native browser masking, fingerprint coherence, DNS/WebRTC/QUIC routing, browser-kernel patches, and detection/performance parity unresolved. [Kameleo browser interaction boundary](kameleo-kernel-boundary.md) records the managed endpoint/CDP anchors and their limits. An attractive table or a settings flag cannot establish those native properties.
