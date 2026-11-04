# Durable run-update replay

By **true-utopian**. Browser **0.4.13** and Workbench **0.5.18** passed local packaged and installed qualification on **4 November 2026**. Public source acceptance requires matching Windows/Linux CI. The release advances only the durable replay check; the broader product roadmap remains unfinished.

Workbench exposes authenticated server-sent events at `GET /api/v1/events` and the compatible `/api/events` alias. Each `run` frame contains a complete changed run record and an `id` shaped as `journal-uuid:sequence`. The ID is sent only after an atomic journal replacement and filesystem synchronization. A reconnect supplies that ID in `Last-Event-ID`; retained frames after it are replayed in order, followed by live commits. Clients may deduplicate by ID.

This is notification replay. It never submits, resumes, repeats or rolls back a browser action. The canonical run/coordinator journals remain authoritative. Their writes and notification commits are separate transactions: a notification is not proof that a remote action completed or that the run journal committed. Startup reconciles current canonical run snapshots into the notification history, including recovery states.

## Refresh and failure contract

- A new stream, an expired cursor, another journal's cursor or a cursor ahead of history receives an `event: reset` frame. Its ID is the current watermark; its data identifies `GET /api/v1/runs` as the full refresh route. Fetch canonical state and continue consuming updates. Workbench buffers newer received records while that refresh is pending, so the older response cannot overwrite them.
- Malformed cursors return HTTP 400. Missing authentication returns 401; unrelated origins return 403. Cookie logout immediately closes that session's streams. After a service restart, sign in again because cookie sessions are intentionally held in memory. Bearer clients can reconnect using the same journal cursor.
- Retention is bounded by 512 snapshots and an 8 MiB serialized journal. A single run notification is limited to 1 MiB; queued notifications are bounded at 8 MiB. An excessively slow stream is closed when its output buffer would exceed 2 MiB; reconnect with the last consumed ID, or handle `reset` if its history expired.
- The UI buffers at most 512 changed runs or 4 MiB during refresh. Overflow requests another full refresh. Responses started before logout cannot populate a newly signed-in workspace.
- If history persistence fails or capacity is exceeded, existing streams close and new streams return 503 until service restart. Run-state reads remain available. No failed write advertises a committed ID. Corrupt history refuses startup and is preserved for inspection rather than silently replacing its epoch.

The private `run-events.json` file lives inside Workbench's data directory with the same run snapshots available to authenticated API clients. It is created with owner-only file permissions where the operating system supports them. Include it in private backup handling; do not publish it. It is bounded notification history, not an audit archive or an action-recovery log.

## Client example

Use a numeric loopback origin and the locally generated access token. The following request resumes from an ID previously consumed by the client:

```http
GET /api/v1/events HTTP/1.1
Authorization: Bearer <local-access-token>
Last-Event-ID: <journal-uuid>:<sequence>
```

```text
id: <journal-uuid>:<next-sequence>
event: run
data: {"id":"<run-id>","state":"saved", "...":"remaining run fields"}

```

The normal browser `EventSource` handles `Last-Event-ID` automatically on reconnect while the same object remains active. On `reset`, refresh from the run-list route. Do not store bearer credentials in query parameters.

## Qualification boundary

The source tests cover ordered disconnected replay, ordinary restart, committed history after abrupt termination of an owned test service, retained cursor continuity, bounded retention, malformed/foreign/future cursors, corrupted history preservation, failed writes, authentication/origin restrictions, logout and normal stream shutdown. Real Workbench-page checks use synthetic owned records and the existing local Chromium executable; they cover reconnection feedback, cursor use, refresh races, failure recovery, sign-out races and desktop/narrow layouts.

From Workbench source, the repeatable `scripts/qualify-run-event-replay.mjs` matrix passed **16 checks per operating system** in source, packaged Browser/add-on and packaged standalone fixtures. Each matrix exercised **11 real script/managed runs and six digest-verified archives**, including input, paused checkpoints/resume, cancellation, filesystem export failure/retry, ordinary restart and abrupt termination of only the owned test service. Recovery exported the retained profile without repeating its test-page side effect. Replayed IDs matched committed history in order. A deliberately dropped committed Browser profile-creation reply recovered through one retry of the identical keyed request, producing one profile per run.

## Qualified local release

| Check | Windows | Linux |
| --- | --- | --- |
| Actual installed Browser and signed Workbench add-on: desktop, documentation and normal restart | 20 passed | 20 passed |
| Standalone Workbench | 18 packaged checks; signed full NSIS artifact verified | Actual portable installer executed; 19 installed-executable checks in an owned store |
| Installed API, including notification disconnection/replay | 13 passed | 13 passed |
| Proxy / native identity / Python | 7 / 6 / passed | 7 / 6 / passed |
| Exact copied SDK archive restore | 8 passed | 8 passed |
| Packaged real replay matrix | 16 per product | 16 per product |
| Production graphs and locks | Exact audited Browser/add-on graphs; zero recorded vulnerabilities | Exact audited Browser/add-on/standalone graphs; zero recorded vulnerabilities |

The installed check disconnects the authenticated stream while Finish saves an owned run, verifies the resulting archive, then reconnects from the previous cursor. Every missed frame matches the committed journal rows, exactly once and in order. One admitted run produces one owned page POST. Normal desktop restart preserves profiles, run records and add-on availability. Fresh independently verified private backups and full original-file checks protect the existing stores; Linux native activation also creates its own verified profile backup.

Windows file and directory publication now retries bounded transient sharing rejections without deleting the original destination as a fallback. Real OS-lock regressions cover journal commits and profile archive import. Keyed admission transport recovery is limited to recognized interrupted transports, one unchanged request and the original deadline; manual creation and HTTP errors are not generally retried.

Linux packaging streams complete Debian members without duplicating the full application tree. A 120 MiB mixed-file/hard-link regression checks complete contents and link paths. Packaging success also requires real signed artifacts, checksum integrity and portable bindings to the signed Debian full manifest, installer and ASAR. Installed checks execute the real portable installers and verify the copied files. Low-space recovery retains verified artifacts and resumes the exact failed phase; it does not lower native, installer, backup or idle guards.

Source checks passed **272 tests with two skips on Windows**, **267 with seven explicit platform/optional skips on Linux**, and **99 in the independent Browser checkout**, with zero failures. Backup regressions include a 150,000-entry nested inventory and real linked-directory rejection. Unchanged kernels retain 26 recorded unit executions; copied package runtimes passed nine cases each, and the new Linux installed native path passed nine cases before guarded activation. A further installed startup/native-profile/normal-quit check passed after the inactive previous Browser slot was independently retained.

This establishes notification replay and the bounded admission/publication fixes. It does not establish the complete crash-recovery matrix, rollback cycle, detection avoidance or proprietary vendor parity. Windows standalone NSIS installation and Authenticode publisher signing remain unqualified. Linux runtime checks use an isolated non-root portable install, Xvfb and explicit software rendering; privileged Debian installation and physical GPU behavior remain unqualified. Broad personas, WebGL/WebGPU, realtime audio, coherent font packs, media/screen coverage and other pending checks remain in the [inventory](status.md). Applications, runtime binaries, private stores, credentials, signing/SSH keys and raw receipts are not published.
