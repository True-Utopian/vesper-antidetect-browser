# Installed Windows acceptance

Vesper Browser **0.4.8** and its signed Workbench **0.5.11** add-on passed actual per-user installation and integration on 13 October 2026. This acceptance uses the existing desktop installation and private profile store. It is separate from the 19 packaged-pair checks and five standalone Workbench UI checks.

## Upgrade and preservation

The application quit normally after authenticated checks found no running profiles, active runs or enabled schedules. The guarded helper verified the packages against the installed trust key, copied and checksum-verified **90,637 private files / 1,363,047,371 bytes**, and inspected a disposable copy of the coordinator database. No active managed flows remained. It then applied the Browser installer to the existing per-user directory and atomically installed the add-on, retaining its enabled state.

Every original private file remained byte-identical except the intended add-on registry update. Original profile settings and metadata also remained unchanged through the runtime tests. A normal Quit/restart retained both installed versions, the enabled add-on and all 31 saved/historical run records. Private backups, profiles, credentials and signing keys remain local.

## Measured checks

| Area | Actual installed result |
| --- | --- |
| API, extensions and calendar | Nine checks: first-script environment, extension startup/content/storage, executed independent archive import, assigned-package removal refusal, retained extension storage, London DST and future schedule lifecycle |
| Proxy manager | Seven checks with a real bundled browser and an owned authenticated loopback proxy; saved export checksum and original profiles/connection inventory preserved |
| Native identity | Six checks: 4/4 and 8/8 presets agree in first script, dedicated worker, frame and HTTP memory/UA/full-version hints; observed identity audit and bounded WebGL/audio/font assertions pass; restart and executed archive import preserve identity; Workbench saves a verified native archive |
| Python SDK | London DST preview and future schedule create/pause/remove against installed Workbench 0.5.11 |
| Desktop UI | Seven separately reviewed checks: native/custom/4/8 controls, save/reopen/cancel, fourteen ordinary Inspect fields, form/JSON round trip, 8/8 native run and verified save, cancelled form, idle add-on disable/re-enable, launched and smaller native windows |

The UI-created native run saved a **146,327-byte** archive with SHA-256 `b1eed523b825adf9a6671cd19c41e2e0718367f71331bb888a9950116e07a05f`. Its first script reported eight CPU threads and eight GB of device memory. The Workbench rendered as a native child view within Browser. At the smaller window, fields and responsive run details scroll intentionally; form actions remain visible.

The Windows custom kernel remains SHA-256 `2bad582f23e0e67e8143fbc9906b9ddf0e4c2e48f897ac1459e5f7895ad5402f`. Its prior 26 native unit executions, nine direct cases, nine copied-runtime cases and guarded activation remain valid. These tests did not rebuild Chromium or replace its cached output.

## Repeatable installed identity check

From the Workbench source checkout after building its clients, with the installed pair running and idle:

```text
node scripts/qualify-installed-identity.mjs --data-root <installed-private-store> --kernel-sha <qualified-executable-sha256>
```

The helper connects to the actual authenticated desktop services; it creates no substitute Browser or Workbench server. It creates owned loopback fixtures and profiles, executes restart/archive tests and an Inspect run, verifies original profile metadata, and trashes only its owned profiles. The resulting private receipt records matching versions and actual-installed proof. It must be run with a qualified native kernel, not upstream Chromium. The separate API and proxy helpers retain their own receipts.

## Remaining work

The release audit now passes **14 of 15 aggregate gates**; the full implemented-roadmap gate remains pending at **78 of 106** named checks. This release acceptance does not add roadmap features. Arbitrary OS/GPU personas, full WebGL/WebGPU, realtime/device audio, complete font/media coverage, broader network/recovery/scale matrices and the wiki/site/local API Docs requirements remain unresolved. It does not establish complete vendor parity, superior performance or detection avoidance.

By **true-utopian**. Applications and raw qualification receipts remain private; this document and the original helper are public source.
