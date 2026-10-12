# Vesper Browser in Vesper Workbench

Vesper Browser by **true-utopian** is an independent MIT-licensed profile engine in `packages/vesper-browser`. Vesper Workbench consumes its public API through `src/local-engine.ts`. It launches free Chromium directly through Puppeteer. It requires no Kameleo service, account, licence, fingerprint subscription, or cloud workspace. Proxy services are supplied by the operator; the engine also supports direct connections.

For the standalone browser package and CLI, see [Vesper Browser](../packages/vesper-browser/README.md). For the two projects' shared identity, see the [design brief](design/vesper-identity.md).

The [independent product roadmap](design/local-browser-roadmap.md) defines the original implementation boundary, remaining evidence gaps and measurable acceptance criteria for improvements.

## Start on this PC

```powershell
npm ci
npm run browser:install
npm start
```

In another terminal, run `npm run token --silent`. Open `http://127.0.0.1:3180` and sign in with that token. Select **Profiles** to create, edit, open, stop, duplicate, export, or import browser profiles. Existing **New run** scripts operate through the same local engine.

The browser download and profiles are stored under `.workbench/local-engine`. Script run records and the local workbench token default to `.workbench/local`, separate from older Kameleo records. Nothing is uploaded to GitHub or a cloud profile service. Browser pages still contact the sites you open, through the selected proxy if configured. Initial browser installation contacts Chromium's download service.

The service binds to loopback by default. One browser-owner process holds each profile directory. Stop that owner before using offline profile commands against its directory. Profiles with an unconfirmed live browser cannot be exported or edited. Run-owned profiles use the existing run controls. Stop manually opened profiles before starting new automation runs.

## Independent Browser service

Run `npm run browser:serve` from the repository root to open Vesper Browser's manager at `http://127.0.0.1:3181`. Install Chromium beforehand with `node packages/vesper-browser/dist/cli.js install`, or select an existing executable through `VESPER_BROWSER_EXECUTABLE`. Its default private store is `.vesper/browser`; `npm run browser:token --silent` retrieves its own access token.

Start Workbench with `npm run start:connected` to use that running Browser owner. This loads `vesper.local.env`, setting `VESPER_BROWSER_URL=http://127.0.0.1:3181` and `VESPER_BROWSER_TOKEN_FILE=.vesper/browser/admin-token`. Both apps show the same profiles; Workbench connects through the package's public authenticated client instead of acquiring a second store lock. Browser owns window shutdown and storage, while Workbench downloads archives and verifies them locally. Closing the Workbench client leaves the Browser service running.

The service connection accepts only a numeric loopback HTTP origin with an explicit port. Requests reject redirects, and tokens are read from a private local file. Browser API exports stream a service-created temporary archive; callers cannot supply server filesystem export paths. The service's browser capacity is set by `VESPER_BROWSER_MAX_CONCURRENCY`; match Workbench's `MAX_CONCURRENCY` to it. A manually opened browser blocks new Workbench automation admission. A local administrator can still stop an automation-owned window from the independent manager; that interrupts the run and requires inspecting its failure state. A shared per-run control lease is pending.

## Configuration

| Variable | Purpose |
| --- | --- |
| `BROWSER_BACKEND=local` | Default backend; `kameleo` selects the existing licensed adapter |
| `LOCAL_BROWSER_EXECUTABLE` | Use your own Chromium executable instead of downloading one |
| `LOCAL_BROWSER_DIR` | Separate private browser/profile directory |
| `LOCAL_BROWSER_BUILD_ID` | Pin a Chromium snapshot revision, e.g. the locally tested `1716330` |
| `VESPER_BROWSER_URL` | Optional independent Browser service origin on `127.0.0.1` |
| `VESPER_BROWSER_TOKEN_FILE` | Browser service token file; separate from the Workbench token |
| `LOCAL_BROWSER_HEADLESS=false` | Native headed windows by default |
| `MAX_CONCURRENCY=1` | Maximum live local browsers |
| `WORKBENCH_DATA_DIR` | Override state/token location; use distinct directories for different backends |
| `DEFAULT_PROXY_INVENTORY_IDS` | Comma-separated inventory IDs used by script runs without their own proxy hook |

`browser:install` resolves a Chromium snapshot revision, downloads it once, and records its executable path. Normal browser starts reuse that installation without downloading anything. Running the installation command again can update an unpinned revision. Chromium retains its real browser and OS identity.

## Proxies

Use **Profiles → Proxy connection** to enter an HTTP/CONNECT or SOCKS5 host, port, username, and password. Credentials are encrypted with the existing AES-GCM vault and stay out of public profile metadata, process arguments, and profile archives. The vault key lives on this PC; its encryption does not protect against another process with access to that key or your user account.

Each proxied browser uses a private loopback proxy bridge. The bridge authenticates upstream, including SOCKS5 username/password authentication. Chromium uses the bridge for its HTTP traffic, including localhost destinations; QUIC is disabled and WebRTC is configured to disable non-proxied UDP. This is browser-level configuration, not an OS firewall or a guarantee that every browser subsystem can never make a direct network request.

