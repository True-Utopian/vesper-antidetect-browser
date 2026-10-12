# Deployment

## Native Windows

Install Node.js 24+ and Kameleo Desktop, start its Engine, then run `npm ci`, `npm run build`, and `npm start`. The default Engine address is `http://127.0.0.1:5050`. The default workbench address is `http://127.0.0.1:3180`.

Set environment variables in `.env` or PowerShell. `npm start`, `npm run token --silent` and `npm run doctor` load `.env`; direct `node` commands only load it if passed `--env-file-if-exists=.env`. With the default generated access token, `node dist/cli.js token` also prints the saved token from `.workbench/admin-token`.

Native Kameleo shows its own browser windows. The workbench screenshot button works without VNC. A live embedded display requires a separately configured VNC WebSocket endpoint; the included Docker deployment provides it. Docker Desktop in Linux-container mode is also supported by the Compose configuration.

## Linux / Docker

The official Kameleo Linux image is amd64. The supplied Compose file runs the Engine with 2 GiB of shared memory. Keep the `kameleo-data` volume: it stores profiles and downloaded kernels. The initial download takes longer than a cached start.

Set these values in an untracked `.env`:

```dotenv
KAMELEO_PAT=your-personal-access-token
VNC_PASSWORD=your-random-display-password
POSTGRES_PASSWORD=your-url-safe-database-password
KAMELEO_TEAM_KEY=your-stable-provider-team-key
ENABLE_TEST_FIXTURE=true
```

Generate a long random access token in `WORKBENCH_TOKEN`, or leave it blank and use the generated one. The VNC password travels only between the authenticated owner and private display; classic VNC authentication uses at most eight characters. The workbench's long access token is the external access control.

Run `docker compose up -d --build`. Compose starts PostgreSQL and managed mode. Keep `POSTGRES_PASSWORD` URL-safe because it is embedded in `DATABASE_URL`. The Engine and database have no host port mappings. The workbench is available on `127.0.0.1:3180`. On a remote host, use an SSH tunnel or an authenticated HTTPS reverse proxy.

The pinned image runs as UID 1001. Both containers share an export volume owned by that UID. If you change the image, inspect its runtime UID and update the workbench user/volume initialization together.

## Managed mode

Set `DATABASE_URL` to enable the PostgreSQL coordinator and JSON flow interpreter. Without it, the service loads trusted scripts from `AUTOMATIONS_DIR`. The two modes share the HTTP workbench but have different storage and recovery behavior.

Managed startup applies coordinator migrations, acquires an exclusive database lock for the node, loads and compiles packs from `FLOWS_DIR`, and reconciles retained leases before admitting new work. Use a stable `WORKBENCH_NODE_ID` for a worker across restarts; if omitted, a UUID is saved in the private data directory. Never mount the same node state volume into two active workers.

All workers sharing a Kameleo provider quota must use the same `KAMELEO_TEAM_KEY`, database and browser budget. Tenant identity and provider quota identity are separate configuration values. The dashboard still has one administrator token per deployment; tenant-scoped database records do not create dashboard user accounts.

The owned-site fixture requires `ENABLE_TEST_FIXTURE=true` and `FIXTURE_ORIGIN` set to the exact origin reachable from the browser. It installs test profile/proxy/receipt policies. For an application integration, install trusted policy code through `FLOW_POLICIES_FILE`, exporting profile, proxy and authenticated identity resolver functions. See [declarative flows](flows.md) for the contract.

Managed inputs are held in a private local vault for the admitted flow, separate from its PostgreSQL checkpoint. Back up and protect the vault key/state with the service account. Challenges, captured page values and identity receipts stay in memory. The flow journal records action intent and outcomes without field values.

## Export paths

Export is a filesystem operation **on the Engine host**, not a download response from Kameleo. `KAMELEO_EXPORT_DIR` names a directory that the Engine can write. `EXPORT_DIR` names the same files as seen by the workbench. The directories must be the same directory or a shared mount.

| Setup | Engine path | Workbench path |
| --- | --- | --- |
| Native on one Windows machine | `C:\work\profiles` | `C:\work\profiles` |
| Native on one Linux machine | `/srv/workbench/profiles` | `/srv/workbench/profiles` |
| Included Compose | `/exports` | `/exports` |
| Separate hosts | An explicitly shared mount | Its local mount point |

If that mapping is wrong, export is marked `export_failed`; the original profile remains. Correct the mapping and retry the export. Never remove the original until its archive is verified and backed up.

Download saved profiles through the workbench, or copy the container directory:

```sh
docker compose cp workbench:/exports ./profile-backup
```

