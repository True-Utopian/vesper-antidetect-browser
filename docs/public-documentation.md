# Public website and wiki

Original Vesper Browser and Workbench documentation by **true-utopian**. Reviewed 3 November 2026 for Browser **0.4.10** and Workbench **0.5.15**.

- [Public website](https://vesper-by-true-utopian.ivory-spoon-5461.chatgpt.site)
- [Project wiki](https://vesper-by-true-utopian.ivory-spoon-5461.chatgpt.site/wiki/index.html)
- [Versioned handbook](https://vesper-by-true-utopian.ivory-spoon-5461.chatgpt.site/v/0.4.10-0.5.15/wiki/index.html)
- [Source-readable wiki](wiki/README.md)

The website introduces the Browser and optional signed Workbench add-on, publishes the named acceptance inventory and explains release availability. Its profile table and saved-run preview are explicitly illustrative. Public runtime downloads are unavailable; there are no fabricated download buttons. Applications, private profiles, credentials, keys and raw runtime/vendor evidence remain local.

The 13-chapter wiki combines the existing bundled API guides with installation, first-run, update/recovery and contribution chapters. It covers Windows installed Browser plus its add-on and the qualified Linux per-user portable path. It distinguishes physical GPU and privileged Debian installation from the accepted software-rendered Linux fixture. It explains version compatibility, default store selection and the limits of fingerprint policies, recovery and public distribution.

## Maintained sources

Both checkouts use `docs/handbook.json` and `packages/vesper-browser/public/docs/guides.json` as their maintained guide sources. The API guide remains bundled in the localhost reference. `scripts/build-public-docs.mjs` generates the website and Markdown wiki from those inputs plus `docs/status.json`; generated copies are not separately maintained prose. Version URLs retain the matching Browser/Workbench pair.

Run `node scripts/build-public-docs.mjs` to create ignored local site output. Run `node scripts/check-public-docs.mjs` to generate an isolated site, validate all internal links and assets, check unique page IDs/version inventory, and reject private machine/credential material or active external resources. CI runs this check on Windows and Linux. The site uses its existing vector moth mark, local CSS and JavaScript; no fonts, analytics or API tokens are loaded from a third party.

## Acceptance scope

The initial public deployment succeeded through Sites. Local review covered a 1440-pixel desktop, 390-pixel phone and narrow 320-pixel layout. Browser/Workbench tabs were tested with clicks and keyboard navigation; guide search included no-match recovery and a matching navigation result. Mobile contents collapse and reopen, direct guide navigation, progress and release pages were reviewed. No horizontal page scrolling appeared in the measured views. Static checking covers all current and versioned pages and their local links.

This accepts the public website and navigable project wiki only after the corresponding source links and CI are published. It does **not** complete the separate full user/developer guide acceptance milestone: a clean Windows/Linux guided run, archive verification and owned-profile restore walkthrough, broader screenshots and complete offline guide packaging remain required. No installer rebuild or native kernel change is implied by this documentation publication.
