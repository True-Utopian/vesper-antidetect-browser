# Local API Docs

By **true-utopian**. Browser **0.4.10** and Workbench **0.5.15** bundle a local API reference. Open **API Docs** in the Browser header or API access page, or in Workbench navigation or Connections & API. The desktop opens the running service’s `/docs` address in the default browser. Ports are discovered from the running service; examples do not assume a development port.

The reference works offline. HTML, styles, script, artwork and guides ship inside each installer and the signed Workbench add-on. Browser documentation remains usable without Workbench. Workbench has its own service, version and token; its reference links to the connected Browser documentation when configured with a loopback Browser service.

## Contracts and examples

The navigation lists the installed contract’s versioned operations: 50 Browser operations and 40 Workbench operations in this release. Search paths, methods, descriptions and guides; filter by HTTP method. Each operation displays its declared parameters, body and response schemas. Expand JSON schemas for nested constraints. Where a response schema is absent or generic, the reference says so; complete typed response coverage remains separate work.

TypeScript, Python and cURL request examples use the running origin. Examples are templates: replace placeholders, review required fields and use owned fixtures. Optional profile settings are omitted from the minimal creation example so mutually exclusive proxy and identity controls are not combined. Binary archive and extension operations explain their exact content types rather than generating misleading JSON uploads. Calendar preview has an executable London timezone example.

Bundled guides explain discovery/authentication, revisions and durable leases, native policy limits, proxies, archive and extension transport, run recovery, flow publication, schedules and structured errors. Browser shows six applicable guides; Workbench shows seven. These API guides do not satisfy the separate public wiki, website or complete versioned user-guide roadmap.

## Authentication and privacy

Documentation and its static contract are read-only public resources on the local service. Private `/api/` operations, including the existing API OpenAPI route, retain authentication and origin checks. Merely opening documentation does not submit a run, create a schedule or launch a profile.

The native button accepts no URL or credential from the renderer. The main process derives the address from the requesting local application or its signed Workbench child. Credentials are never placed in links or supplied to an external browser. Examples read the appropriate instance token from a private environment variable. There is no Execute button and no token storage in the reference.

## Acceptance record — 3 November 2026

The current Windows and Linux source suites each pass **239 tests**, with zero failures and two platform/environment skips. The independent Browser source checkout passes **78 tests**.

The actual Windows Browser 0.4.10 and signed Workbench 0.5.15 passed **17 desktop/documentation/restart checks**, plus nine API, seven proxy, six native identity checks and Python scheduling. All nine desktop/reference screenshots were reviewed. Browser and both Workbench API Docs controls selected the running credential-free localhost URLs, and the Windows shell accepted both default-browser handoffs. Normal startup and restart selected the original registered profile store without a data-root environment override. Original profiles, historical runs, credential bytes and proxy storage were preserved.

Linux executed both actual per-user portable installers from freshly extracted, checksum-matching archives. The installed pair passed 17 desktop/documentation/restart checks, nine API, seven proxy, six native identity checks, Python scheduling and namespace/seccomp sandbox verification. All eleven screenshots were reviewed. Under Xvfb, real OS handoffs used an owned per-process browser handler; host default associations were unchanged. Explicit software rendering was used; physical GPU and privileged Debian installation remain unqualified.

The references passed search/filter reset, guide navigation, schema expansion, code languages/copy, current version/contract checks, direct-link recovery and mobile layout with non-loopback requests blocked. Exact copied TypeScript and Python GET examples and a Python London DST preview executed successfully. Opening the references and running these read-only examples did not create a profile, schedule or run. Private API authentication remained required.

These checks qualify only the named localhost API Docs milestone. They do not complete the separate public wiki, website or full user/developer guide requirements. No new C++ fingerprint behavior is claimed by this application update.

From Workbench source, use `scripts/qualify-api-docs.mjs` against an already-running pair with `--data-root` and a private `--output`. Optionally supply `--examples` containing the reviewed `browser-get.ts`, `browser-get.py`, `workbench-get.ts`, `workbench-get.py` and `workbench-preview.py` files copied from that running reference. `scripts/qualify-desktop-docs.mjs` exercises the native controls, layouts and normal restart. `--actual --default-store` checks a registered original store; `--packaged-integration` uses a new owned packaged fixture and records actual-installed proof as false. Raw receipts, screenshots and application data stay local.
