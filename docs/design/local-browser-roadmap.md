# Vesper Browser and Vesper Workbench

## Product goal

The expanded [product completion plan](vesper-product-plan.md) covers two installable desktop applications, stable public APIs, advanced local automation and separate Windows/Linux release qualification. This earlier roadmap records the local engine foundation and its research boundaries.

Build two original open-source projects by **true-utopian** for this PC: **Vesper Browser** for isolated profiles, proxy routing and persistence, and **Vesper Workbench** for automation pipelines, orchestration and inspection. The operator supplies proxies; the local browser backend needs no paid browser service or fingerprint subscription. Kameleo and Multilogin are references for observable behavior and useful workflows, not source implementations to reproduce.

The UI, profile format, storage model and implementation belong to this project. The existing licensed Kameleo adapter remains an optional integration. The independent backend must work without it.

Browser lives in `packages/vesper-browser`, with its own package, CLI, licence and build. Workbench remains the root project and depends on Browser's public API. Neither project has been published or moved to a new GitHub repository. Existing profile locations and archive bytes are retained so the naming change does not invalidate data.

“Understand it perfectly” is a research objective, not a current evidence claim. Every feature needs a documented behavior, an independently designed implementation and a repeatable acceptance check. Unknown behavior stays marked as unknown until measured.

## Evidence and implementation boundary

| Evidence level | What it establishes | What it does not establish |
| --- | --- | --- |
| Public documentation | The vendor's described capabilities and API contracts | That the installed version behaves exactly as described |
| Controlled observation | A result for the tested version, settings, fixture and machine | Universal behavior on other machines or sites |
| Static package inspection | Package structure and possible relationships | Runtime execution, complete native behavior or fingerprint parity |
| Hypothesis | A question to test | A product capability or implementation requirement |

Use public contracts and controlled behavior to write functional requirements. Do not copy vendor source, assets, browser patches, fingerprints or archive internals into this backend. Retained local inspection evidence is private research material, not a shipped dependency. [The inspection record](../kameleo-inspection.md) describes its coverage and limits.

The vendor's [fingerprint documentation](https://developer.kameleo.io/concepts/fingerprints/) describes coordinated browser, device and environment attributes. That is a documented claim, not a locally verified mechanism. Its [profile lifecycle documentation](https://developer.kameleo.io/tutorials/managing-profiles/) describes creation, changes, start/stop and persistence operations. Requirements below use these behaviors as reference points; implementation choices remain independent.

## Current capability and acceptance gaps

| Area | Independent implementation today | Next evidence required |
| --- | --- | --- |
| Profiles | Unique Chromium user-data directories; creation, editing, duplication and local archives | Isolation across IndexedDB, service workers, permissions, caches and simultaneous profiles |
| Persistence | Cookie and local-storage roundtrips tested on this PC; stop and export confirmation | Larger stores, interrupted writes, repeated crash recovery and upgrade compatibility |
| Proxies | Per-browser loopback bridge; authenticated HTTP and SOCKS5 tested | Browser-wide routing capture, unavailable-proxy behavior, DNS and WebRTC checks |
| Environment | Standard Chromium with locale, timezone and viewport controls | Consistency on first navigation, new tabs, frames and workers; clearly identified emulation limits |
| Automation | Puppeteer scripts and managed flows use the local adapter | Real PostgreSQL fencing and concurrent failure scenarios; current embedded database smoke does not qualify them |
| Fingerprints | Real Chromium/Windows identity; unsupported vendor settings rejected | A separate original design and validation for any additional identity controls |
| Performance | Local headed/headless fixture timings recorded | Repeated trials under the same workload and hardware, including resource usage and failures |

Standard Chromium plus JavaScript overrides does not establish a coherent alternative device identity. A fingerprint feature must state its intended privacy or testing use, exposed surfaces and limitations. It must pass consistency checks before the UI presents it as supported. Browser-engine changes, if necessary, must be original work against an open-source engine with its dependency licences retained.

## What “better” must mean

The local backend already removes the browser-service subscription dependency. Performance, reliability and fingerprint quality require separate evidence; no comparative superiority is established yet.

| Goal | Measurement | Acceptance criterion |
| --- | --- | --- |
| Independent operation | Install, launch, automate, stop and restore with the vendor service absent | Every core local workflow completes without a vendor account or executable |
| Consistent settings | Collect request headers and browser observations before application scripts execute, including frames and workers | Supported settings agree across measured surfaces, or a limitation is explicitly reported |
| Profile isolation | Two fixtures with distinct stored data, followed by duplication and archive restore | No unintended cross-profile data; duplication and restore match the documented semantics |
| Reliable routing | Observe traffic for healthy, failed and interrupted proxies | Measured fixture traffic uses the selected route; a proxy failure does not silently change that route |
| Recovery | Interrupt browser and workbench processes at lifecycle boundaries | Original data retained, ownership resolved safely and failure visible; no false saved-state report |
| Lower overhead | Repeated cold/warm starts, exports and concurrent runs | Report p50/p95 latency, peak memory, CPU, archive size and failure rate with versions and sample counts |
| Usability | Complete create → proxy → open → stop → backup → restore | Each operation has an accurate state and actionable failure; no hidden setup beyond documented dependencies |

For a comparative benchmark, use identical fixtures, hardware, browser versions where feasible, proxy conditions and concurrency. State differences that cannot be controlled. Optimize only after the measurements identify a bottleneck; report improvements without trading away reliability or routing guarantees.

## Implementation order

1. Add an original controlled browser fixture and observation collector. Cover first navigation, tabs, frames, workers, storage isolation and proxy failure. Record browser version and settings with each result. Fixtures run locally and contain no real accounts.
2. Fix lifecycle, environment-setting and routing failures revealed by those checks. Extend the current recovery and archive tests where a failure warrants it.
3. Collect repeatable latency and resource baselines at increasing concurrency. Add capacity limits informed by observed memory and CPU use, then measure each optimization against the baseline.
4. Add profile deletion, bulk operations and browser update/rollback controls with explicit data-retention behavior. Keep the dashboard aligned with actual backend capabilities.
5. Design any further fingerprint controls as a separate original subsystem. Specify coherent supported environments and test their exposed attributes before implementation claims. Browser engine research is a separate milestone, not a checkbox satisfied by the current adapter.

The working setup and current capability limits are in the [local browser guide](../local-browser.md). Passing the existing smoke tests qualifies their covered behaviors on this PC; it does not close the remaining acceptance gaps above.

The [research and feature ledger](../research/feature-ledger.md) maps the reference products' documented features to Vesper's actual implementation and outstanding questions. The original `npm run observe:browser` fixture records first-script browser values, storage behavior and unavailable-proxy behavior. It reports real Chromium identity and observed limitations rather than a detection score.
