# Validation record

## Native surface source checks, 12 October 2026

The [native surface policy record](native-surface-policy.md) records 177 passing source tests, 4,141 standalone C++ assertions and four isolated Chromium translation-unit compiles. Browser 0.4.6's editor passed five owned-store checks: policy save/reload, protection-off disablement, engine-specific visibility and reviewed viewport fit. Workbench 0.5.8 forwards the same settings through Inspect. These checks do not qualify a custom native browser or the new installed desktop pair; their release gates remain pending.

Current engine evidence is in the [native policy follow-up](#native-policy-follow-up--2026-10-11) below. Earlier sections describe their own dated acceptance scope.

The dated checks below record observed behavior. Earlier live results cover script mode; managed flows have their own implementation and integration checks.

## Browser-hosted Workbench, 11 October 2026

Browser **0.3.0** is the main dark profile application; Workbench **0.4.0** is an optional signed local add-on. See [installation and ownership](workbench-addon.md), [workspace design](design/browser-workspace.md) and [bounded REA findings](research/profile-workspace-findings.md). Earlier release records below are historical.

- Complete check passed: **9 Browser + 116 Workbench tests**, zero failures, one optional PostgreSQL test skipped. Added tests cover persistent boolean favorites and signed add-on verification, archive path/link/member/size limits, registry escapes and immutable installation snapshots. Renderer and native-host JavaScript syntax checks passed.
- Browser UI passed 19 owned-store checks, including real Chromium start/stop, cookies, templates, metadata edits, favorites, folders, selection, sorting/pagination and lease restrictions. Default desktop table fits without horizontal scrolling; narrow layouts contain table scrolling.
- Both final Windows NSIS installers installed with exit 0. The actual installed Browser verified and installed the final signed add-on, then embedded Workbench in one native window with two isolated web contents. Source hashes match the installed Browser and add-on renderer files.
- The installed add-on completed a manual script, a freshly published flow and a scheduled script, retaining **three verified profile archives**. Restart preserved the archives, completed schedule and published-flow label. Enabled add-on services resumed before opening their view; disabled add-ons stayed stopped across restart. Re-enabling retained all saved data. Native bounds followed window resizing, and the Workbench profile button returned to the main manager. No page errors were recorded.
- An active-run source desktop check refused disablement until the run was cancelled and cleanup completed. The native shutdown sequence drains Workbench before its Browser owner. A restart check exposed a stale flow-library selection indicator; the repaired installed add-on passed the repeated publication and restart path.
- The final standalone Workbench installer saved another real native run, opened its authenticated Browser manager and matched all eight renderer source hashes. Both isolated QA installs uninstalled with exit 0; their private profiles and archives were preserved.
- Root and packaged Workbench production dependency audits reported zero known vulnerabilities. Windows installers and Linux Debian/portable packages have locally signed offline update manifests. The dedicated cross-platform add-on rejects native binary dependencies and ships no vendor SDK or second browser executable.
- Both Linux amd64 Debian structures passed, including ELF architecture, sandbox/launcher permissions and required runtime payloads. Native Linux execution is **unqualified**: this PC's WSL reports `REGDB_E_CLASSNOTREG`. Package structure is not a runtime qualification.

Private evidence: `test-results/browser-host/installed-results.json`, source/installed screenshots, `test-results/vesper-browser-workspace/result.json`, check/build/audit logs and retained QA stores. `release/RELEASE.json` gates current artifact hashes and installed acceptance. Source and release builds remain local; nothing was committed, pushed or published.

The largest remaining product gap is an original coherent native masking engine. This release does not establish proprietary fingerprint parity, Firefox/mobile support, extension management, cloud/team features or comparative superiority. The native Chromium/optional Brave engines and their capability limits remain explicit.

## Navigation and usability release, 10 October 2026

Browser 0.2.1 / Workbench 0.3.1 add stable navigation, compact profile actions, tabbed settings, readable inspection panels and full workspace pages for flows/schedules. [Usability scope](design/usability-pass.md) and [current competitor gaps](research/vendor-gap-comparison.md) describe what changed and what remains.

- TypeScript/build passed; 8 Browser and 99 Workbench tests passed, with one optional external PostgreSQL test skipped. JavaScript syntax checks passed for the updated renderer modules.
- Actual source Electron controls created profiles, switched settings tabs, exposed an invalid hidden proxy field, selected visible profiles, dismissed More with Escape, created a template, opened/stopped a running profile, trashed/restored it and opened its Proxy tab directly from the connections page.
- Actual Workbench controls created and published fresh flows, selected them immediately in New run, then saved two real Chromium runs. One used the owned demonstration; one used a custom website origin on the local test service. Unsaved edits survived page switching; rejecting the discard prompt retained the edited flow. Schedule create/pause/resume/remove worked.
- Screenshots were inspected at native launch size and the 680px minimum. Both apps had no horizontal document overflow at the minimum or a 390px web viewport. Navigation and graph canvases intentionally scroll within their own regions. The final native UI pass recorded zero page errors.
- Early UI checks exposed a deleted editor boundary, false dirty detection caused by initial graph layout, and delayed automation-selector refresh. These were repaired and the authoring/publication/execution path was repeated successfully. Saving temporarily prevents editing the submitted draft until the validated response and library refresh finish.

Private evidence lives under `test-results/usability`, including results, screenshots and build/check/package logs. Native Linux execution and complete vendor fingerprint parity remain unqualified.

### Resume and polish, 11 October 2026

- Fresh installed Browser 0.2.1 / Workbench 0.3.1 reopened with all three saved runs, the published visual workflow and the completed scheduled run intact. The prior session used actual installed controls for visual flow, script and scheduled script execution. Evidence: `test-results/usability/installed-results.json`.
- Flow selection keeps the saved message unchanged; a real drag creates one history entry, and Undo/Redo restore the measured positions. Double-clicking Publish produced exactly one draft-save request and one publication request. Editing/export/Save/Publish controls remain unavailable until the operation finishes. A newly published flow was selected in New run, executed in headed Chromium and saved through Finish & save.
- Schedule name, automation inputs and date survive navigation to Flow editor and back. Unchanged schedule rows survive polling. Required name/date controls provide native form feedback. Connections-panel closure restores the underlying destination, and a queued close event cannot close a page that has just reopened.
- The flow library keeps its creation and title controls above its scrolling documents. Production dependency audit reports zero known vulnerabilities on this date. These renderer changes passed JavaScript syntax checks; the previous complete suite remains the applicable backend/typecheck result.
- Demonstration flows resolve their Website address to the current local fixture port. Publication labels compare demonstration bindings after resolving that port, so restarting alone does not imply user edits. A genuinely different draft is labeled Draft changes when an older published version exists; custom website bindings remain unchanged.
- The final Windows Workbench installer returned exit code 0 and contained renderer files identical to source. Its actual controls published and saved another flow and completed another scheduled script. After restart, all five installed run records were saved, both schedules were completed and the new flow still displayed Published. The installed APIs reported Browser 0.2.1 / Workbench 0.3.1. Acceptance records the exact SHA-256 of both Windows installers, so a later rebuild invalidates that evidence.
- Both isolated QA installations uninstalled with exit code 0; five exports, the private browser store and persistent coordinator remained. QA services were closed. Both rebuilt Linux Debian packages passed structural checks; native execution remains unqualified. The final renderer also fit a 390px web viewport, with screenshots reviewed separately from the native/minimum checks. Both root and packaged Workbench production dependency audits reported zero known vulnerabilities.

## Expanded Vesper release, 10 October 2026

Browser 0.2.0 / Workbench 0.3.0 add original implementations of templates, organization, bulk controls, trash, cookie tools, native environment policies/reports, optional Brave, visual flow authoring, durable scheduling and offline signed updates. All new execution and research occurred locally on this Windows PC.

- `npm run check`: TypeScript/build passed, 8 Browser tests passed, 99 Workbench tests passed and one optional external PostgreSQL test skipped. Scheduler tests cover encrypted inputs, coalescing, admission quarantine and exclusive ownership; flow-library tests cover stale revisions and publication; update tests cover signatures and installer identity. Production audit reports zero known vulnerabilities at check time.
- Real headed Chromium and Brave qualification passed on owned HTTP fixtures, cross-site frames and a worker. Page/frame CPU, locale/timezone and persistent cookie/archive round trips were measured. Chromium screen dimensions matched the requested 1366×768; Brave rounded site-visible dimensions. Worker CPU stayed native while page CPU was overridden. Different Brave profile canvas samples were observed; this does not establish coherent masking across every surface.
- A fresh official Brave 1.97.56 Windows download matched SHA-256 `5f44edf1f7f4a39b34e88145eb1a003397c50becaf041f0168354a8ee7201a55`, 252,008,652 bytes. Bounded ZIP extraction passed the real archive and malicious traversal/symlink/limit fixtures. The initially selected ZIP extraction dependency had an audit vulnerability and was replaced before packaging.
- Actual native UI controls saved and published a flow, ran it through Brave and produced a verified saved archive. The editor's target/state/action controls, graph dragging, undo/redo and layout persistence were checked. A scheduled script executed and saved its archive; future schedules survived restart and pause/resume/remove controls worked. These tests use owned fixtures, not external account services.
- Fresh Browser 0.2 and Workbench 0.3 Windows NSIS installations returned exit code 0. Their packaged apps shared one Browser owner and launched bundled Chromium without an external Node runtime. Actual installed controls completed a script, a newly published visual flow and a scheduled script: all three saved. The downloaded script archive was 66,084 bytes with matching SHA-256. Runs, published flow and completed schedule persisted through restart. Native Workbench Quit exited with code 0 in 135 ms on the idle restarted fixture. Both packaged production dependency audits reported zero vulnerabilities. Evidence: `test-results/expansion/installed-results.json` and `installed-workbench.png`.
- Both isolated installations then uninstalled with exit code 0; profile manifests, three saved exports and the persistent coordinator remained intact. QA services were stopped and the user's original development services were left untouched.
- Workbench opened the full shared Browser manager. Independent template instances, metadata/folder filters, bulk duplication, trash/restore, environment reports, cookie JSON export/re-import and profile archive export/import passed using ordinary UI controls. Desktop downloads land in the private application download folder. Screenshots were inspected at launch and the 680px native minimum; the graph intentionally pans and dense profile collections scroll.
- REA inspected Kameleo, Multilogin and Dolphin boundaries; Dolphin's public installer was extracted without installation/execution. The bounded exact IPC trace is recorded in [Dolphin findings](research/dolphin-desktop-findings.md). This is scoped static evidence, not complete vendor reverse engineering.
- Windows full NSIS, Linux amd64 Debian and portable tar artifacts rebuilt successfully. Linux package structure passed. All four installer update sidecars verified against the packaged Ed25519 public keys and matched their installer sizes/SHA-256. This verifies update contracts and released files; a complete interactive update installation remains unqualified.

Private evidence: `test-results/vesper-expansion-check.log`, `vesper-expansion-audit.log`, `vesper-safe-engine-download.log`, `vesper-engine-qualification.log`, `test-results/expansion/engine-qualification.json` and UI screenshots. The [QA inventory](design/expansion-qa.md) explains acceptance scope.

Remaining: original native masking fork, Firefox/mobile, extensions, team roles/cloud sharing, calendar scheduling/wakeup, hosted update feed/automatic rollback, full native update installation cycle, comparative capacity benchmarks and native Linux execution. The engine-fork build cannot be performed with this PC's available disk/toolchain. Linux packages receive structural qualification only. Original source remains MIT; upstream engine/dependency licences retain their own terms.

## Installed Vesper desktop development release, 10 October 2026

Vesper Browser 0.1.0 and Vesper Workbench 0.2.0 are original MIT-licensed applications by **true-utopian**. All checks in this section ran locally on this Windows PC; no publication or remote deployment was performed.

- `npm run check` passed typechecking, both builds, all 5 Browser tests and 93 of 94 Workbench tests. The separate external PostgreSQL test was skipped. The production dependency audit reported zero known vulnerabilities; that does not describe the development dependency tree.
- Both full Windows x64 NSIS installers completed with exit code 0 into isolated test directories. Their installed executables launched the desktop shells and their own packaged Electron Node runtime, without relying on an operator-installed Node runtime. They launched the bundled headed Chromium.
- Both isolated installations uninstalled with exit code 0. Their private profile manifests, saved archives and persisted database remained intact.
- Actual desktop controls completed a script run and the durable sign-in flow, including password entry, a synthetic verification challenge and explicit Finish & save. Both produced downloaded archives with matching SHA-256: 66,123 bytes for the script and 142,799 bytes for the flow. Both saved records survived Workbench restart. Reopening the script profile preserved its fixture local storage.
- The native renderer had Node disabled and no API token in renderer storage. The Browser manager displayed run ownership. The tested windows showed no horizontal overflow at 800 and 680 pixels. These are scoped checks, not a complete application security assessment.
- The Python SDK discovered both private service descriptors and retrieved versioned capabilities and automation definitions. API tests cover stale profile revisions, lease ownership across restart, cursor replay, duplicate admission replay and quarantine of interrupted admission. Idempotent admission does not guarantee exactly-once effects on a website.
- The independent pair smoke passed seven real browser checks. Its new archive was 65,601 bytes. Re-exporting one existing synthetic profile after omitting component/speech model caches reduced its archive from 314,199,266 to 148,601 bytes. This is a cache-size observation for that profile, not a comparative performance benchmark.
- Linux amd64 Debian packages and portable tar archives were cross-built. Structural checks cover required payload dependencies, ELF architecture, executable modes and the sandbox helper mode. Native installation and operation remain unqualified: this PC's WSL reports `REGDB_E_CLASSNOTREG`, and no Linux environment was available.

Evidence is retained privately in `test-results/desktop/installed-results.json`, `test-results/desktop/linux-packages.json`, `test-results/vesper-desktop-final-check.log` and `test-results/vesper-pair/result.json`. See [desktop operation and build instructions](desktop.md). This section describes the earlier baseline; the expanded release above supersedes its editor and scheduling gaps. It does not establish complete vendor parity.

## Vesper project split and local service, 10 October 2026

- The complete check passed: 91 Workbench tests and 3 independent Browser tests, with the optional external PostgreSQL test skipped. Both TypeScript checks and builds passed. The production dependency audit reported zero known vulnerabilities.
- Browser is independently buildable and packable with its own MIT licence, original manager UI, CLI and public API. It contains no Workbench or vendor SDK imports. Workbench can embed Browser or connect to its independent loopback service.
- `scripts/browser-manager-smoke.mjs` passed seven real Chromium checks against fresh synthetic profiles: manager creation/editing/duplication, native window lifecycle, authenticated client access, CDP attachment, streamed archives, search, escaped text and explicit token removal. Screenshots were inspected at 1440 and 320 pixels, with no overflow at 1440, 800, 390 and 320 and no JavaScript errors.
- `scripts/vesper-pair-smoke.mjs` passed seven checks with two independent loopback services. Workbench completed a real automation through Browser, both interfaces listed the same profile, the downloaded archive matched its hash, import produced a separate profile, an existing export destination was preserved, manual browsers blocked new automation, and closing Workbench preserved independently opened Browser windows.
- `scripts/browser-observations.mjs` passed five checks. A first-script cross-site iframe regression was fixed using supported CDP target attachment: frames pause until their explicit locale and timezone are applied. The fixture also covers storage isolation/restart and origin navigation through an unavailable proxy. Popup initialization, service workers and whole-browser routing remain broader qualification gaps.
- A parallel research/check run exposed timing races in existing cleanup and expiry tests. Controlled lifecycle gates and a test clock replaced short wall-clock sleeps; the 27 affected runtime/proxy checks and the complete suite passed afterward. No production timeout or proxy expiry policy was relaxed.

Local service/UI evidence is retained in gitignored `test-results/vesper-browser-manager`, `test-results/vesper-browser`, and `test-results/vesper-pair`. See the [research ledger](research/feature-ledger.md), [Kameleo desktop findings](research/kameleo-desktop-findings.md) and [Multilogin native findings](research/multilogin-native-findings.md) for the exact static analysis coverage and unresolved boundaries. Full fingerprint parity, Firefox/mobile engines, complete vendor reverse engineering and comparative performance are not established.

## Independent local backend, 10 October 2026

All work and new browser checks ran on this Windows PC with Node 24.14.0 and downloaded Chromium snapshot revision 1716330. No Kameleo Engine or account was used by the new local backend tests.

- The regression suite passed 90 tests; the one test requiring a separate real PostgreSQL database was skipped. TypeScript checks and production builds passed. The production dependency audit reported zero known vulnerabilities.
- `scripts/local-smoke.mjs` passed with both headless and headed Chromium. Checks covered separate profile storage, persistent cookies/local storage across restart, timezone/locale, same-PC archive restore, authenticated HTTP and SOCKS5 routing to owned local fixtures, real script worker execution, SHA-256 downloads, snapshots, dashboard profile creation, mobile layout and shutdown.
- The expanded headed check also passed process-crash recovery, streaming archive upload, and profile editing. It killed only its own child workbench process, reopened that child's private engine directory, stopped the recovered browser, and exported it. This revealed transient Windows cookie-file locks after main-process exit; exports now retry complete archives for bounded lock failures and discard partial bytes.
- In that headed run, a fresh profile started in 376 ms and the same profile restarted in 346 ms. Its small synthetic archive took 41 ms to export. The complete headed smoke took 9.5 seconds. These are single local observations, not percentiles or evidence of a performance advantage over Kameleo.
- `scripts/local-flow-smoke.mjs` passed a real Chromium managed flow using embedded PostgreSQL: cold sign-in with verification input and identity binding, reuse by identity ID, and anonymous identity handoff. All three runs reused the same persistent profile and saved verified local archives. Observed run durations were 3.3 s, 1.2 s and 5.7 s. Embedded PostgreSQL does not establish external-process advisory-lock behavior.
- Offline tests cover encrypted proxy metadata, setting rejection, cache omission, archive restore/duplication, store ownership, malformed/symbolic-link/hard-link rejection, authentication, active-run control protection, and an archive upload larger than the ordinary JSON body limit. Dashboard screenshots were reviewed at 1440 px and 390 px.

Local browser evidence and screenshots are gitignored under `test-results/local-browser`. REA inspection evidence is retained privately under `.workbench/research`; see [the inspection record](kameleo-inspection.md). No proprietary browser-kernel reconstruction, fingerprint/detection parity, cross-PC cookie migration, Linux local-browser smoke, third-party proxy-provider uptime, or comparative capacity benchmark was established by these tests.

## Managed runtime, 2 October 2026

The live checks used the Ubuntu 24.04 server, PostgreSQL 17, Node 24.21.0 and the pinned Kameleo Engine 5.3.1 container.

- `scripts/flow-smoke.mjs` passed cold sign-in, reuse by identity ID, and anonymous-to-warm profile handoff. All three runs ended with the same persistent profile. Each downloaded archive matched its recorded SHA-256.
- Those runs took 6.1 s, 3.0 s and 9.1 s respectively, including synthetic verification inputs and export. These are single observations with cached kernels, not latency percentiles.
- `scripts/recovery-smoke.mjs` reached a verification prompt, then the workbench container was killed with SIGKILL while Engine and PostgreSQL stayed running. Startup reconciled and stopped the retained browser. Resume reclassified the restored page, accepted fresh inputs and saved a verified archive.
- Two separate PostgreSQL connections raced for the last browser slot; only one acquired it. A second process could not take the node's advisory lock. The test used a separate database, which was removed afterward.
- The full suite passed 85 tests on Windows and 85 on Linux, followed by a production build on each. The optional PostgreSQL test is skipped without a dedicated database URL; that test passed separately on the server. Production dependency audit reported no vulnerabilities.

The browser tests caught and fixed a fixture selector mismatch, session-cookie loss on browser close, premature work after identity binding, and a transient handoff state reported as an interruption. Unit regressions cover the handoff and state reporting.

Reproduce managed checks against an idle deployment with the test fixture enabled:

```sh
docker compose exec workbench node scripts/flow-smoke.mjs
docker compose exec workbench node scripts/recovery-smoke.mjs prepare
# Test environment only: interrupt the workbench while leaving Engine and PostgreSQL running.
docker compose kill -s SIGKILL workbench
docker compose up -d workbench
# Wait for the workbench health check to pass.
docker compose exec workbench node scripts/recovery-smoke.mjs resume
```

No human typing dataset, multi-node capacity load, database failover, cross-node profile migration or native Windows Kameleo browser run was tested. Managed proxy reuse has admission and health checks, but the live proxy result below belongs to script mode. The timing model ships with uncalibrated defaults and tools to fit and evaluate consented recordings.

## Flow implementation, 2 October 2026

`npx tsx --test test/flows.test.ts` passes 11 tests covering strict compilation, state/evidence recognition, blank/stale/ambiguous abstention, a complete synthetic sign-in flow, unavailable and changed choices, wrong identity receipts, durable-write failure, uncertain submission recovery without replay, and a durable handoff before post-bind work. The successful flow checks that passwords, codes, account values and receipts never appear in journal snapshots.

These interpreter tests use a controlled driver to exercise state and storage behavior. The guarded browser executor has its own interaction tests; live Kameleo and PostgreSQL results are recorded above.

## Script-mode baseline, 1 October 2026

## Environments

| Environment | Checks | Result |
| --- | --- | --- |
| Windows, Node 24.14.0 | TypeScript, 40 automated tests, production build | Passed |
| Ubuntu 24.04 amd64 host, Node 24.21.0 in Docker | Clean dependency installation, TypeScript, same 40 tests, production build | Passed |
| Official Kameleo Linux container, Engine 5.3.1 | Create, headed start, Puppeteer attachment, form input, stop, export, restore | Passed |
| npm dependency audit | Production dependencies | No known vulnerabilities reported at test time |

Kameleo's published npm SDK was 5.2.0 when tested. The pinned Engine image is 5.3.1; the specific API calls used here were exercised against that combination. Do not assume that every API field added in a later Engine is exposed by this SDK.

## Browser lifecycle and recovery

The controlled `/demo` form was completed through a real headed Chroma browser. The workbench disconnected, stopped it, exported a nonempty `.kameleo` file and verified its byte count and SHA-256. One saved profile was imported into a **separate Engine workspace** and reopened; both local storage and a persistent cookie survived.

The first deployment test exposed a shared-volume ownership error. The run entered `export_failed` and retained the original profile. After correcting the volume owner to the image's actual runtime UID 1001, Retry export saved the same profile without repeating the form action. An SDK regression test covers the exact `profile_not_running` stop response used in that recovery.

Offline tests also cover queue limits, cancellation, explicit completion, pause acknowledgement, input validation, timeouts, late Engine results, restart cleanup, retained proxy leases and late secret-bearing logs. Unconfirmed cleanup holds capacity. An unresolved Engine creation with no discoverable profile ID requires operator inspection.

## Live display and input

The authenticated dashboard was checked against the live Linux deployment. Browser snapshots and the noVNC connection rendered the actual headed browser. A six-digit test-input challenge was submitted through the web form; the automation continued and saved its profile. The viewer disconnected when the run finished.

The separate UI smoke test also passed: login, Engine readiness, SSE connection, discovery of all three bundled scripts, schema fields, and no horizontal page overflow at 390 px. Desktop and mobile screenshots were reviewed. Its temporary browser profile was removed after the test.

## Proxy path

`scripts/proxy-smoke.mjs` ran a temporary authenticated HTTP CONNECT relay on the private container network. It allowed only the test form, HTTPS IP probe and two observed Kameleo startup IP-check hosts. A real headed browser and the allocator reported the same exit IP. The relay observed the browser's nonce-tagged form request, four HTTP requests and four CONNECT requests. The resulting profile archive was verified; temporary relay credentials were cleared from the stopped test profile before export.

This proves the framework's authenticated HTTP proxy path and probe-to-browser mapping. It does **not** validate an IPRoyal account, residential classification, ISP targeting, paid proxy inventory, live SOCKS5 service, or NSocks service quality. No paid proxy credentials were supplied and no traffic or proxy service was purchased. IPRoyal credential construction and inventory policies have automated tests; NSocks support is imported endpoints only.

Kameleo itself performs startup checks through a configured proxy. The controlled test needed `tools.kameleo.io:443` and `tools-bckp4.kameleo.io:443`; an over-restrictive proxy can therefore pass the workbench's probe and still prevent Engine startup. Consult [Kameleo's network requirements](https://help.kameleo.io/article/65-kameleo-in-restricted-network-environments) for your deployment.

## Observed timing

One cached-kernel run created its profile in about **0.6 s**, had its browser ready in **3.2 s**, and finished form entry plus verified export in **4.9 s** using `natural-fast`. The controlled proxy smoke run took about **4.0 s**. These are individual observations on this server, not benchmark percentiles or service guarantees. First startup/kernel installation and provider allocation can take much longer.

## Reproduce

With a running, idle workbench and Engine:

```sh
npm run check
npm run smoke
```

In Compose, use the container's network and shared paths:

```sh
docker compose exec workbench node scripts/smoke.mjs
docker compose exec workbench node scripts/proxy-smoke.mjs
```

For archive restoration, give the smoke script `IMPORT_KAMELEO_URL` pointing to another Engine with a separate `/data` volume, access to the same export mount and access to the demo URL. The smoke script retains profiles for inspection. Kameleo preserves profile IDs in archives and rejects importing beside the original profile.

For UI checks, run `scripts/ui-smoke.mjs` with `UI_WORKBENCH_URL` and optionally `IMPORT_KAMELEO_URL` and `UI_SCREENSHOT_DIR`. It creates and removes its own temporary browser profile and writes private screenshots; keep those outside the public source tree.

Native Windows Kameleo browser execution, external login providers, game renderers, team isolation and distributed workers have not been validated. The Windows test result above covers the Node framework and filesystem behavior. CI is configured for Ubuntu and Windows; hosted CI results are separate from these local/server checks.
## Native policy follow-up — 2026-10-11

Browser **0.4.0** and Workbench **0.5.0**, by true-utopian, passed the current
local source check: 15 Browser tests and 116 Workbench tests, zero failures;
one optional PostgreSQL test was skipped. Production dependency audit reported
zero vulnerabilities. The earlier sections record earlier framework/vendor
checks and should not be interpreted as this release's native engine evidence.

The original loopback qualification suite passed ten cases. Chromium
157.0.8097.0 (revision 1716330) and Brave 1.97.56 (Chromium 155.0.8059.40)
covered 84 first-script contexts across six profile matrices: main page,
same-origin and cross-process frames, dedicated/nested/shared/service workers,
popups, a new tab and a cross-frame worker. CPU 4, fr-FR navigator language and
ICU locale, and America/New_York timezone were observed before the fixture's
scripts ran. Headless Chromium's native virtual display also matched the
requested screen. Headed cross-process screen values remain an explicit
limitation. A real Workbench automation saved an archive whose SHA-256 matched
its recorded artifact, and imported profile settings survived restart.

Brave Off/Standard profiles retained native preference values 1/3. On this
canvas fixture, Off profiles agreed; Standard profiles differed from each
other and Off. Repeat reads and a same-origin dedicated worker agreed within
each tested profile. This measures upstream native protection, not an original
compiled Vesper masking kernel or all-site detection resistance.

Engine activation passed its isolated first-script/worker canary, backed up
stopped profiles, serialized new HTTP leases and rejected direct mutations
during maintenance. A deliberately invalid staged executable failed
qualification, retained the failure report and left the selected engine
unchanged.

The packaged Windows Browser editor saved a real Brave policy, the engine UI
completed a real Brave canary, and the signed Workbench 0.5.0 add-on installed,
enabled and embedded in the Browser 0.4.0 native window. Its Inspect automation
forwarded the profile policy, exposed the expected first-script values and
saved a verified 56,977-byte profile archive. This used a separate temporary
store and packaged application; the user's installed desktop session and
profiles were unchanged. Linux amd64 Debian package structure, permissions,
required runtime files and ELF architecture passed. Native Linux execution is
still unqualified on this Windows-only environment.

Private evidence: `test-results/native-engine/check.log`, `qualification.json`,
`desktop-qualification.json`, `native-engine-desktop.png`,
`production-audit.json` and `test-results/desktop/linux-packages.json`.
Reproduce with `npm run check`, `npm run qualify:native` and the package
commands in [Native engine](native-engine.md). REA evidence and unresolved
native vendor edges are recorded there and in `docs/research`.

## 12 October 2026: desktop extensions, schedules and service ownership

The rebuilt Browser 0.4.2 / Workbench 0.5.4 Windows pair passed real loopback
automation with an original MV3 extension. Its content script observed CPU 4
and fr-FR; the startup worker observed fr-FR and CPU 12. That CPU difference
is an upstream CDP limitation, not proof of the custom kernel. Workbench
finished the run, closed the browser and saved a 68,657-byte archive with
SHA-256 `4fff78e663d980ae4c057ad9f22b66863f8a8a70a1a32288dda4ae9d019bbe2e`.
Independent import preserved the extension identity and increased its stored
visit count from 1 to 2. All owned run leases were released.

The calendar API and TypeScript client previewed five dates across the London
DST transition and created, paused and removed a future weekday schedule.
The native Workbench view measured 1,076 by 565 pixels; the calendar editor's
submit action remained visible in its fixed footer. No wake-from-sleep claim
is made: Workbench must be running to admit schedules.

An earlier actual-installation check exposed Windows path limits that the
short temporary store had missed. The launch fix uses private short extension
copies and a temporary profile junction while preserving the original stores.
A real Chromium test with a 294-character extension manifest path passed two
launches and persisted visits from 1 to 2. Copies are hash-checked and cleanup
waits for the owned browser process to exit.

An older installed Browser service later became unavailable; its exit cause
was not established. Desktop service logging used parent-owned pipes that
were closed after detachment. The rebuilt manager passes append-only file
descriptors instead. A subprocess regression passed, and the packaged manager
exited while its owned profile and authenticated Browser API stayed running.
The fixture then stopped that profile and shut down the service normally.

The source checks passed **149 tests**, with zero failures and one optional
external PostgreSQL skip. Production dependency audit reported zero findings.
Both Linux amd64 Debian packages passed structure and ELF checks; execution
remains unqualified because this PC has no usable Linux runtime. Stock Chromium
was rejected at the native extension-startup-worker CPU check. The pinned
custom Chromium build remains in progress and has no accepted native proof.

Private evidence: `test-results/desktop-followup/packaged-pair.json`,
`packaged-api-pair.json`, `detached-service.json`, `stock-rejection.json`,
`check.log`, `production-audit.json`,
`test-results/extensions/long-path-qualification.json` and
`test-results/desktop/linux-packages.json`. These records and private profile
archives are excluded from the public source release.

The actual installed Browser 0.4.2 and enabled Workbench 0.5.4 add-on then
passed the extended test on the original deep Windows data path. The saved
archive measured 68,303 bytes with SHA-256
`fa19d7b373d03e121f721df755082f0a156cc46565a73bf3790d8967bdfecd05`.
Extension startup, content-script policy, independent archive import, visits
1 to 2, calendar/DST preview and future-schedule create/pause/remove all passed.
Existing profiles remained unchanged and all leases were released. The Python
standard-library SDK independently passed calendar preview and schedule
lifecycle checks. The upgrade backed up 35,642 files (458,785,304 bytes),
verified their checksums and preserved the original files before launch.

Actual-installation evidence: `test-results/native-engine/installed-pair-qualification.json`,
`test-results/desktop-followup/installed-python.json` and the private upgrade
backup/manifest. Public GitHub CI passed Windows and Linux source checks plus
the external PostgreSQL integration job. These Linux source checks do not
qualify the Linux desktop packages or custom native kernel.

### Installed identity update and runtime follow-up — 12 October

Browser **0.4.3** and the signed Workbench **0.5.5** add-on now run in the
actual per-user installation. The guarded upgrade verified a full backup of
43,054 files (555,541,950 bytes), inspected a disposable copy of the coordinator
database, checked idle processes and leases, and preserved every original
private file except the intended add-on registry change.

Extended installed qualification passed real Browser-owned automation,
extension startup/content execution, retained extension storage through an
independent archive import, London DST calendar previews and schedule
create/pause/remove. The archive measured 68,340 bytes with SHA-256
`38e726e7e4d22bb578fc1aaf81536b7f78e1be8e7bae3e7b914d52e213bd7476`.
The original profile baseline remained unchanged; all owned browsers stopped
and all leases were released. The Python SDK separately passed calendar and
schedule lifecycle checks against Workbench 0.5.5. The native desktop window
shows the original moth emblem, compact profile table and embedded Workbench.

The checked-span error in the original native canvas patch was corrected with
explicit `size_t` lengths. Its previously failed translation unit compiled
successfully using the exact pinned Chromium compiler command. The full
browser and native-test targets are still compiling. Their tests, copied
runtime and actual native activation have **not** passed yet. Installed stock
Chromium still exposes CPU 12 in the extension's first startup script while
the later content script sees CPU 4; the stock native candidate remains rejected.

One exact-head Windows CI run aborted in V8's WebAssembly code lifecycle; the
other passed. Workbench now requires the documented [Node.js 26 source
baseline](runtime-baseline.md). Its full local suite passed 149 tests, zero
failures and one optional external PostgreSQL skip. Three additional fresh
Node.js 26.11.1 coordinator-test processes each passed 14 tests with the one
external PostgreSQL skip; repeated executions are not counted as new features.
Browser's separate source repository passed its Windows/Linux CI after the
0.4.3 update and original compiler fix.
# Extension catalog removal — source qualification, 2026-10-12

The authenticated DELETE endpoint, Browser control, TypeScript client and Python client passed the owned extension fixture. Assigned profiles, including trashed profiles and saved Workbench runs, refuse removal. Concurrent initial assignment and deletion cannot admit a profile with a missing package. Invalid package IDs are rejected, missing packages return 404, and removal requires authentication.

The source Browser–Workbench run saved a verified 72,593-byte archive. After catalog deletion, an independent archive import retained its extension identity and storage (visits 3 → 4), and the original unassigned profile loaded its retained package/storage after reassignment (visits 2 → 3). Python removal and re-import retained the immutable ID. The visible confirmation, cancel, refusal, removal, empty list, upload/re-import and invalid ZIP recovery passed isolated UI qualification at 1366×768 and 1024×768; the extension controls fitted without horizontal overflow.

Full source validation for this feature: 26 Browser tests and 125 Workbench tests passed, with one optional external PostgreSQL test skipped. Local reports: `test-results/desktop-followup/extension-removal-check.log`, `test-results/extensions/local-pair-qualification.json` and `test-results/desktop-followup/extension-removal-ui.json`. This was source-only acceptance; installed qualification followed below. Native kernel compilation and acceptance remain pending.

### Installed Browser 0.4.4 / Workbench 0.5.6 — 12 October

The signed local Browser installer and Workbench add-on were applied to the existing per-user installation after an idle preflight. The complete backup contained 50,282 files (654,084,685 bytes). Its checksums passed, a disposable coordinator-database copy contained no active flows, and every original private file was preserved byte-for-byte except the intended add-on registry update.

Actual-installed extended qualification passed Browser-owned automation, calendar/DST preview, future schedule create/pause/remove, extension startup/content execution, independent archive import and catalog removal. Assigned-package removal was refused; retained profile copies/storage reached visit 3 after removal, and re-import retained the immutable package ID. The existing catalog and original profile settings remained unchanged. The saved archive measured 68,412 bytes with SHA-256 `a91fdfe4666f12c1f441c0162cb78a21be22f1e1cfeb26e680b8c2ae64ec638e`. Every owned browser stopped and all leases were released. Python independently passed calendar and schedule lifecycle checks against Workbench 0.5.6.

Direct inspection of the actual native desktop window confirmed the original moth emblem, all profile columns/actions at 1366 pixels, the preserved Personal/Default profile, the embedded Workbench, matching blue controls, the Extensions removal control and a visible fixed calendar action footer. The weekday 09:00 London preview showed 13, 14, 15, 16 and 19 October. No schedule was submitted during this UI review. Source UI qualification separately covered the 1280-pixel table and smaller Workbench form.

The release-audit addition passed the full source suite: 26 Browser and 129 Workbench/root tests (155 total), zero failures and one optional external PostgreSQL skip. Four regressions prevent old installed versions, upstream/CDP proof, changed executable/components, stale or failed native XML and an unfinished roadmap from satisfying the aggregate release gate. Local evidence: `test-results/desktop-followup/release-audit-check.log`, `actual-ui.json`, `installed-python.json`, `test-results/native-engine/installed-pair-qualification.json` and the private upgrade backup. Reports and profile archives remain excluded from public source.

The native compiler is still running. Stock Chromium still measured startup-worker CPU 12 while the later page/content policy measured CPU 4; that is not accepted custom-kernel proof. Linux packages passed structure checks but have not passed real Linux execution. The current standalone Workbench installer is built; this actual installation uses the Workbench add-on.
## Packaged Browser 0.4.5 / Workbench 0.5.7 — 12 October 2026

The current Windows packages and signed Workbench add-on passed **22 packaged checks**: seven proxy API/routing/preservation checks, nine extended automation/calendar/extension checks, and six desktop UI checks. A real bundled Chromium session reached an owned origin through an authenticated loopback proxy. Credential-preserving edits, stale revision refusal for editing and profile creation, running-profile assignment refusal, archive checksums, import without credentials, and Python assignment/edit/removal passed. Original profile manifests and connection inventory remained unchanged. The final proxy archive measured 65,319 bytes, SHA-256 `10f301cbdf9b0fc259ad9114b0e34b996b66e2d467abae2b6a7401ca867ca9d7`.

The packaged editor rejected an out-of-range port, kept saved credentials blank and disabled, created a profile from a saved reference, and recovered from an empty search result. At the as-launched 1364×795 content size, the proxy rows fitted within the window (998 px width). Direct native Windows inspection confirmed the embedded Workbench and its verified saved archive. Full source validation again passed 158 tests with zero failures and one optional external PostgreSQL skip. The production dependency audit reported zero vulnerabilities. Windows and Linux update/add-on signatures and artifact hashes passed; Linux packages passed structure checks only.

These are packaged acceptance results. The guarded actual-installed upgrade and its independent qualification are still pending. The proxy inventory check remains **source tested**; native kernel and Linux execution gates remain pending. Private evidence stays in `test-results/desktop-followup/packaged-pair.json`, `desktop-045-packaged-ui.json`, `test-results/proxy-inventory/packaged-pair.json`, and the local release manifest. Installers, credentials and private runtime reports are not published.

The release auditor also requires a separate `actual-installed-proxies` gate. It reads the installed desktop proxy report, requires matching Browser and Workbench versions, actual-installed proof, observed proxy traffic and a saved archive with a valid checksum. Packaged evidence, missing reports, stale releases, failed preservation, absent traffic and unfinished or unverified archives cannot satisfy it. All five release-audit regression tests pass locally; this addition does not promote the proxy inventory or native kernel status.

## Source proxy inventory qualification — 12 October 2026

The reusable Browser connection manager is implemented and source tested; it is not in the installed 0.4.4 / 0.5.6 desktop release. The source suite passed **158 tests** (29 Browser and 129 Workbench/root), with one optional external PostgreSQL skip. Full-suite testing caught and corrected a catalog queue-order regression: saved-proxy creation now preserves extension assignment/removal ordering under one catalog queue.

An owned authenticated proxy served a real Workbench-launched Chromium profile. Five integration checks passed, including the TypeScript and Python APIs, live-profile edit refusal, retained independent connection copies, verified save/export and import without credentials. The final run saved a 65,296-byte archive with SHA-256 `1202a7cde7584dc32f2febfd8a70d13e8272eed6f6fe60c6d5617fcb8cd8bbd8`. Nine source UI checks passed at 1366×900 and 1280×800; the latter table measured 998 px both visible and scroll width, and no renderer errors were observed. Native fingerprint and installed desktop evidence is unchanged. See [saved proxy connections](proxy-inventory.md).

## Actual installed proxy release acceptance — 12 October 2026

Browser **0.4.5** and Workbench **0.5.7** passed the guarded per-user upgrade, nine extended API/automation/extension/calendar checks, seven reusable-proxy checks and Python calendar/schedule acceptance. The complete private backup contained 57,516 files and 756,837,117 bytes; original checksums remained unchanged except the expected add-on registry. The installed Workbench used an owned authenticated loopback proxy, saved a 65,285-byte archive with a verified SHA-256 checksum, and imported a separate profile without proxy credentials. Running-profile replacement and stale revisions were rejected. Original catalogs and profile manifests were preserved.

Direct native Windows review confirmed the moth icon, Personal folder and Default profile, proxy empty state and editor, fitted profile table and native embedded Workbench with the saved run. Populated proxy create/edit/search and saved-reference UI workflows were separately qualified in the exact packaged release. Only the inventory acceptance check moves to desktop verified; native compilation, native tests, fingerprint coverage and real Linux execution remain pending. Private evidence is recorded in `test-results/proxy-inventory/installed-pair.json`, `test-results/native-engine/installed-pair-qualification.json`, `test-results/desktop-followup/actual-ui.json` and `installed-python.json`.

## Installed 0.4.6 / 0.5.8 and isolated Linux build — 12 October 2026

The guarded upgrade verified a private backup of 65,034 files (869,796,091 bytes). Browser 0.4.6 with its signed Workbench 0.5.8 add-on passed nine extended API checks, seven reusable-proxy checks, Python calendar/schedule acceptance, and three native-control input/refusal checks. The installed authenticated loopback proxy run saved a checksum-verified 65,303-byte archive; original profiles and connections were preserved. Windows review confirmed the moth mark, profile table, embedded Workbench, saved run and proxy editor. No custom kernel was activated. Workbench summarizes backend failures; the refusal test checks the Browser's specific admission error directly and verifies the stopped profile has no lease.

The installed Inspect dialog forces JSON because it treats all root `allOf` rules as complex. The source correction permits conditional rules that constrain fields already represented in the form, while retaining JSON for genuine composite schemas or branch-defined fields. Server validation remains authoritative. Ordinary native selectors and switching to JSON and back passed in an owned source UI instance. The relative helper module is retained in each immutable asset revision and participates in its hash. This correction is not yet installed. The latest complete source suite passed 182 tests (39 Browser, 143 Workbench/root), zero failures and one optional external PostgreSQL skip. Linux native receipts now include `.so` and versioned shared libraries; three Ubuntu checks passed for inside-directory soname links, changed/missing libraries and outside-directory rejection. These checks do not qualify an actual kernel or Linux installation.

An explicitly authorised isolated Ubuntu account passed 177 tests from the pinned public source (37 Browser, 140 Workbench/root; the Windows-only junction and external PostgreSQL checks were skipped) and 4,141 standalone C++ policy assertions. Its Chromium checkout/build is separate from the cached Windows compiler. No private desktop data or vendor binaries were transferred. Full compilation, unit tests, runtime masking, Linux sandbox/installers and copied-runtime acceptance remain pending; no roadmap item is promoted from these build preparations.

## Windows native kernel, 13 October 2026

The complete native kernel passed 26 native unit executions and nine direct plus nine copied-runtime cases. Actual Browser 0.4.6 / Workbench 0.5.8 guarded activation passed seven checks and saved a checksum-verified 76,436-byte archive. Four further installed checks verified persisted canvas/offline-audio identity through restart and archive/import, different identities for fresh profiles and preservation of original profile metadata. See the [qualified scope and remaining boundaries](native-kernel-qualification.md). Linux runtime and broader masking remain pending.

## Bundled native Windows release, 13 October 2026

Browser **0.4.7** and Workbench **0.5.9** passed local packaging and actual per-user installation. Both full installers include the qualified native kernel and each copied binary passed all nine native cases. The Browser installer is 668,306,618 bytes; the separate Workbench installer is 681,492,986 bytes. End users need no Chromium source checkout. The installed pair uses the signed Workbench add-on inside Browser; the standalone Workbench installer passed isolated package qualification.

The exact packaged desktop passed 30 checks: seven desktop checks, seven native integration checks, nine extended API checks and seven proxy checks. Inspect's ordinary form displayed its native engine, GPU, offline-audio and font selectors; switching between form and JSON retained selected native policy values. Package production audits reported zero vulnerabilities. Local update and add-on signatures passed against the installed trust key; this is not Authenticode publisher certification.

The guarded upgrade verified a full private backup of **73,227 files (1,019,052,338 bytes)**, inspected an offline database copy and preserved every original file byte-for-byte except the intended add-on registry. Bounded parallel checksum readers shortened the preflight without omitting files or hashes. Reusing an interrupted backup requires its exact sibling location and a fresh comparison of every byte against the source; an already-applied backup is rejected.

The actual installed native engine resides in the application's resources. Fresh nine-case qualification and stopped-profile backups preceded activation. Seven Browser–Workbench native integration checks, nine extended API checks, seven proxy checks, four persisted-identity checks and independent Python calendar/schedule checks passed. The native run saved a verified 76,518-byte archive. Original profiles, credentials and connection inventory were preserved; every owned test browser stopped and its lease was released.

Direct native Windows UI review confirmed the original moth emblem, retained Personal folder and Default profile, fitted profile table and embedded Workbench. Inspect opens ordinary fields, including the three native policy selectors and their coverage descriptions. Its default values survived form → JSON → form; the unsaved dialog was cancelled without starting a run. Selected-policy round trips were independently tested in the exact packaged release.

Full source checks passed **191 tests**: 48 Browser and 143 Workbench/root, zero failures and one optional external PostgreSQL skip. The separate Browser checkout passed all 48 tests. Private receipts remain local in `test-results/desktop-047/packaged-pair.json`, `test-results/desktop-followup/actual-ui.json`, the installed native/API/proxy/identity reports and the checksum-verified upgrade backup. No binaries, keys or profile archives are published. This packaging milestone does not promote broader masking or Linux runtime checks: **74 of 102 named feature checks remain verified**.

## Workbench 0.5.10 installed recovery follow-up, 13 October 2026

Browser 0.4.7 remains installed with the same qualified bundled native kernel. The new signed Workbench 0.5.10 add-on and full standalone installer passed 196 source tests, zero production dependency vulnerabilities, copied-runtime qualification, 35 packaged pair checks and five standalone startup/form/layout checks. The standalone full installer is 681,498,477 bytes; the optional add-on is 22,389,855 bytes and contains no browser executable.

A fresh full backup verified 82,083 private files (1,200,880,098 bytes). The guarded add-on-only upgrade preserved all original bytes except its registry, retained prior enablement and reused the same data store. Five actual recovery checks passed: automatic failure and lease cleanup after only the exact newly owned native process was interrupted, followed by a normal checksum-verified 65,852-byte Finish archive. Detection took 328 ms in this fixture. Six actual UI checks passed for visible results and the fixed form. See [scope and recent-write limitation](native-process-recovery.md).

Six further installed extension checks qualified version/permission reporting and immutable-package enforcement, including real native execution of both versions and launch/export refusal after alteration of only an owned fixture. The original catalog and profile metadata remained unchanged. These two named checks move from source tested to verified: **76 of 102** roadmap checks are now installed verified (Browser 39/54; Workbench 37/48). Broader masking, Linux runtime and the full forced-exit/recovery matrix remain pending. No keys, private profile data, archives or binaries are published.


## Resumed proxy outage and Linux packaging checks, 13 October 2026

The same installed Browser 0.4.7 and signed Workbench 0.5.10 passed nine additional owned HTTP/SOCKS5 outage/recovery checks with the exact qualified native kernel. Existing and fresh-page HTTP navigation failed while the owned upstream was unavailable, despite the destination remaining directly reachable. No direct browser request reached that origin. Restarting the upstream restored routing in the same lease; Finish verified the archive and released the stopped profile. Original profiles and reusable connection entries were unchanged. [Scope and repeatable helper](proxies.md). DNS/UDP/WebRTC/IPv6, HTTPS outage, unavailable-proxy startup and rotation remain unqualified.

The full Windows source check passed 199 tests (48 Browser, 151 root), zero failures and two explicit skips: external PostgreSQL and Linux-only installer execution. The independent Browser check passed 48 tests plus three package tests. Ubuntu CI executed the fourth portable-installer test, which preserves neighboring data and existing versions and refuses changed package bytes. Both current public main commits passed CI. These installer fixtures do not qualify an installed Linux desktop.

The inventory is now **77 of 106** named checks verified, including four planned documentation requirements added to the previous 102-check inventory. Actual Linux native runtime, broader masking and full-product acceptance remain pending. Applications, private keys, profiles, archives and raw vendor analysis remain private.

Native identity follow-up (13 October): Browser 0.4.8 / Workbench 0.5.11 source passes 206 tests (zero failures, two Windows environment skips). Bounded native/4-thread/8-thread hardware policies, observed-page consistency checks and qualification-aware surface reporting are implemented. Five fresh real-kernel integration checks and normal Browser/Inspect UI workflows passed in isolated stores. Windows installers are being qualified; the user’s installed pair remains 0.4.7 / 0.5.10 pending the idle/backup upgrade gate. Linux compilation, 26 native unit executions and all nine direct runtime cases passed after the explicitly approved workspace-only sandbox rule and an owned font dependency fixture. Copied-runtime, packaging and actual installed Linux acceptance remain pending. [Scope and API](native-identity.md).
