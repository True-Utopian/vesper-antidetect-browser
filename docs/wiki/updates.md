# Updates, backups and recovery

Browser 0.4.12 / Workbench 0.5.17. By **true-utopian**.

Understand what an update verifies and what recovery still requires.

## Signed local updates

App update, or Vesper → Install local update, opens a local .vesper-update.json manifest beside its installer. The shell checks the pinned Ed25519 key, product, platform, architecture, newer version, size and SHA-256. This local signature is separate from Windows Authenticode. There is no hosted automatic update feed or automatic rollback service in this release.

## Preserve the original store

Finish active runs, resolve cleanup and stop profiles before replacing application files or selecting a changed engine. Use the guarded upgrade’s idle preflight and independently verified private backup. Keep original profiles, proxy vaults, tokens, signing trust and run history together. Copying a running database is not a verified backup. Never publish a backup, archive or its credentials.

## Changed native kernels

An engine change needs native unit tests, direct and copied-runtime qualification, stopped and unleased profiles, plus a fresh verified backup before activation. Existing acceptance belongs to the exact executable and component hashes that were tested. A previous passing record does not qualify a changed binary. Standard users select a compiled runtime; building the kernel from source requires a separate large developer toolchain.

## Recovery limits

Profile archives support compatible transport, but encrypted cookies are not guaranteed to work on another PC or after arbitrary browser downgrades. A complete application rollback and forced-exit recovery matrix remain unfinished. Retain the original store after an uncertain export or upgrade. Inspect the relevant run, lease and evidence before choosing a retry or explicit administrator interruption.

[Wiki contents](README.md) · [Report a correction](https://github.com/True-Utopian/vesper-workbench/issues)
