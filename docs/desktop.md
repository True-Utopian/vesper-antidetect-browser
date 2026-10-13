# Vesper desktop applications

Original source by **true-utopian**, MIT licensed. Vesper Browser is the main profile app. Vesper Workbench installs as a [signed local add-on](workbench-addon.md) and runs scripts and durable flows inside Browser's window. Separate executables and installers remain available for standalone use. Neither desktop application requires an operator-installed Node.js, Kameleo account or Multilogin account.

## Local artifacts

`release/browser/win32` and `release/workbench/win32` contain assisted per-user Windows x64 NSIS installers. The full Windows builds include the tested free Chromium snapshot and can also bundle a qualified Vesper native kernel. Runtime hashes and fresh copied-native proof are checked during packaging. Installer/update and add-on manifests have local offline signatures; no Authenticode publisher certificate or hosted update service has been configured. [Bundled native engine and guarded upgrades](windows-native-installer.md).

`release/browser/linux` and `release/workbench/linux` contain amd64 Debian packages and portable tar archives. The light Linux packages download free Chromium through **Install Chromium** in Browser. Package structure, executable permissions and the x64 ELF architecture are checked on this Windows PC. Native Ubuntu installation, library compatibility, desktop operation and sandbox behavior still require Linux qualification. WSL on this PC reports `REGDB_E_CLASSNOTREG`; no Linux execution claim is made. AppImage and other distributions/architectures are pending.

Every artifact folder has `SHA256SUMS`. Npm dependency notices and their package lock travel with the service payload. Electron's licence and Chromium notices travel with its runtime. The Browser engine and Electron renderer are separate processes.

## Storage and connection

The default private application data root is:

- Windows: `%APPDATA%/true-utopian/vesper`
- Linux: `$XDG_DATA_HOME/true-utopian/vesper`, defaulting to `~/.local/share/true-utopian/vesper`

The `browser` subfolder contains the profile store, proxy vault, access token, API journal and `service.json`. The `workbench` subfolder contains its access token, `service.json`, scripts, flows, drafts, schedules, exports, separate script/flow journals and persistent embedded PGlite database. Electron preference folders are separate. Existing repository `.workbench` / `.vesper` stores are not moved or overwritten automatically.

Both applications discover the same Browser owner in this data root. Workbench starts that owner when necessary and validates its API version. Listening ports are allocated by the OS, so occupied development ports remain untouched. `service.json` provides the product, API version, PID and port for external clients. Credentials stay in private `admin-token` files; they are not put in URLs. The native shell supplies API authentication without copying the token into renderer storage.

Closing a window hides it; the tray restores it. **Quit** drains Workbench. Browser asks how to handle active profiles before an explicit quit. Releasing a Workbench client leaves independently owned Browser windows running. Uninstallation keeps the private data folders. Removing them is a separate operator action.

The default local coordinator runs one job at a time across the script and flow modes. Its local database is serialized, persists transactions and has an exclusive process owner. It is not a substitute for multi-node PostgreSQL advisory locks. Script workers use the packaged Electron executable in Node mode; profile browsing uses the independent Chromium executable.

## Build from source

Node.js 24 or newer is needed for source builds, not for installed desktop applications.

```sh
npm ci
npm run check
npm run package:windows
npm run package:linux
npm run package:workbench-addon
npm run package:source
```

After completing and recording installed acceptance, `node scripts/release-manifest.mjs` verifies the current Windows/Linux installer signatures and writes the local `release/RELEASE.json` and aggregate `SHA256SUMS`. It requires the recorded private acceptance results, exact accepted Windows installer hashes, complete check log and production audit. Rebuilding an installer requires fresh acceptance. It does not publish anything.

The full Windows build reads this repository's tested `.workbench/local-engine/browser.json` cache. Install that cache with `npm run browser:install` before the full build. `node scripts/desktop-build.mjs browser win32` produces a light Windows installer; use `workbench` for its partner. Platform builds only write local artifacts and use `publish: never`.

`npm run package:source` creates a source archive and checksum from explicit public inputs. It excludes dependencies, compiled output, tokens, profile data, private research and test evidence. The source contains both projects and their build scripts.

For source desktop iteration, `npm run desktop:workbench` opens the common shell. `VESPER_DESKTOP_DATA_DIR` selects an isolated development store; `VESPER_BROWSER_EXECUTABLE` selects an existing free Chromium executable. Renderers run with Node disabled, context isolation and Electron sandboxing enabled. Source and CLI interfaces remain available without Electron.

## Public interfaces

Both services retain `/api/...` and provide `/api/v1/...`, authenticated capability reporting and `/api/v1/openapi.json`. Browser supplies profile revisions, lease-protected lifecycle operations and cursor-based journal replay. Workbench supplies run admission with `Idempotency-Key`, run controls, challenges, snapshots, evidence and archives. An interrupted admission is quarantined rather than automatically repeated.

