# Author and publish flows

Browser 0.4.12 / Workbench 0.5.17. By **true-utopian**.

Keep drafts editable and admitted runs immutable.

## Draft library

GET /api/v1/flow-library returns installed packs, drafts and authoring defaults. POST /flow-library validates a pack, manifest, revision and optional layout. Revision zero creates a draft. Existing writes use the current optimistic revision; a stale update returns HTTP 409. Flow IDs contain 2–64 lowercase letters, digits or hyphens. Use the desktop Flow editor for supported visual controls and review advanced JSON before publication.

## Publish the intended revision

POST /flow-library/{id}/publish with revision publishes that exact draft. New runs can select the published automation. A run retains its admitted hashed definition even when a later draft is saved or published. Origins and native engine policies still need to satisfy the runtime’s allowlist.

## Recognize uncertain actions

Recognition, branch, loop and extraction authoring has explicit limits in the current editor. An uncertain action is not a successful transition. Inspect evidence and retained profiles before deciding to resume; do not force a replay that might repeat a website side effect.

[Wiki contents](README.md) · [Report a correction](https://github.com/True-Utopian/vesper-workbench/issues)
