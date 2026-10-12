# Saved proxy connections

Vesper Browser by **true-utopian** now has a reusable connection manager in the source build. The installed Browser 0.4.4 / Workbench 0.5.6 pair has not received this feature yet. Its roadmap entry remains **source tested**, pending the next packaged and installed desktop acceptance.

Open **Proxy connections** to create, search, edit, assign or remove an HTTP or SOCKS5 connection. New profiles can choose **Use a saved connection** in their Proxy tab. Each assignment copies the endpoint and credentials into that profile’s encrypted vault. Editing or removing an inventory entry affects future assignments; existing profile connections remain intact. Assign the connection again to update a stopped profile. Running profiles and automation leases retain their existing protections.

The complete inventory is stored as one atomically replaced AES-256-GCM encrypted file. The authenticated API returns names, endpoints, revisions and credential-presence flags. It does not return stored usernames or passwords. Edit dialogs keep credential fields blank and disabled until **Keep stored credentials** is unchecked. Empty replacement fields explicitly clear the corresponding stored credentials. No credentials or inventory references enter public profile manifests, templates or exported archives.

The loopback API provides `GET/POST /api/v1/proxies`, `PATCH/DELETE /api/v1/proxies/{proxyId}` and `POST /api/v1/profiles/{id}/proxy`. Edits, removal and assignments require the current inventory revision; a stale revision returns 412. Profile assignment also requires its automation lease key when owned. A new profile can supply `savedProxy: { id, revision }` instead of an inline `proxy`. Resolution happens before profile creation and under the same catalog queue as extension assignment, preventing catalog deletion from overtaking an admitted creation.

The TypeScript Browser client exposes `proxies`, `saveProxy`, `removeProxy` and `assignProxy`. The standard-library Python Browser client exposes `proxies`, `save_proxy`, `remove_proxy` and `assign_proxy`. Workbench’s **Open and inspect a browser** automation accepts `savedProxyId` and `savedProxyRevision`. Custom automation profile hooks and flow profile settings can pass the same `savedProxy` reference. Browser resolves the credentials locally; Workbench does not need credential readback.

From a Vesper Workbench source checkout, run:

```sh
npm run check
node scripts/qualify-proxy-inventory.mjs
```

The integration script uses temporary synthetic profiles and an authenticated loopback proxy serving one owned fixture origin. It starts a real Chromium session through Workbench, observes the fixture, refuses replacement while running, saves and verifies its archive, imports an independent profile with credentials cleared, and exercises the Python SDK. Set `LOCAL_BROWSER_EXECUTABLE` and `PYTHON_EXECUTABLE` when your local runtime paths differ. Reports remain private under `test-results/proxy-inventory`.

Local Windows source qualification passed 158 tests (29 Browser and 129 Workbench/root), with one optional external PostgreSQL test skipped. The real Browser–Workbench proxy run passed five integration checks and the source UI passed nine checks at 1366×900 and 1280×800 without renderer errors or table overflow. Rotation workflows, whole-browser DNS/UDP/WebRTC/IPv6 capture, Linux runtime qualification and actual installed acceptance remain pending. These checks do not establish fingerprint parity or detection avoidance.
