<p align="center"><img src="public/vesper-icon.png" width="100" alt="Vesper moth emblem"></p>

# Vesper Browser

**By true-utopian.** An open-source local browser profile manager with an original native Chromium kernel under development. [Vesper Workbench](https://github.com/True-Utopian/vesper-workbench) adds automation as an optional desktop plug-in.

## Status

![Browser](docs/assets/badge-browser.svg) ![Workbench](docs/assets/badge-workbench.svg)

![Vesper acceptance progress](docs/assets/status.svg)

<sub>Green means a named acceptance check passed; grey means pending. Squares visualize proportions, not additional checks. Percentages do not measure vendor parity or detection resistance. See the [evidence-linked checklist](docs/status.md).</sub>

Browser **0.4.10** and signed Workbench **0.5.15** passed local installed qualification on **3 November 2026**. Windows passed 17 desktop/documentation/restart checks, nine API checks, seven proxy checks, six native identity checks and Python scheduling. Both Linux portable installers executed from freshly extracted archives; the installed pair passed the same integration checks, 17 desktop checks and namespace/seccomp sandbox verification under Xvfb with explicit software rendering. [Windows scope](docs/windows-installed-qualification.md) · [Linux scope](docs/linux-native-qualification.md).

**API Docs** opens an offline localhost reference from Browser and Workbench, with searchable contracts, schemas and TypeScript/Python/cURL examples: 50 Browser operations and 40 Workbench operations. Private API authentication stays in place. The public wiki, website and complete versioned user/developer guides remain planned. [Local reference](docs/localhost-api-docs.md) · [Documentation roadmap](docs/documentation-roadmap.md).

Source checks pass **239 tests** with zero failures and two explicit skips on each operating system; the independent Browser checkout passes 78 tests. The unchanged custom kernels retain their 26 native unit executions and nine direct/copy cases; packaging repeats all nine copied cases, and installed native identity is tested against the actual applications. Broader WebGL/WebGPU, realtime/device audio, coherent font packs, arbitrary OS/GPU personas, Firefox/mobile and broader recovery/network qualification remain unfinished. [Native limits](docs/native-kernel-qualification.md) · [Measured validation](docs/validation.md).

Only the local API Docs milestone advances in this update: **79 of 106** named acceptance checks. A passing installed pair does not complete the roadmap. Public source CI is tracked for each release; applications, runtime binaries, profiles, credentials and raw receipts remain private. Windows standalone Workbench UI was exercised from packaged output; a new standalone Workbench NSIS installation was not performed. Linux privileged Debian installation and physical GPU qualification remain pending.

## Use Vesper

Local profiles, folders, favorites, tags, notes, proxy routing, cookie tools, templates and reversible trash are available. Profiles are owned by Browser; Workbench uses the authenticated API and saves checksum-verified archives after automation completes. Both apps work with local storage and require no vendor subscription. Proxies are operator supplied.

Windows installers and the signed Workbench add-on are built and tested locally; public downloadable releases are not yet published. Linux portable installers passed real isolated execution with explicit software rendering. Privileged Debian installation and physical GPU qualification remain pending.

## Build from source

Node.js 24 or newer is required. From a clean checkout:

```sh
npm ci
npm run check
npm run desktop:browser
```

Use `npm run package:windows` or `npm run package:linux` to build the desktop app. The light installer obtains a compiled upstream Chromium runtime when needed. The full installer can include a qualified custom kernel with `--full --native-kernel-manifest /path/to/vesper-kernel.json`. Copied-runtime qualification repeats during packaging. The current Windows Browser installer and signed Workbench add-on passed their guarded installed upgrade, native identity and default-store checks. [Bundled engine and safe upgrades](docs/windows-native-installer.md).

**End users do not need the Chromium source checkout.** The large checkout is only for developers compiling the native kernel; ordinary installers contain or obtain compiled browser files. [Native kernel build instructions](native/chromium/README.md).

## Workbench add-on and API

Install a trusted signed Workbench add-on through Browser → Add-ons. Its runs, visual flows and schedules appear inside Browser. The plug-in owns its automation service; it connects to the same Browser profile store. Browser can run independently. [Plug-in contract](docs/workbench-addon.md) · [Browser API](packages/vesper-browser/README.md) · [Workbench source](https://github.com/True-Utopian/vesper-workbench).

This repository contains Browser source, desktop host, original kernel patches and the joint acceptance inventory. Workbench remains separately buildable; its compatibility snapshot of Browser is synchronized from this source until a versioned package release is published. Private profiles, credentials, signing keys, vendor binaries and raw reverse-engineering artifacts are excluded.

## Research

Independent requirements are based on public documentation and bounded read-only observations of locally installed software with REA. The [research ledger](docs/research/feature-ledger.md) records evidence and unknowns. Full proprietary engine internals and competitor parity are not claimed.

MIT license. Vesper Browser and Vesper Workbench by true-utopian.
