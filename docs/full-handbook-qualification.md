# Full handbook qualification

Browser **0.4.12** and Workbench **0.5.17** completed local full-guide acceptance on **4 November 2026**. This record covers the user/developer guide milestone; the full feature roadmap remains unfinished. Public source publication requires the corresponding repository CI checks. Applications, runtime binaries and raw private receipts remain local.

| Check | Windows | Linux |
| --- | --- | --- |
| Installed Browser and signed Workbench add-on: desktop, documentation and restart | 20 passed | 20 passed |
| Standalone Workbench | 18 packaged integration checks passed | Actual portable installer executed; 19 installed-executable checks passed in an owned store |
| Extended Browser/Workbench API integration | 9 passed | 9 passed |
| Proxy inventory integration | 7 passed | 7 passed |
| Native identity integration | 6 passed | 6 passed |
| Exact copied SDK archive-restore walkthrough | 8 passed | 8 passed |
| Installed production dependencies | Exact audited graphs and locks; zero recorded vulnerabilities | Exact audited graphs and locks; zero recorded vulnerabilities |
| Original profile, run and credential preservation | Fresh independently verified backup; original private files retained except intended add-on registry | Fresh independently verified backup; original private files retained except intended registry and deliberate qualified engine selection |

The clean walkthrough creates a Browser-owned Workbench run on an owned local fixture, stores a synthetic cookie, finishes and saves the run, verifies the archive size and SHA-256, executes the TypeScript import recipe copied from the served handbook, restores an independent profile, recovers the cookie without setting it again, and retains the result through two normal service restarts. The installed references also execute TypeScript and Python examples against the real services.

## One maintained guide source

Both repositories use `docs/handbook.json` and `packages/vesper-browser/public/docs/guides.json`. The generator produces the website, Markdown wiki and the 13-chapter full handbook. Desktop payloads include 26 manifest-allowlisted handbook files, including two original empty-store UI screenshots with accurate capture-version captions. Those screenshots contain no operator profiles or credentials.

The app's **API Docs → Full handbook → API Docs** path, archive restore instructions, screenshots, search, links and narrow layouts were checked in the actual installed pair on both operating systems. Documentation loads with external requests blocked and leaves private API authentication in place. Opening it does not run examples or mutate profiles.

Installed guides retain their immutable build-time status snapshot. The public checklist can advance after acceptance without changing previously qualified application assets. The release snapshot for this pair captured 81 checks; the full-guide acceptance advances the live inventory to 82 of 106.

## Packaging and native scope

The signed Workbench add-on now stages into a fresh unique directory. Independent extraction and actual installed audits confirm the expected 156-package production graph; removed packages from earlier staging no longer enter the archive. Browser's production graph contains 48 packages. Debian packaging also uses fresh disposable staging and releases it before portable compression. A regression covers removed files between versions and cleanup after failure.

Current local source checks passed 245 tests with zero failures and two explicit skips on each operating system; the independent Browser checkout passed 83. Unchanged native kernels retain their 26 recorded unit executions. New copied package runtimes passed all nine qualification cases; the Linux installed kernel path also passed fresh nine-case qualification and guarded activation with profile backups.

## Limits

- Windows Browser was upgraded with its actual NSIS installer. Standalone Workbench was exercised from packaged output; a new standalone NSIS installation and Authenticode publisher signing remain unqualified.
- Both Linux portable installers executed on the isolated host. Runtime checks use Xvfb with explicit software rendering and verify namespace/seccomp sandboxing. Privileged Debian installation and physical GPU qualification remain unqualified. Docs handoff used an owned per-process browser handler; host associations were not changed.
- Cookie recovery is a same-machine check. Cross-machine encrypted-cookie portability and a complete rollback/recovery matrix are not established.
- Broader WebGL/WebGPU, realtime audio, coherent font packs, arbitrary OS/GPU personas, Firefox/mobile engines and other pending inventory items are not completed by this documentation milestone.

See the [acceptance inventory](status.md), [documentation roadmap](documentation-roadmap.md), [native limits](native-kernel-qualification.md) and repository CI checks for the corresponding source state.
