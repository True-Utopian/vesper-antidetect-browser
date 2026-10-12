# Vesper Workbench HTTP API

By **true-utopian**. Vesper Browser has a separate profile-service API, described in its [package guide](../packages/vesper-browser/README.md). Workbench connects through the public `VesperBrowserClient`, so both applications see the same Browser-owned profiles. Both services retain these routes and expose `/api/v1`, `/api/v1/capabilities` and `/api/v1/openapi.json`. See the [desktop guide](desktop.md) for installers, discovery and the TypeScript/Python clients. Broader product capabilities remain tracked in the [completion plan](design/vesper-product-plan.md).

The API accepts structured inputs for an installed script or flow pack. An administrator installs those definitions on disk; clients choose one by ID. Every `/api/` route except login requires authentication.

Use `Authorization: Bearer <WORKBENCH_TOKEN>` from a trusted backend or CLI. Browser clients should POST `{ "token": "…" }` to `/api/login` and use the returned HttpOnly cookie. Do not put the token in a URL.

## Submit a run

```js
const response = await fetch('http://127.0.0.1:3180/api/runs', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.WORKBENCH_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    automationId: 'demo',
    inputs: { url: 'http://127.0.0.1:3180/demo', message: 'Hello' },
    preset: 'natural-fast',
  }),
});
if (!response.ok) throw new Error(`Submission failed: ${response.status}`);
const run = await response.json();
```

Inputs are checked against the installed definition's JSON Schema. Script mode keeps them in memory and sends them to the worker over local IPC. Managed mode uses its private input vault while the flow is admitted; PostgreSQL checkpoints and public run records contain no field values. Browser state can still retain submitted data. `preset` accepts a named preset or the bounded custom timing object described in the automation guide.

Use `Idempotency-Key` for recoverable run admission. Repeating the same key and request returns its recorded admission; changing that request conflicts, and an interrupted unknown admission is quarantined. Without a key, each accepted request creates a new run. Admission deduplication does not make website effects exactly once.

## Routes

| Method and path | Result |
| --- | --- |
| `GET /healthz` | Process liveness; public, no Engine/account details |
| `POST /api/login` | `{token}` → owner session cookie |
| `POST /api/logout` | Revoke that session |
| `GET /api/session` | Authenticated session check |
| `GET /api/status` | Engine readiness and run counts |
| `GET /api/automations` | IDs, titles, descriptions and input schemas |
| `POST /api/runs` | `{automationId, inputs, preset?}` → run, HTTP 202 |
| `GET /api/runs` | Runs in reverse creation order |
| `GET /api/runs/:id` | One run record |
| `GET /api/runs/:id/evidence` | Managed recognition evidence and coordinator events; empty for script mode |
| `POST /api/runs/:id/pause` | Request pause at the next checkpoint |
| `POST /api/runs/:id/resume` | Continue a paused run; managed mode can reconcile an eligible retained flow |
| `POST /api/runs/:id/cancel` | Terminate script, stop browser, retain profile |
| `POST /api/runs/:id/finish` | Finish a script that called `waitForFinish()` |
| `POST /api/runs/:id/input` | `{challengeId, values}` → answer current challenge |
| `POST /api/runs/:id/retry-export` | Retry an eligible retained export after unresolved operations are cleared |
| `GET /api/runs/:id/artifact` | Download a verified `.workbench.tgz` local archive, or `.kameleo` when using that adapter |
| `GET /api/runs/:id/screenshot` | Current page JPEG, while active |
| `GET /api/runs/:id/view` | Live-view availability and connection settings |
| `WS /api/runs/:id/view/socket` | Authenticated private VNC relay |
| `GET /api/proxies` | Inventory metadata, without credentials |
| `POST /api/proxies/:id/check` | Bounded health check of an unleased inventory item |
| `GET /api/events` | SSE `run` events containing changed run records |

Errors use `{ "error": "…" }`. Request bodies are limited to 256 KiB. Login attempts are limited per remote address. General upstream errors are intentionally sanitized.