HTTP proxy usernames cannot contain a colon because HTTP Basic authentication separates username and password with a colon. HTTPS destination pages use CONNECT through the HTTP proxy; this setting does not mean the connection to the proxy itself uses TLS.

Script runs can use the existing proxy manager without changing scripts. Example private `proxy-inventory.json`:

```json
[
  {
    "id": "proxy-one",
    "protocol": "http",
    "host": "your-proxy-host",
    "port": 8000,
    "usernameEnv": "MY_PROXY_USERNAME",
    "passwordEnv": "MY_PROXY_PASSWORD",
    "enabled": true
  }
]
```

Set `DEFAULT_PROXY_INVENTORY_IDS=proxy-one` plus the credential environment variables. Inventory allocation retains the existing health checks and exclusive exit-IP reservations. Managed flows continue to use their explicit proxy policy. Profiles created in the manual dashboard use their entered connection directly; they do not allocate an inventory lease.

## Profile settings and archive format

Local settings accept `name`, `storage: 'local'`, `locale`, IANA `timezone`, `viewport`, and the workbench's existing proxy choice object. Locale configures Chromium's language argument, formatting locale and request language; timezone and viewport use standard browser emulation. Existing tabs are configured before the profile start completes. New cross-site frame targets pause while locale and timezone are applied, before their initial scripts resume. New popup initialization and service workers still need broader qualification. These settings do not establish a coherent spoofed device fingerprint.

Unsupported Kameleo fields are rejected instead of silently pretending to apply them. Existing hooks returning only supported fields continue to work.

`.workbench.tgz` is a gzip-compressed tar archive containing `archive.json` and the Chromium `browser/` directory. Browser caches, singleton locks, runtime sessions, and vault files are omitted. Compression uses level 3 to reduce CPU work during saves. The existing runtime publishes exports only after confirmed browser shutdown, a nonempty-file check, and SHA-256 verification.

Windows exports retry the complete archive for up to five brief file-lock failures after confirmed main-process exit. Persistent locks fail the export and retain the profile; partially written archive bytes are discarded.

Archives restore persistent browser data on the same operating system. Encrypted Chromium cookies may depend on the original PC and Windows user. This PC's roundtrip cookie and local-storage restore passed; migration to another PC or OS has not been qualified. The format is independent of `.kameleo` and cannot import those proprietary archives. An imported or duplicated profile has no proxy connection until you add one again.

Browser uploads stream to a private temporary file, with a 512 MiB upload limit. Offline imports accept up to 2 GiB compressed and expanded profile data and 100,000 entries. Import validates all paths and rejects links, duplicate names and unknown entries before extraction into an isolated staging directory. The archive is snapshotted before validation so extraction reads the same bytes.

Offline commands, with the service stopped:

```powershell
node dist/cli.js profile-list
node dist/cli.js profile-import C:\backups\browser.workbench.tgz
node dist/cli.js profile-export PROFILE_UUID C:\backups\browser.workbench.tgz
```

Exports refuse to overwrite an existing destination file.

## HTTP controls

The existing administrator authentication and origin checks apply to these routes:

| Route | Behavior |
| --- | --- |
| `GET /api/local-profiles` | List profile metadata; no proxy credentials |
| `POST /api/local-profiles` | Create a profile from local settings |
| `PATCH /api/local-profiles/:id` | Edit a stopped profile; `proxy: null` removes the saved proxy |
| `POST /api/local-profiles/:id/start` | Open the native Chromium window |
| `POST /api/local-profiles/:id/stop` | Close and confirm browser shutdown |
| `POST /api/local-profiles/:id/duplicate` | Duplicate browser data under a fresh profile ID |
| `GET /api/local-profiles/:id/archive` | Download a stopped profile archive |
| `POST /api/local-profiles/import` | Stream an archive with `Content-Type: application/gzip` |

Profile routes are registered only for the local backend. The `/api/runs` interface remains compatible; its artifact route accepts the archive format produced by the selected backend.

## Capability comparison

| Capability | Local Chromium backend |
| --- | --- |
| Isolated persistent profiles and proxy settings | Implemented and browser-tested |
| Headed/headless Puppeteer scripts, managed flows, verified exports | Implemented and browser-tested |
| Dashboard profile management and snapshots | Implemented and browser-tested |
| Native canvas/WebGL/audio/font fingerprint manipulation | Not implemented |
| Kameleo's fingerprint database, patched Chroma/Junglefox kernels | Not reproduced |
| Mobile device kernels and proprietary `.kameleo` compatibility | Not implemented |
| Remote noVNC display | Existing Kameleo/Linux option; local backend uses the native browser window |
| Performance advantage over Kameleo | Not established; only local observations have been measured |

## Validation

```powershell
npm run check
npm run smoke:local
npm run smoke:local-flow
```

Real-browser smoke scripts use synthetic pages on this PC and local authenticated HTTP/SOCKS5 fixtures. `smoke:local` defaults to headless; set `LOCAL_SMOKE_HEADLESS=false` to repeat with visible windows. `smoke:local-flow` uses embedded PostgreSQL for the managed integration test, including cold sign-in, verification input, identity binding, warm reuse, and anonymous identity handoff. It does not test PostgreSQL's external-process advisory locks.

See the [validation record](validation.md) for dated results and limitations.
