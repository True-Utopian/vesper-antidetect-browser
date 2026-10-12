# Vesper completion gates

By **true-utopian**. Updated 12 October 2026. Applications and private data remain local; public source is prepared separately.

Vesper is an incomplete product, not yet a qualified replacement for Kameleo, Multilogin or Dolphin Anty. Passing a feature test does not complete the product. There is no defensible overall completion percentage while the vendor research and requirements remain incomplete.

The actual installed pair is Browser **0.4.2** with Workbench **0.5.4** as an enabled native add-on. It launches real Chromium, shares a Browser-owned profile store, and has passed extension-enabled automation, calendar scheduling, shutdown and verified export/import. The upgrade verified a complete backup and preserved every original private file except the intended add-on registry update. TypeScript and Python calendar clients passed against the installed loopback services. The custom kernel remains a separate compilation and qualification gate.

| Area | Current evidence | Required before this area is complete |
| --- | --- | --- |
| Original native kernel | Pinned Chromium checkout, original CPU/memory/RGBA8 canvas patches; Windows compilation running | Successful build, 26 native unit-test executions, direct first-script/worker/client-hint/canvas qualification, copied-runtime qualification, Browser activation and Workbench run with that exact binary |
| Fingerprint coverage | Native source covers CPU, memory and RGBA8 canvas; locale/timezone and some environment settings use CDP | Coherent UA and client hints, OS/platform, GPU/WebGL/WebGPU, audio, font and media exposure; headed screen consistency; supported-surface matrix and restart/origin/worker testing |
| Persona generation | Independent per-profile persisted canvas seed; supported settings validated | Original coherent persona generation and validation. Arbitrary settings must not produce contradictory identities. No vendor fingerprint database has been recovered |
| Extension management | Packaged Browser/Workbench passed an original MV3 fixture, startup worker, independent archive import and retained storage; long Windows profile paths have a qualified launch workaround | Broader extension compatibility, removal and version migration tools. Keyless packages currently receive a per-package identity; switching versions does not migrate their storage |
| Browser management UI | Profile table, search, folders, favorites, tags, notes, context menus, stopped-profile editing and archives | Larger collection performance, configurable columns, richer connection/cookie management and usability comparison across complete workflows |
| Proxy management | HTTP/SOCKS5 credentials, local bridge, health/policy support and owned outage-navigation checks | Browser inventory editing/assignment/rotation workflows; whole-browser DNS, UDP, WebRTC and IPv6 capture, outage and startup verification |
| Live synchronizer | Not implemented | Master/follower selection and input propagation with explicit stop, ownership and recovery controls |
| Recording and visual automation | Scripts, published durable flows, graph editing, inspector, undo/redo and drafts exist | Interaction recorder; accessible branching, loops, extraction and recognition controls without requiring advanced JSON; replay and recovery tests |
| Scheduling | Durable encrypted-input schedules, calendar/cron/IANA-timezone rules, London DST preview and create/pause/remove lifecycle; packaged calendar UI has a visible fixed-footer action | Broader clock-change and recovery cases, desktop wakeup behavior and capacity measurements |
| APIs and integrations | Versioned authenticated Browser/Workbench APIs, leases, revisions, archive streaming and TypeScript/Python clients | Additional client/framework qualification, including Selenium; complete schema and event coverage for new features |
| Engine/platform alternatives | Chromium runs; optional upstream Brave privacy engine measured | Firefox implementation and qualification; mobile/device/emulator implementation. Desktop viewport emulation is not a mobile engine |
| Installers | Browser 0.4.2 and Workbench 0.5.4 Windows installers, signed offline add-on and Linux amd64 packages built; packaged pair and Linux package structure tested | Qualified custom kernel packaged together; clean Windows install/rollback and standalone Workbench installer execution; real Linux compilation, launch, sandbox and installer/update tests |
| Updates and recovery | Offline signature validation, staged engine tests and stopped-profile backups | Complete installer/kernel/add-on failure-and-rollback cycle, crash recovery matrix and retained-data migration proof. No hosted feed is being published |
| Persistence and scale | Isolated stores and archives; run leases and durable admission; extension data retained through independent store import | Cross-PC encrypted cookie migration; broader IndexedDB/cache/service-worker isolation; forced-exit recovery and measured large-inventory/concurrency benchmarks |
| Roles and sharing | Single local administrator | Local accounts, roles and explicitly authorized sharing. Vendor-hosted teams/cloud phones are outside the current local-only build |
| Vendor research | REA-derived desktop/API/CLI boundaries and documented gaps | Controlled runtime lifecycle and fingerprint-policy evidence. Complete native masking engines have not been reverse engineered |

## Current acceptance records

- Installed pair: `test-results/native-engine/installed-pair-qualification.json`.
- Local extension Browser/Workbench run: `test-results/extensions/local-pair-qualification.json`.
- Extension UI import/assignment/removal and viewport checks: `test-results/extensions/ui-qualification.json`, `catalog.png`, `profile-assignment.png`.
- Upstream Chromium/Brave context regression: `test-results/native-engine/qualification.json`. This explicitly does **not** qualify the custom kernel.
- Stock Chromium rejected as a native-kernel candidate: `test-results/native-kernel/stock-host-admission.json`.
- Native compilation and post-build gate: private `.workbench/kernel-toolchain` records. A waiting or failed record is not a passed gate.

The 12 October source suite passed **149 tests**: 24 Browser tests and 125 Workbench/root tests. One optional external PostgreSQL test was skipped. Packaged extension automation saved a 68,657-byte archive whose SHA-256 matched its recorded artifact; importing it into another profile retained extension storage. A detached Browser service retained its owned running profile after its desktop manager exited, then stopped cleanly. Stock Chromium failed the native gate at extension-worker startup (CPU 12 instead of 4); the failed candidate remained rejected. These tests do not qualify a custom native binary, Linux runtime or vendor parity.

Raw vendor analysis remains private. Public conclusions distinguish documentation, static inference and measured behavior. Performance superiority and detection bypass are not established by these tests.