Local profile creation, editing, start/stop, duplication and archive transfers use `/api/local-profiles`; see the [local profile route reference](local-browser.md#http-controls). The archive upload endpoint streams gzip with a separate 512 MiB limit. Browser's independent service has its own access token and `/api/profiles` routes. Desktop managed mode uses persistent embedded PGlite; external PostgreSQL remains optional. Both native desktop installers include their service runtime.

## Schedules and visual flow library

All routes below also have `/api/v1` aliases and require authentication. Desktop Workbench enables the combined script/managed runtime by default.

| Method and path | Contract |
| --- | --- |
| `GET /api/schedules` | Persistent schedules and occurrence history; input values are omitted |
| `POST /api/schedules` | `{name, automationId, inputs, nextAt, intervalMs?}` for one-time/interval runs, or `{name, automationId, inputs, cron, timezone?, nextAt?}` for calendar rules |
| `POST /api/schedules/preview` | `{cron, timezone?, after?}` returns five UTC-millisecond occurrences; timezone defaults to UTC and `after` defaults to the current instant |
| `POST /api/schedules/:id/pause` | Disable future occurrences |
| `POST /api/schedules/:id/resume` | Enable a waiting schedule; completed/quarantined schedules require a replacement |
| `POST /api/schedules/:id/remove` | Remove schedule and vaulted inputs |
| `GET /api/flow-library` | `{installed, drafts, defaults}` with validated definitions and authoring defaults |
| `POST /api/flow-library` | `{pack, manifest, revision, layout?}` validates and saves a draft; revision zero creates it |
| `POST /api/flow-library/:id/publish` | `{revision}` publishes that exact draft into the local runtime |

Draft writes use optimistic revisions: stale writes return HTTP 409. Layout maps step IDs to bounded `{x,y}` positions; omitted layout preserves the saved layout. Flow IDs use 2–64 lowercase letters, numbers and hyphens. Published packs are hashed snapshots: an existing run retains its admitted definition when a later draft is published. Authoring origins and engine policies must satisfy the local runtime's allowlist.

Schedules vault inputs with AES-256-GCM and admit one due occurrence while the runtime is idle and cleanup is resolved. Missed repeating intervals or calendar dates coalesce into one occurrence. A crash during admission quarantines the schedule for inspection rather than replaying an uncertain action. Calendar rules use five minute-resolution cron fields and an explicit IANA timezone, preserving wall time across daylight-saving changes. The API previews the next five occurrences; an optional `nextAt` is a not-before boundary. Interval and cron fields are mutually exclusive. Hashed cron fields are rejected. Scheduling requires a running service; it does not wake the PC or infer a safe retry after unknown effects. Both SDKs expose calendar creation and preview.

## Browser manager additions

Browser's authenticated OpenAPI endpoint describes the complete current profile contract. The manager adds folders, tags, notes, status, start pages, engine selection and environment policies to profile settings. Trash hides stopped profiles without deleting their data; restore reverses it. `GET /api/profiles?trash=1` lists trashed records.

| Route family | Purpose |
| --- | --- |
| `/api/profiles/bulk` | Bounded start, stop, duplicate, trash and restore actions, with optional `Idempotency-Key` and per-item results |
| `/api/templates` | Independent revisioned settings snapshots; proxy credentials are not copied |
| `/api/profiles/:id/cookies` | Strict JSON cookie import/export for unleased profiles |
| `/api/profiles/:id/environment` | Observed native page environment; available while running and unleased |
| `/api/engine/versions`, `/api/engine/stage`, `/api/engine/activate` | Pinned native engine downloads, digest verification and stopped-profile backup before activation |

Use the published OpenAPI schemas for verb/body details. TypeScript clients provide schedule, flow-library, template, cookie, environment and engine methods. Python clients provide the versioned generic request method plus profile/run/schedule/flow helpers. See [desktop setup and update limitations](desktop.md).

Managed mode lists JSON packs through the same `/api/automations` route. Its run records may also expose `flowState`, `stepId`, `identityId` and `waitReason`. These describe observed page state, interpreter position and coordination separately from the run lifecycle. The managed coordinator's durable events are separate from the SSE notification channel.

## Run states

Normal completion is `queued → starting → running → saving → saved`. Scripts can enter `awaiting_input` or `paused`. Other outcomes are `cancelled`, `failed`, `interrupted`, and `export_failed`. Inspect `error`, `logs`, `timings`, `profileId` and `artifact` for context. No `saved` state is emitted until the nonempty archive is read, hashed and renamed into place.

Follow-up input is represented by `challenge: {id, title, fields}`. `fields` is JSON Schema. Submit its answer using the current challenge ID. The ID prevents a delayed reply being applied to a later prompt. The schema may mark a field `writeOnly: true` to show a password control.

`pauseRequested: true` means the script has been asked to stop at a checkpoint. Only `state: "paused"` acknowledges it. `waitingForFinish: true` exposes the operator completion action. The run timeout continues during both kinds of wait. A terminal record with `cleanupRequired: true` retains capacity until shutdown can be confirmed. Retry export can recover a known profile once outstanding Engine calls settle; it does not rerun the automation. An unknown profile ID requires inspecting the Engine and restarting for reconciliation.

## Events and app integration

The browser uses `EventSource('/api/events')` with its cookie. Listen for named `run` events. Events are notifications, not a durable event log: after reconnecting, fetch `/api/runs` to reconcile current state.

An external app can submit inputs, poll its run ID, render a challenge and download the resulting archive. Custom game rendering is outside this repository. For live viewing, use the provided workbench on the same trusted origin or a server-side session broker. Profile archives, screenshots and display credentials require administrator authorization.

## Calendar schedules

`POST /api/v1/schedules/preview` validates a five-field cron rule and IANA timezone and returns the next five UTC timestamps. `POST /api/v1/schedules` accepts either a one-time/fixed-interval `nextAt` or a `cron` and `timezone`. See [calendar scheduling](calendar-schedules.md) for examples, daylight-saving behavior and recovery limits. Both clients expose calendar preview and schedule creation.
