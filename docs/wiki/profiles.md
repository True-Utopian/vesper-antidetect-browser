# Profiles, revisions and ownership

Browser 0.4.13 / Workbench 0.5.18. By **true-utopian**.

Edit stopped profiles without racing a running automation.

## Profile lifecycle

Create through POST /api/v1/profiles with settings such as name, engine and locale. Use GET /profiles to reconcile the list, then POST /profiles/{id}/start and /stop. Settings edits require a stopped profile. Duplicate creates independent state. Trash is reversible and does not delete profile bytes. Browser and Workbench share this Browser-owned store through the authenticated service.

## Revision checks

GET /profiles/{id} returns an ETag containing its current revision. Send that exact value as If-Match when PATCHing to avoid overwriting a newer edit. A stale edit returns HTTP 412. Re-read, inspect the change and decide whether to submit a revised update. Avoid blindly retrying edits.

## Durable run leases

POST /profiles/{id}/lease with a runId acquires an automation lease. Creation can use X-Vesper-Run-Id to acquire ownership immediately. Protected operations require X-Vesper-Lease with the returned key. Leases do not silently expire. Stop the owned profile and DELETE /profiles/{id}/lease with the matching key when finished. Explicit administrator interruption stops the browser before revoking ownership; use it only after inspecting an abandoned run.

## Recoverable admission

Use a unique Idempotency-Key for profile creation or supported bulk admissions. Repeating the identical completed request with the same key replays its result. Reusing a key for different input conflicts. An uncertain interrupted operation must be reconciled rather than replayed blindly. Event journal gaps return resetRequired: perform a fresh authenticated list before processing later events.

[Wiki contents](README.md) · [Report a correction](https://github.com/True-Utopian/vesper-workbench/issues)
