# Status inventory

Updated 2026-10-12.

Named acceptance checks for the current local Vesper roadmap. Counts are not a percentage of vendor features, total engineering effort or detection resistance.

Green in the README treemap means desktop verified. Grey means acceptance is pending; source-tested, in-progress and planned states remain separate below. Treemap squares are visual texture proportional to these named checks, not extra checks.

## Browser: Profiles

| Acceptance check | State | Evidence |
| --- | --- | --- |
| Create | verified | [Evidence](../docs/validation.md) |
| Edit stopped profiles | verified | [Evidence](../docs/validation.md) |
| Open and stop | verified | [Evidence](../docs/validation.md) |
| Persistent storage | verified | [Evidence](../docs/validation.md) |
| Independent duplicate | verified | [Evidence](../docs/validation.md) |
| Archive import/export | verified | [Evidence](../docs/validation.md) |
| Folders | verified | [Evidence](../docs/validation.md) |
| Tags and notes | verified | [Evidence](../docs/validation.md) |
| Favorites and search | verified | [Evidence](../docs/validation.md) |
| Trash and restore | verified | [Evidence](../docs/validation.md) |
| Revision conflicts | verified | [Evidence](../docs/validation.md) |
| Run ownership leases | verified | [Evidence](../docs/validation.md) |
| Detached service ownership | verified | [Evidence](../docs/validation.md) |

## Browser: Identity and rendering

| Acceptance check | State | Evidence |
| --- | --- | --- |
| Real Chromium | verified | [Evidence](../docs/validation.md) |
| Locale and timezone | verified | [Evidence](../docs/validation.md) |
| New-target policy | verified | [Evidence](../docs/validation.md) |
| Page CPU policy | verified | [Evidence](../docs/validation.md) |
| Native CPU getter | in progress | [Evidence](../native/chromium/README.md) |
| Native memory/client hint | in progress | [Evidence](../native/chromium/README.md) |
| Native RGBA8 canvas | in progress | [Evidence](../native/chromium/README.md) |
| Persisted native seed | source tested | [Evidence](../native/chromium/README.md) |
| Coherent browser personas | planned | [Evidence](../docs/research/completion-gates.md) |
| WebGL identity | planned | [Evidence](../docs/research/completion-gates.md) |
| WebGPU identity | planned | [Evidence](../docs/research/completion-gates.md) |
| Audio surfaces | planned | [Evidence](../docs/research/completion-gates.md) |
| Font exposure | planned | [Evidence](../docs/research/completion-gates.md) |
| Media devices | planned | [Evidence](../docs/research/completion-gates.md) |
| Headed screen consistency | planned | [Evidence](../docs/research/completion-gates.md) |
| Custom binary qualification | in progress | [Evidence](../native/chromium/README.md) |

## Browser: Connections

| Acceptance check | State | Evidence |
| --- | --- | --- |
| HTTP proxy | verified | [Evidence](../docs/validation.md) |
| SOCKS5 proxy | verified | [Evidence](../docs/validation.md) |
| Credential vault | verified | [Evidence](../docs/validation.md) |
| Proxy editing per profile | verified | [Evidence](../docs/validation.md) |
| Owned outage navigation | source tested | [Evidence](../docs/proxies.md) |
| Browser inventory editor | planned | [Evidence](../docs/research/completion-gates.md) |
| Rotation workflow | planned | [Evidence](../docs/research/completion-gates.md) |
| Whole-browser leak capture | planned | [Evidence](../docs/research/completion-gates.md) |

## Browser: Extensions

| Acceptance check | State | Evidence |
| --- | --- | --- |
| Bounded MV3 ZIP import | verified | [Evidence](../docs/validation.md) |
| Permissions and versions | source tested | [Evidence](../docs/extensions.md) |
| Per-profile assignment | verified | [Evidence](../docs/validation.md) |
| Immutable package checks | source tested | [Evidence](../docs/extensions.md) |
| Restart storage persistence | verified | [Evidence](../docs/validation.md) |
| Portable extension archive | verified | [Evidence](../docs/validation.md) |
| Catalog removal | verified | [Evidence](../docs/validation.md) |
| Version storage migration | planned | [Evidence](../docs/extensions.md) |
| Long Windows launch paths | verified | [Evidence](../docs/validation.md) |

## Browser: Desktop and engines