Archives contain browser sessions, cookies and site data. Protect backups accordingly. A checksum establishes file integrity; an import test establishes whether the archive restores in your Engine version.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST`, `PORT` | `127.0.0.1`, `3180` | HTTP listener |
| `WORKBENCH_TOKEN` | Generated and persisted | Owner access / API bearer token |
| `WORKBENCH_DATA_DIR` | `.workbench` | Private token and run records |
| `KAMELEO_URL` | `http://127.0.0.1:5050` | Private Local API |
| `EXPORT_DIR` | `profiles` | Locally readable export directory |
| `KAMELEO_EXPORT_DIR` | Same as `EXPORT_DIR` | Engine-side export directory |
| `AUTOMATIONS_DIR` | `automations` | Trusted local JS modules |
| `PROXY_INVENTORY_FILE` | `proxy-inventory.json` | Private imported proxy inventory |
| `MAX_CONCURRENCY` | `1` | Concurrent browser runs |
| `RUN_TIMEOUT_MS` | `600000` | Maximum running time, including manual waits |
| `KAMELEO_VNC_URL` | Unset | Private `ws://…/websockify` endpoint |
| `VNC_PASSWORD` | Unset | Credentials for that display |
| `PUBLIC_ORIGIN` | Derived from request | Exact workbench origin, e.g. `https://browser.example.com` |
| `COOKIE_SECURE` | True for HTTPS origin | Restrict cookie to HTTPS |
| `EMBED_ORIGINS` | Empty | Comma-separated allowed iframe parent origins |
| `WORKBENCH_URL` | `http://127.0.0.1:3180` | Destination of CLI `run` submissions |
| `DATABASE_URL` | Unset | Enable managed mode and connect to PostgreSQL |
| `FLOWS_DIR` | `flows` | JSON packs and matching trusted manifests |
| `FLOW_POLICIES_FILE` | Unset | Trusted ES module supplying managed execution policies |
| `WORKBENCH_TENANT_ID` | Stable default tenant | Tenant scope for this administrator deployment |
| `WORKBENCH_NODE_ID` | Generated and persisted | Stable worker identity |
| `KAMELEO_TEAM_KEY` | Required in managed mode | Shared provider quota identity |
| `KAMELEO_BROWSER_BUDGET` | `1` | Managed browser admission budget for the shared quota |
| `IDLE_TIMEOUT_MS` | `180000` | Managed idle/manual-wait timeout |
| `ENABLE_TEST_FIXTURE` | `false` | Enable the synthetic sign-in fixture and its policies |
| `FIXTURE_ORIGIN` | Unset | Exact browser-reachable origin of that fixture |

Proxy provider environment variables are in [the proxy guide](proxies.md). To supply a private inventory in Compose, add a read-only mount at `/app/proxy-inventory.json`. Add provider secrets through a private Compose override or secret manager; never put them into a committed automation.

## Live display and concurrency

The Linux container has one shared desktop. Live viewing therefore requires `MAX_CONCURRENCY=1`. A queued run gets the display after the previous run has stopped. Viewer connections are closed when their run ends. Do not start unrelated profiles manually in that same Engine: they would share its desktop.

The gateway opens noVNC only while the run is paused, awaiting input or waiting for operator completion. Resume closes that control connection. Use snapshots while automation runs; a client-side read-only flag alone would not prevent a modified VNC client from sending competing input.

For parallel viewing, run separate worker/Engine pairs with separate displays, data volumes and ports. Managed workers share the PostgreSQL coordinator and quota key. The managed runtime claims each verified proxy exit in the coordinator before profile creation and releases it after confirmed stop. Script-mode ProxyManager reservations remain process-local. Database coordination does not isolate windows on a shared VNC desktop.

Pause is cooperative. Action helpers check the pause flag before acting. When using raw Puppeteer, insert `await checkpoint()` at safe boundaries. Wait for the run to say **paused** before manual input. A pending pause is not proof that the browser has stopped executing commands.

## HTTPS and embedding

For public access, put a reverse proxy with TLS in front of the loopback listener, set `PUBLIC_ORIGIN` to the exact external origin, and forward WebSocket upgrades and SSE without buffering. Do not publish Kameleo's Local API or VNC ports. The owner token has full authority over all runs; this is not a multi-tenant service.

Browser sessions use an HttpOnly, SameSite=Strict cookie and expire after 12 hours. API calls can use a bearer token. Cross-origin browser requests are rejected. `EMBED_ORIGINS` permits iframe framing only; it does not add CORS or relax cookies. A cross-site game/web app should call this API from its own trusted backend. Never ship the owner token inside a game client or public webpage.

## Shutdown and recovery

SIGINT/SIGTERM stops active workers and their profiles. In script mode, an abrupt restart marks nonterminal run records `interrupted`; submitted inputs are not persisted or replayed. Inspect the original profile before retrying an export.

Managed mode persists lease, lifecycle-operation and flow records. Restart reconciliation stops or quarantines uncertain browsers and retains their reservations until there is stop evidence. A flow checkpoint alone does not authorize reattachment or replay. Resume can continue an eligible retained flow while its deadline and private input vault remain valid; the coordinator must establish ownership before the interpreter reclassifies the page. Unresolved effects still require receipt reconciliation. Retry export handles eligible retained profiles only after lifecycle and flow operations are resolved.

Submitted managed inputs are encrypted in the node's private state volume. Inactive input envelopes are removed when their flow deadline expires; saved and cancelled runs remove them sooner. Follow-up codes stay in memory. Stored proxy credentials belong to the profile and are kept separately for health checks on warm reuse. Keep the vault key with the state backup and restrict access to both.

Restart after changing automation modules. Back up the state and profile volumes together. Rotate the workbench token by changing `WORKBENCH_TOKEN` and restarting; existing sessions then become invalid. Kameleo PAT changes require restarting the Engine.

The upstream [Docker guide](https://developer.kameleo.io/integrations/docker/) and [configuration reference](https://developer.kameleo.io/reference/configuration-options/) describe Engine-specific settings. Dependency and image pins should be upgraded deliberately, then checked with a complete create → run → stop → export → import cycle.
