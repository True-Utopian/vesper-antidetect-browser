<p align="center"><img src="public/vesper-icon.png" width="100" alt="Vesper moth emblem"></p>

# Vesper Browser

**By true-utopian.** An open-source local browser profile manager with an original native Chromium kernel under development. [Vesper Workbench](https://github.com/True-Utopian/vesper-workbench) adds automation as an optional desktop plug-in.

## Status

![Browser](docs/assets/badge-browser.svg) ![Workbench](docs/assets/badge-workbench.svg)

![Vesper acceptance progress](docs/assets/status.svg)

<sub>Green means a named acceptance check passed; grey means pending. Squares visualize proportions, not additional checks. Percentages do not measure vendor parity or detection resistance. See the [evidence-linked checklist](docs/status.md).</sub>

The installed Windows Browser 0.4.3 and Workbench 0.5.5 have passed profile lifecycle, extension storage, verified export/import, calendar/DST, SDK and real automation checks. **The custom kernel is still compiling: native tests and installed activation are pending.** WebGL/WebGPU, audio/fonts, coherent personas, additional engines and real Linux execution remain unfinished. [Measured validation](docs/validation.md) · [Completion gates](docs/research/completion-gates.md).

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

Use `npm run package:windows` or `npm run package:linux` to build the desktop app. The light installer obtains a compiled upstream Chromium runtime when needed. The qualified custom-kernel runtime will be packaged separately once acceptance passes.

**End users do not need the Chromium source checkout.** The large checkout is only for developers compiling the native kernel; ordinary installers contain or obtain compiled browser files. [Native kernel build instructions](native/chromium/README.md).

## Workbench add-on and API

Install a trusted signed Workbench add-on through Browser → Add-ons. Its runs, visual flows and schedules appear inside Browser. The plug-in owns its automation service; it connects to the same Browser profile store. Browser can run independently. [Plug-in contract](docs/workbench-addon.md) · [Browser API](packages/vesper-browser/README.md) · [Workbench source](https://github.com/True-Utopian/vesper-workbench).

This repository contains Browser source, desktop host, original kernel patches and the joint acceptance inventory. Workbench remains separately buildable; its compatibility snapshot of Browser is synchronized from this source until a versioned package release is published. Private profiles, credentials, signing keys, vendor binaries and raw reverse-engineering artifacts are excluded.

## Research

Independent requirements are based on public documentation and bounded read-only observations of locally installed software with REA. The [research ledger](docs/research/feature-ledger.md) records evidence and unknowns. Full proprietary engine internals and competitor parity are not claimed.

MIT license. Vesper Browser and Vesper Workbench by true-utopian.