Browser leases do not expire automatically. Lease expiration would not prove a browser stopped. A profile cannot be edited, opened, stopped, copied, connected or exported by an ordinary manager action while a run owns it. `/api/v1/profiles/{id}/interrupt` is the explicit administrator recovery action; it confirms stop before clearing ownership.

The TypeScript clients are `VesperBrowserClient` and `VesperWorkbenchClient`. The standard-library Python clients live in `sdks/python/vesper.py`:

```python
from vesper import Browser, Workbench

browser = Browser.from_directory("/path/to/vesper/browser")
workbench = Workbench.from_directory("/path/to/vesper/workbench")
print(browser.capabilities())
run = workbench.submit("inspect", {"url": "https://example.com"},
                       idempotency_key="my-inspection-0001")
print(run["id"])
```

The bundled sign-in/verification flow exercises an owned local fixture. Operator flows and trusted script modules are installed in the data folder. Browser 0.2 and Workbench 0.3 add a visual flow editor, durable schedules, profile organization/templates/trash, cookies, pinned engine activation with backups, and signed offline application updates. Chromium is included in full Windows installers; optional Brave is a free upstream engine download. Complete Kameleo/Multilogin/Dolphin fingerprint parity is not implemented or asserted.

## New local workflows

Browser 0.2.1 / Workbench 0.3.1 add permanent navigation and plain workflow guidance. Browser's profile editor separates General, Proxy, Environment and Start pages; Open/Stop and Edit stay visible while More holds occasional actions. Templates, proxy assignments, trash and engine downloads have named destinations. Environment reports show readable observed values, with technical JSON under a disclosure.

Workbench keeps Runs & archives, Flow editor, Schedules, Browser profiles, Proxy inventory and Connections & API in its navigation. Flow editor and Schedules are full workspace pages; use Back to runs or the navigation to switch. Edits remain in memory while changing pages; choosing another flow asks before discarding unsaved changes. Save a draft to persist it. Published flows are fetched immediately when New run opens.

Use **Profiles** in Workbench to open the full native Browser manager. Templates copy settings without proxy credentials. Folder, tags, notes, status and start pages persist in each profile. Trash is reversible and refuses active or leased profiles. Archives and JSON cookies can be exported and imported from the manager. Desktop downloads are saved under the private data root's `downloads` folder; use **Vesper → Show downloads**. Browser cookies exported as JSON include private session values. Only compatible same-OS archives are supported.

**Flow editor** presents the library, draggable graph and settings inspector. Create/duplicate/import a flow, define targets and inputs, change state routes, save a validated draft, and publish it into the automation list. Draft revisions reject stale edits. Published runs retain their compiled hash and snapshot even when a draft changes. Graph layout persists separately from execution semantics. The advanced JSON editor exposes the complete supported FlowPack contract, including review/input steps and recovery policies. The starter local flow binds to the owned fixture's current port when the service restarts.

**Schedules** accepts an automation, its schema inputs, a local displayed date/time, and an optional hourly/daily/weekly elapsed interval. The persisted timestamp is UTC milliseconds; intervals are elapsed time, not timezone-aware calendar cron. Schedule inputs use the local authenticated encryption vault. The scheduler admits one due occurrence when prior work and cleanup have finished. Missed intervals coalesce. Interrupted admission is quarantined rather than retried blindly. Closing Workbench stops its scheduler; no system wake-from-sleep service is installed. Pause/resume affects future occurrences, while active runs retain their own run controls.

**Engine updates** stages pinned Chromium revisions or official Brave versions. Brave downloads must match the SHA-256 digest and size in its official release metadata; ZIP extraction rejects links and unsafe paths. Activation requires stopped, unleased profiles and saves archives before selecting the engine. Backups permit an explicit compatible restore; arbitrary browser downgrades and cookie portability are not guaranteed. Upstream native resources and licences remain intact.

Brave uses upstream [native fingerprint protection](https://brave.com/privacy-updates/4-fingerprinting-defenses-2.0/), including site/session-dependent behavior. It is not a custom Vesper Chromium fork. Environment policies use browser switches and CDP, without JavaScript prototype replacement. The owned Windows fixture measured page/frame locale/timezone and CPU, exact Chromium screen metrics, rounded Brave screen values, and differing Brave canvas samples in isolated profiles. Worker CPU differs when a page-only override is chosen. These are qualified scenarios, not all-site or all-worker consistency claims; see validation.

**App update** or **Vesper → Install local update** opens an offline `.vesper-update.json` sidecar next to an installer. The shell verifies the pinned Ed25519 release key, matching product/OS/architecture, newer version, installer size and SHA-256 before offering installation. It drains services and backs up both data stores, then opens the verified local installer. Windows Authenticode signing is separate and remains unconfigured. Each local build machine retains its private release key under gitignored `.workbench/release-signing`; the source archive carries no private key. Updates built with a different key are rejected unless a deliberate key migration is implemented. A hosted update feed and automatic rollback are not supplied.

Starter examples carry hashes so future app upgrades update unchanged examples while keeping user-modified files. Existing custom scripts and published flows are preserved.
