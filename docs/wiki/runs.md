# Runs and saved results

Browser 0.4.10 / Workbench 0.5.15. By **true-utopian**.

Admit work, inspect state and finish without losing the profile.

## Choose an installed automation

GET /api/v1/automations returns IDs and input schemas. POST /runs with automationId, inputs and optional preset admits one run (HTTP 202). Definitions are installed by the operator; the API does not accept arbitrary script source. Use an Idempotency-Key for recoverable admission and keep input values out of logs. Website effects are not guaranteed exactly once.

## Observe before controlling

GET /runs/{id} reports state, timestamps, cleanup and artifact metadata. Common transitions are queued → starting → running → saving → saved. Runs may pause or await input; cancellation/failure can retain a profile requiring inspection. POST /pause requests a checkpoint pause. Resume continues an eligible paused run; finish completes a script waiting for an explicit operator action. A queued control request is not proof that the browser has stopped.

## Input and evidence

Use the current challengeId and values for /runs/{id}/input. Screenshots and evidence are authenticated and can contain private website content. The events endpoint is SSE notification; durable managed coordinator evidence is a separate stream. Reconcile GET /runs after reconnecting rather than assuming no events were missed.

## Keep the saved archive

When saved, download /runs/{id}/artifact and verify its recorded digest and size. If export failed, retain the original profile, inspect unresolved operations and use retry-export only when eligible. A normal application Quit drains owned work; avoid terminating a live process to force an upgrade.

[Wiki contents](README.md) · [Report a correction](https://github.com/True-Utopian/vesper-workbench/issues)
