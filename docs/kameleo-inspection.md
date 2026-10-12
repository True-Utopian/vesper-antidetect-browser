# Local Kameleo inspection, 10 October 2026

This record distinguishes inspected evidence from independently implemented behavior. It is not a claim that all of Kameleo has been reverse engineered.

## Observed artifacts

The installed application was found under the current user's `AppData/Local/Programs/Kameleo` directory. Its desktop package contains Electron resources, a native Engine executable, extensions, and proxy/automation helper executables.

[REA](https://github.com/morluto/rea), pinned to `rea-agents@6.3.0`, analyzed the local `resources/app.asar` without running its contents. Its progress reported parsing 6,070 application source artifacts, constructing application/Electron boundary relationships, and sealing the evidence. The preserved evidence file is `.workbench/research/kameleo-electron.json` (private, gitignored).

- Application package SHA-256: `bad1857aa484fe7f75552d43eb05a8637edd2258f213bb2c043e3cebb28acd9d`.
- Application evidence ID: `ev_107c71c96c9ba0aeddfaaf6bd9a3d237e70663f209230d935862093da5d61be4`.
- Application graph: 33,679 nodes and 69,046 edges; no reported package integrity contradictions. The analysis explicitly reports incomplete coverage and unresolved dynamic relationships.
- First-party inventory paths included `client-gui-electron/main.js`, `main.preload.js`, and compiled `client-gui/dist` bundles. Dependency files also contribute to the artifact count.

REA's managed-artifact inspection classified `Kameleo.Engine.exe` as an x86-64 PE with no CLI data directory. Managed metadata/CIL inspection was unavailable; that result does not establish the executable's source language or prove that all of its implementation is native.

- Engine SHA-256: `273c70a42294b951ea83ed980f6333e4569bb11224631a0c4dc236fa4984a9fa`.
- Engine size: 115,270,256 bytes.
- Engine evidence ID: `ev_e08ad9f4e45005941adc1dc0d24d4fa35a127292ac5140da6a70f764e4cb1db4`.
- Evidence: `.workbench/research/engine-metadata.json`.

The installed `Api.xml` describes fingerprint search, health checking, profile list/create/read/update, proxy tests, start/stop, kernel installation/upgrades, duplication, and archive export/import. The existing workbench's TypeScript SDK adapter implements its create/install/start/stop/export and Puppeteer connection path. These shipped contracts informed the lifecycle boundary used for the alternative.

## Independent implementation boundary

`LocalEngine` is new workbench code using public Puppeteer, Chromium, proxy-chain and tar interfaces. It recreates the profile lifecycle needed by the workbench with independent storage and archive formats. No vendor executable, extension, GUI bundle, kernel patch, account token, or copied vendor implementation is added to the project or distributed by it.

The [product roadmap](design/local-browser-roadmap.md) makes observable behavior the research reference and defines acceptance criteria for the original alternative. This inspection record is evidence of limited research coverage, not a specification to clone the vendor's implementation.

Further local REA passes are indexed in the [feature ledger](research/feature-ledger.md). The [Chroma interaction assembly report](research/kameleo-kernel-boundary.md) adds managed metadata and selected CIL call anchors; that does not recover the native kernel's masking implementation.

The inspection did not decompile the native Engine, reverse engineer its licensing, recover proprietary browser-kernel patches, reconstruct its fingerprint corpus, or qualify detection parity. Static Electron relationships are evidence about packaged code structure, not proof that a particular path executes. The local backend intentionally reports standard Chromium capabilities and rejects unsupported Kameleo settings.

## Reproduce local inspection

```powershell
npx --yes rea-agents@6.3.0 analyze-javascript-application "$env:LOCALAPPDATA\Programs\Kameleo\resources\app.asar" --format json
npx --yes rea-agents@6.3.0 inspect-managed-artifact "$env:LOCALAPPDATA\Programs\Kameleo\Kameleo.Engine.exe" --format json
```

The first command produces a large evidence graph. The actual run saved it under `.workbench/research` and did not install REA into global agent configuration. All project changes and analysis outputs were made on this PC; no commits, pushes, or pull requests were created.
