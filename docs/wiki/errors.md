# Errors and safe recovery

Browser 0.4.13 / Workbench 0.5.18. By **true-utopian**.

Handle conflicts, authentication failures and uncertain operations.

## Read structured errors

Workbench errors return an error message. Browser also returns a code such as unauthorized, conflict or revision_conflict. HTTP 400 indicates invalid input, 401 a missing/invalid token, 403 a disallowed origin or access, 404 a missing resource, 409 a state/lease/admission conflict and 412 a stale Browser revision. HTTP 413 is an upload/body limit and 415 an unsupported content type. Upstream failures may be sanitized.

## Retry with evidence

Re-read the affected resource after a network timeout. Use the same idempotency key only for the identical supported admission request. Do not automatically repeat a non-idempotent website effect. Keep retained profiles, leases, artifacts and failure evidence until recovery is confirmed. Large load, forced-exit and full rollback matrices remain unfinished.

## Protect the local store

Quit through the application before replacing installed files. Upgrade safeguards require idle services and a verified private backup. Never remove a live lease or copy a running database as an assumed valid backup. Documentation does not change profiles, credentials, runs or schedules. Keep private stores, signing keys and vendor binaries out of public repositories.

[Wiki contents](README.md) · [Report a correction](https://github.com/True-Utopian/vesper-workbench/issues)
