<p align="center"><img src="public/vesper-icon.png" width="100" alt="Vesper moth emblem"></p>

# Vesper Browser

**By true-utopian.** An open-source local browser profile manager with an original native Chromium kernel under development. [Vesper Workbench](https://github.com/True-Utopian/vesper-workbench) adds automation as an optional desktop plug-in.

## Status

![Browser](docs/assets/badge-browser.svg) ![Workbench](docs/assets/badge-workbench.svg)

![Vesper acceptance progress](docs/assets/status.svg)

<sub>Green means a named acceptance check passed; grey means pending. Squares visualize proportions, not additional checks. Percentages do not measure vendor parity or detection resistance. See the [evidence-linked checklist](docs/status.md).</sub>

The installed Windows Browser 0.4.7 and Workbench 0.5.10 passed profile lifecycle, extension storage, verified export/import, calendar/DST, SDK and real automation checks. The original Windows kernel passed 26 native unit executions, nine direct and nine copied-runtime cases, installed Browser–Workbench integration and persisted identity checks. Broader WebGL/WebGPU, realtime audio, coherent font packs, personas, additional engines and real Linux execution remain unfinished. [Native qualification and its limits](docs/native-kernel-qualification.md). [Measured validation](docs/validation.md) · [Completion gates](docs/research/completion-gates.md).

Automatic native-process-loss cleanup and normal Finish saving passed in the installed 0.5.10 add-on. [Recovery scope and recent-write limitation](docs/native-process-recovery.md).

A public wiki, Vesper website, bundled local **API Docs** website/button and versioned Browser/Workbench guides are required, planned release work. [Documentation acceptance criteria](docs/documentation-roadmap.md).


Native identity follow-up (13 October): Browser 0.4.8 / Workbench 0.5.11 source passes 206 tests (zero failures, two Windows environment skips). Bounded native/4-thread/8-thread hardware policies, observed-page consistency checks and qualification-aware surface reporting are implemented. Five fresh real-kernel integration checks and normal Browser/Inspect UI workflows passed in isolated stores. Windows installers are being qualified; the user’s installed pair remains 0.4.7 / 0.5.10 pending the idle/backup upgrade gate. Linux compilation, 26 native unit executions and all nine direct runtime cases passed after the explicitly approved workspace-only sandbox rule and an owned font dependency fixture. Copied-runtime, packaging and actual installed Linux acceptance remain pending. [Scope and API](docs/native-identity.md).

## Use Vesper

Local profiles, folders, favorites, tags, notes, proxy routing, cookie tools, templates and reversible trash are available. Profiles are owned by Browser; Workbench uses the authenticated API and saves checksum-verified archives after automation completes. Both apps work with local storage and require no vendor subscription. Proxies are operator supplied.

Windows installers and the signed Workbench add-on are currently built and tested locally; public downloadable releases are not yet published. Linux package structure is checked, but native Linux execution is pending.

## Build from source

Node.js 24 or newer is required. From a clean checkout:

```sh
npm ci
npm run check
npm run desktop:browser
```

Use `npm run package:windows` or `npm run package:linux` to build the desktop app. The light installer obtains a compiled upstream Chromium runtime when needed. The full installer can include a qualified custom kernel with `--full --native-kernel-manifest /path/to/vesper-kernel.json`. Copied-runtime qualification repeats during packaging; the guarded 0.4.7 / 0.5.9 installed upgrade and native/form checks passed locally. [Bundled engine and safe upgrades](docs/windows-native-installer.md).

**End users do not need the Chromium source checkout.** The large checkout is only for developers compiling the native kernel; ordinary installers contain or obtain compiled browser files. [Native kernel build instructions](native/chromium/README.md).

## Workbench add-on and API

Install a trusted signed Workbench add-on through Browser → Add-ons. Its runs, visual flows and schedules appear inside Browser. The plug-in owns its automation service; it connects to the same Browser profile store. Browser can run independently. [Plug-in contract](docs/workbench-addon.md) · [Browser API](packages/vesper-browser/README.md) · [Workbench source](https://github.com/True-Utopian/vesper-workbench).

This repository contains Browser source, desktop host, original kernel patches and the joint acceptance inventory. Workbench remains separately buildable; its compatibility snapshot of Browser is synchronized from this source until a versioned package release is published. Private profiles, credentials, signing keys, vendor binaries and raw reverse-engineering artifacts are excluded.

## Research

Independent requirements are based on public documentation and bounded read-only observations of locally installed software with REA. The [research ledger](docs/research/feature-ledger.md) records evidence and unknowns. Full proprietary engine internals and competitor parity are not claimed.

MIT license. Vesper Browser and Vesper Workbench by true-utopian.
