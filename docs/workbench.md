# Browser workbench

The workbench is a plain HTML, CSS and browser ES-module client in `public/`. The server serves it directly; there is no frontend build step, external font, analytics dependency or browser-side token storage.

## Layout and use

Sign in with the workbench access token. The server establishes an HTTP-only session cookie. The Kameleo PAT belongs in server configuration, not this sign-in form.

The left pane lists runs and verified archives. Search matches titles and run identifiers. Status filters narrow the list to active runs, input requests, saved runs or failures. Selecting a run shows its browser view, activity, state and export metadata. The System panel reports Engine availability and lets the operator check configured proxy inventory. Managed deployments list installed JSON flow packs through the same interface used for scripts.

New run selects an installed automation and an interaction pace (`fast`, `natural`, or `natural-fast`). Its JSON Schema generates fields for strings, secrets, numbers, booleans, enums and nested JSON. The JSON editor also accepts object inputs that are not representable by those fields. The server remains authoritative for schema validation. Credentials are kept in form memory and cleared when the dialog closes; they are never saved to browser storage. Starting another run with the same script does not copy prior inputs.

Runs update through authenticated server-sent events, with a periodic refresh as a fallback. Pause is cooperative: the interface shows Pause requested until the script reaches a checkpoint. A script waiting for operator completion exposes Finish & save. A saved run exposes its verified `.kameleo` download and SHA-256 checksum. Failed exports expose Retry export. Cancelling a run requires confirmation because it stops active work.

If browser shutdown cannot be confirmed, the runtime quarantines the unresolved browser capacity and holds new sessions until cleanup succeeds. The finished run shows a cleanup warning, including when it failed or was cancelled. Retry export attempts shutdown again and recovers the retained profile without rerunning the automation. Interrupted runs with a known profile also expose recovery. If no profile identifier is available yet, the interface explains that the pending browser operation must settle or the engine needs inspection. The ordinary `cleanupRequired` flag on an active run is not presented as a failure; it also tracks browsers that are still running normally.

## Browser view

Snapshots are labelled still images and refresh approximately every five seconds while a selected browser is active and the tab is visible. No image or successful run is fabricated when the engine is unavailable. After a browser stops, an already-captured snapshot is labelled as the last captured image.

Connect live requests an authenticated view descriptor and imports noVNC from `/vendor/novnc/core/rfb.js`. Only a same-origin gateway WebSocket path is accepted. Any VNC password supplied by the authenticated endpoint is passed to noVNC in memory and is not stored. The client does not connect directly to a raw VNC or Kameleo endpoint.

The server permits noVNC connections only when the run is paused, awaiting input or waiting for operator completion. Pause an active flow before connecting. Resume closes the control connection; snapshots remain available while automation runs. The administrator still receives the whole worker display, so separate tenants require separate display boundaries.

Fullscreen expands the selected browser stage. Resizing the viewer scales the display locally and does not change the browser screen resolution. If live-view setup is missing or unavailable, the workbench reports the error and retains snapshot access.

## UI contract

- `POST /api/login`, `GET /api/session`, `POST /api/logout`: session lifecycle.
- `GET /api/status`, `GET /api/automations`: engine and script discovery.
- `GET /api/runs`, `GET /api/runs/:id`, `POST /api/runs`: run lifecycle and selection.
- `POST /api/runs/:id/pause`, `/resume`, `/cancel`, `/finish`, `/retry-export`: operator actions.
- `POST /api/runs/:id/input`: `{ challengeId, values }` for `challenge: { id, title, fields }`, where `fields` is JSON Schema.
- `GET /api/runs/:id/screenshot`, `/artifact`, `/view`: browser snapshots, verified exports and a live-view descriptor.
- `GET /api/events`: named `run` events carrying the latest run record.
- `GET /api/proxies`, `POST /api/proxies/:id/check`: sanitized inventory and connection checks.

The frontend inserts runtime-provided text using text nodes, not HTML. It does not render inputs or returned artifact filesystem paths. API errors are presented in context. Reduced motion, keyboard focus, semantic dialog focus management, responsive layouts and labelled form controls are included.

## Visual direction

The workbench uses a list-and-detail layout with a central browser view. Colors are slate (`#edf2f6`), blue (`#255f9c`), dark ink (`#203647`), teal success (`#237969`) and white surfaces. Orange marks warnings. Typography uses Segoe UI and system fallbacks.
