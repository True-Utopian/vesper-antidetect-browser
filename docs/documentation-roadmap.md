# Documentation, wiki and website roadmap

Requested 13 October 2026. These are required release features, currently **planned**. Existing Markdown API references and OpenAPI JSON endpoints do not satisfy the local documentation website requirement.

## Public project wiki

Maintain a navigable Vesper wiki for Browser and Workbench: installation, profiles, proxies, supported fingerprint policies and their limits, plug-in setup, automation, schedules, updates, troubleshooting and contribution guidance. Link it from both repositories. Review all examples against the supported release and provide a clear route for corrections.

Acceptance: the published wiki is reachable from both project READMEs, its navigation and internal links work, and its Windows and Linux walkthroughs match tested releases. Do not label Linux instructions as qualified before runtime acceptance.

## Public Vesper website

Create one coherent website by **true-utopian** for Vesper Browser and its optional Workbench plug-in. Include the product overview, honest feature/status information, source links, documentation/wiki navigation and release/download information. Identify unavailable downloads clearly and retain upstream license notices. Keep private application data out of the site.

Acceptance: the deployed site works on desktop and mobile, keyboard navigation and links pass review, published downloads match accepted release manifests, and it makes no unsupported masking or vendor-parity claims. Creating this roadmap does not deploy a site.

## Local API documentation website

Add an **API Docs** button in the main Browser app, plus access from Workbench. Clicking it opens a documentation website on the running application's loopback address in the user's default browser, for example `http://127.0.0.1:<actual-port>/docs`. Discover the running service address; do not hard-code a development port. Bundle the documentation and its assets in Windows and Linux installers so it works offline without a CDN or vendor login.

Document Browser and Workbench APIs with searchable endpoint navigation, request/response schemas, errors, profile ownership/leases, proxy handling, run lifecycle, flows, schedules, archive transport and TypeScript/Python examples. The Browser reference must remain usable when the Workbench plug-in is absent; Workbench documentation should identify when the plug-in is required. Show the installed documentation/API version and link the corresponding OpenAPI contract.

Keep credentials out of links, generated examples, logs and page source. If interactive requests are provided, require explicit operator input and an action to execute them; merely opening documentation must not change profiles or start runs. Documentation access must not weaken API authentication.

Acceptance: actual installed Windows and Linux controls open the correct local documentation URL; all bundled assets load offline; search, links, schemas and version labels work; examples execute successfully on owned fixtures; missing/disabled Workbench is explained accurately; and opening docs preserves profiles, credentials and active runs. Opening a Markdown file or returning raw OpenAPI JSON is not sufficient.

## Browser and Workbench user/developer guides

Provide searchable, versioned guides covering first launch, kernel installation, profiles and backup/restore, proxy manager, supported identity settings, Workbench installation/removal, visual flows, scripts, scheduling, SDK/API use, update/rollback limits and troubleshooting. Include clear screenshots of the actual UI and examples validated against the installed pair. Use one maintained documentation source for the website, wiki links and bundled local guide to avoid contradictory instructions.

Acceptance: a clean Windows and Linux installation can follow the quickstart and complete a Browser-owned Workbench run, verify the saved archive and restore an owned profile using the guides. Check navigation, offline packaged guidance, contribution instructions, version compatibility and SDK examples. Keep unimplemented features and unqualified recovery behavior explicit.