| Acceptance check | State | Evidence |
| --- | --- | --- |
| Windows installer | verified | [Evidence](../docs/validation.md) |
| Optional Brave engine | verified | [Evidence](../docs/validation.md) |
| Staged engine canary | verified | [Evidence](../docs/validation.md) |
| Custom kernel activation | in progress | [Evidence](../native/chromium/README.md) |
| Native Linux runtime | planned | [Evidence](../docs/research/completion-gates.md) |
| Firefox engine | planned | [Evidence](../docs/research/completion-gates.md) |
| Mobile/device engine | planned | [Evidence](../docs/research/completion-gates.md) |
| Live profile synchronizer | planned | [Evidence](../docs/research/completion-gates.md) |

## Workbench: Run lifecycle

| Acceptance check | State | Evidence |
| --- | --- | --- |
| Validated automation inputs | verified | [Evidence](../docs/validation.md) |
| Browser API launch | verified | [Evidence](../docs/validation.md) |
| Durable run queue | verified | [Evidence](../docs/validation.md) |
| Follow-up input | verified | [Evidence](../docs/validation.md) |
| Cooperative pause/resume | verified | [Evidence](../docs/validation.md) |
| Cancellation and deadlines | verified | [Evidence](../docs/validation.md) |
| Finish and close | verified | [Evidence](../docs/validation.md) |
| Archive checksum | verified | [Evidence](../docs/validation.md) |
| Saved run history | verified | [Evidence](../docs/validation.md) |
| Identity/profile reuse | verified | [Evidence](../docs/validation.md) |
| Failed-run preservation | verified | [Evidence](../docs/validation.md) |
| Lease release | verified | [Evidence](../docs/validation.md) |

## Workbench: Visual flows

| Acceptance check | State | Evidence |
| --- | --- | --- |
| Declarative flow packs | verified | [Evidence](../docs/api.md) |
| Graph layout | verified | [Evidence](../docs/api.md) |
| Action inspector | verified | [Evidence](../docs/api.md) |
| Draft revisions | verified | [Evidence](../docs/api.md) |
| Undo and redo | verified | [Evidence](../docs/api.md) |
| Validation | verified | [Evidence](../docs/api.md) |
| Immutable publication | verified | [Evidence](../docs/api.md) |
| Published run selection | verified | [Evidence](../docs/api.md) |
| Interaction recorder | planned | [Evidence](../docs/research/completion-gates.md) |
| Visual branches and loops | planned | [Evidence](../docs/research/completion-gates.md) |
| Extraction authoring | planned | [Evidence](../docs/research/completion-gates.md) |
| Recognition authoring | planned | [Evidence](../docs/research/completion-gates.md) |

## Workbench: Schedules

| Acceptance check | State | Evidence |
| --- | --- | --- |
| One-time schedules | verified | [Evidence](../docs/api.md) |
| Interval schedules | verified | [Evidence](../docs/api.md) |
| Encrypted inputs | verified | [Evidence](../docs/api.md) |
| Missed-run coalescing | verified | [Evidence](../docs/api.md) |
| Uncertain admission quarantine | verified | [Evidence](../docs/api.md) |
| Calendar cron rules | verified | [Evidence](../docs/validation.md) |
| IANA timezone/DST rules | verified | [Evidence](../docs/validation.md) |
| Wake a sleeping PC | planned | [Evidence](../docs/research/completion-gates.md) |

## Workbench: Integration

| Acceptance check | State | Evidence |
| --- | --- | --- |
| Embedded Browser plug-in | verified | [Evidence](../docs/validation.md) |
| Separate Browser/Workbench APIs | verified | [Evidence](../docs/api.md) |
| TypeScript clients | verified | [Evidence](../docs/api.md) |
| Python clients | verified | [Evidence](../docs/api.md) |
| Streamed archive transport | verified | [Evidence](../docs/api.md) |
| Extension-enabled automation | verified | [Evidence](../docs/validation.md) |
| Selenium qualification | planned | [Evidence](../docs/research/completion-gates.md) |
| Durable event replay coverage | planned | [Evidence](../docs/research/completion-gates.md) |

## Workbench: Release and recovery

| Acceptance check | State | Evidence |
| --- | --- | --- |
| Offline update signatures | verified | [Evidence](../docs/validation.md) |
| Verified upgrade backup | verified | [Evidence](../docs/validation.md) |
| Preserved coordinator identity | verified | [Evidence](../docs/research/local-desktop-upgrade-identity.md) |
| New desktop feature release | verified | [Evidence](../docs/validation.md) |
| Full rollback-cycle test | planned | [Evidence](../docs/research/completion-gates.md) |
| Forced-exit recovery matrix | planned | [Evidence](../docs/research/completion-gates.md) |
| Capacity/performance benchmark | planned | [Evidence](../docs/research/completion-gates.md) |
| Local roles and sharing | planned | [Evidence](../docs/research/completion-gates.md) |
