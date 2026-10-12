# Vesper expansion QA inventory

Local qualification for Browser 0.2 / Workbench 0.3. Test data stays under test-results/expansion, separate from the user's running services.

- Native startup: as-launched placement, initial workspace and attribution; renderer error capture.
- Flow editor: new flow, validation, settings, target and input authoring, routes, node dragging, undo/redo, saved layout, publish, duplicate, export/import, stale revision rejection. Execute a published flow through the normal run controls.
- Scheduler: create with schema inputs, visible status, pause/resume/remove, admission of due work, terminal status, restart persistence, encrypted inputs and uncertain admission quarantine.
- Browser manager: open from Workbench; independent Chromium/Brave profiles, metadata, folder filtering, selection, templates, trash/restore, running-profile edit restrictions, cookies and measured environment.
- Engines: staged official Brave digest, activate with backups; open headed native engine, CDP automation and archive persistence. Inspect canvas samples across isolated profiles and frame/worker surfaces without guaranteeing vendor-grade masking.
- Updates: signed local manifest, pinned release key, version/product/platform/checksum rejection; verify rebuilt artifacts' manifests. Installer execution and data retention smoke on Windows; Linux artifact inspection, native Linux unavailable here.
- Visual: initial workspace, dense graph inspector and schedule list, browser editor, templates/trash/update dialogs, 680px native minimum. Check borders, text, clipped controls, dialog footer and header wrapping. Explore the interfaces using ordinary input after scripted checks.

Completed results and exclusions are recorded in [validation](../validation.md). Fresh Windows installations completed script, published visual flow and scheduled script runs; all three survived restart. Both uninstallers returned zero and retained data. Native Linux and the complete interactive updater installation cycle remain unqualified.
