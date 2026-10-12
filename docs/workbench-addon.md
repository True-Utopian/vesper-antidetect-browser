# Workbench inside Vesper Browser

Vesper Browser is the main profile application. Vesper Workbench is an optional locally installed automation add-on. Both are original open-source software by **true-utopian**. Browser works without Workbench installed.

Install Browser, then open **Add-ons → Install Workbench**. Choose the `Vesper-workbench-0.5.4.vplugin.tgz.vesper-plugin.json` manifest beside its matching `.vplugin.tgz` package. Browser verifies its pinned Ed25519 signature, size and SHA-256 digest and shows the add-on permissions before installation. Choose **Open Workbench**, or its new sidebar entry, to use runs, archives, flows and schedules inside the Browser window. **Browser profiles** in Workbench returns to the main manager.

The package includes JavaScript/WASM services and production dependencies; it includes no second browser executable, vendor SDK, private signing key or profile store. The public release key is shipped with Browser. A different publisher's key is not automatically trusted. This is a dedicated Workbench add-on contract, not a general sandbox for arbitrary third-party code. The automation service runs with the user's desktop permissions.

Profile storage, proxy secrets and browser processes remain owned by Browser. Workbench connects to its authenticated loopback API. Native host code attaches the credential only to the matching local service; the renderer receives no token through the add-on bridge. Separate sandboxed web contents render Workbench in the right-hand workspace. Navigation and new-window requests cannot leave its service origin.

The data root is `%APPDATA%/true-utopian/vesper` on Windows and `$XDG_DATA_HOME/true-utopian/vesper` (or `~/.local/share/true-utopian/vesper`) on Linux. Workbench continues to use the `workbench` subdirectory for its saved runs, encrypted schedule inputs, flows and exports. Installed package versions live under `plugins/workbench/versions`; enabling/disabling changes the registry without deleting user data. Close standalone Workbench before opening the add-on: both use the same store and cannot own it simultaneously.

Switching Browser pages hides the Workbench view and keeps its service and schedules running. An enabled add-on resumes its service and schedules when Browser starts. Disabling the add-on or quitting Browser stops the owned automation service before Browser. Finish/cancel active runs and complete their cleanup first. Schedules require Vesper to remain running; closing the window to the tray retains that process. Disabled add-ons do not run schedules.

## Building locally

Use Node 24 or newer. Run `npm ci`, `npm run build`, then `node scripts/desktop-build.mjs workbench win32 --dir` (or `linux --dir`) to stage production dependencies. `npm run package:workbench-addon` creates and signs the two files in `release/addons`. The packer refuses native binary dependencies in the cross-platform package. Windows and Linux x64 are declared targets; Linux runtime qualification is reported separately from package structure.

The release signing private key remains in ignored `.workbench/release-signing`; do not distribute it. Build Browser using the same local public key. The standalone Workbench installer remains available for users who prefer a separate app.

## Scope

Profile folders, favorites, metadata, search, selection, bulk operations, menus and pagination are backed by the Browser API. Workbench retains scripts, visual flow publication, run controls, exports and elapsed-interval scheduling. This release does not establish parity with proprietary native fingerprint engines, Firefox/mobile engines, extension management, cloud collaboration or action synchronization. See [profile workspace research](research/profile-workspace-findings.md) for what the vendor observations actually establish.
