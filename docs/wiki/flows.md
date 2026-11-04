# Author and publish flows

Browser 0.4.14 / Workbench 0.5.19. By **true-utopian**.

Keep drafts editable and admitted runs immutable.

## Draft library

GET /api/v1/flow-library returns installed packs, drafts and authoring defaults. POST /flow-library validates a pack, manifest, revision and optional layout. Revision zero creates a draft. Existing writes use the current optimistic revision; a stale update returns HTTP 409. Flow IDs contain 2–64 lowercase letters, digits or hyphens. Use the desktop Flow editor for supported visual controls and review advanced JSON before publication. Saving changed execution content automatically advances the flow patch version above its retained version floor. Unchanged and layout-only saves keep the existing version. The returned pack, hash and revision describe the exact saved definition; use them together. This prevents an edited published flow from colliding with an older admitted version. Flow settings shows the saved version.

## Branch by recognized page

In Flow editor, choose Branch by page. Required states lists the recognized actionable pages this step accepts. Add page route adds a form-controlled destination for another recognized page; remove a route to stop accepting it. The interpreter observes fresh page evidence and chooses that page’s destination without performing a browser action. Unknown or ambiguous pages go through the configured review policy. This is page-state branching, not JavaScript expressions.

## Repeat a bounded body

Choose Repeat steps, set Times to repeat and choose First step in body. Edit body opens its action controls. The body’s last successful route must return to the repeat controller. After repeating sets the destination for each recognized page after the count is exhausted. Counts range from 1 to 99 and also require a step visit limit of at least count + 1, including the final exit. Nested loops count all visits against the same global step, visit and time budgets. Flow settings exposes those limits; Arrange flow places the entry routes before their destinations. Dragging changes layout only. Undo and Redo restore edits before saving.

## Resume without repeating uncertain effects

The journal records each admitted loop iteration and its next step before browser input. After trusted ownership recovery, a controlled flow resumes that saved continuation when fresh page evidence still accepts it. Completed inner-loop counters reset for the next outer iteration. Confirmed successful actions can run again in the next counted iteration; an unresolved or uncertain mutation keeps its existing action fence and cannot silently become a new iteration. A counted iteration is not a guarantee of exactly-once external effects; inspect uncertain outcomes before resuming.

## Publish the intended revision

POST /flow-library/{id}/publish with revision publishes that exact draft. New runs can select the published automation. A run retains its admitted hashed definition even when a later draft is saved or published. Origins and native engine policies still need to satisfy the runtime’s allowlist.

## Recognize uncertain actions

Branches and counted repeats have visual controls. Recognition rules, extraction details and some advanced routes still use their dedicated settings or advanced JSON. An uncertain action is not a successful transition. Inspect evidence and retained profiles before deciding to resume; never force a replay that might repeat a website side effect.

[Wiki contents](README.md) · [Report a correction](https://github.com/True-Utopian/vesper-workbench/issues)
