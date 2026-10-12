# Vesper Browser

By **true-utopian**. An independent local browser engine, distributed under MIT.

Vesper Browser owns persistent Chromium profiles, encrypted proxy credentials,
browser installation and profile archives. Vesper Workbench consumes its public
API to schedule automation and preserve the resulting profile state. Browser
does not depend on Workbench, a vendor SDK, a subscription or a cloud account.

## Use independently

From this repository:

```powershell
npm install
npm run build --workspace @true-utopian/vesper-browser
node packages/vesper-browser/dist/cli.js --help
node packages/vesper-browser/dist/cli.js install
node packages/vesper-browser/dist/cli.js serve
node packages/vesper-browser/dist/cli.js token
node packages/vesper-browser/dist/cli.js create settings.json
node packages/vesper-browser/dist/cli.js open <profile-id>
```

Example settings:

```json
{
  "name": "Research",
  "locale": "en-GB",
  "timezone": "Europe/London",
  "viewport": { "width": 1280, "height": 800 },
  "proxy": {
    "value": "socks5",
    "extra": { "host": "proxy.example", "port": 1080, "id": "user", "secret": "password" }
  }
}
```

Set `VESPER_BROWSER_DIR` to select a private store. Do not open the same store
through Browser and Workbench simultaneously. Keep settings files containing
proxy credentials private; only the stored vault is encrypted. The key is kept
locally, so this protects accidental disclosure rather than a compromised PC.

The standalone manager runs at `http://127.0.0.1:3181/`. It has an authenticated
profile list with search, creation, editing, duplication and native browser
open/stop actions. The `token` command retrieves its private access token.
`VESPER_BROWSER_PORT` changes the loopback port. Bearer-authenticated API writes
reject foreign browser origins, and profile settings are limited to 64 KiB.
The default store `.vesper/browser` is separate from Workbench's existing store.
`VESPER_BROWSER_MAX_CONCURRENCY` sets its browser capacity (default one).

Workbench can also connect to this running Browser owner rather than opening its
own store. Both interfaces then see the same profiles:

```js
import { VesperBrowserClient } from '@true-utopian/vesper-browser';
const browser = new VesperBrowserClient({
  url: 'http://127.0.0.1:3181/',
  tokenFile: '.vesper/browser/admin-token',
});
await browser.ready();
console.log(await browser.listProfiles());
await browser.close(); // leaves the independent Browser service running
```

The client implements profile lifecycle, settings, duplication, CDP connection
lookup, versions and archive transfers. Archives are generated inside the service
and downloaded to an exclusive local destination; the API never accepts an
arbitrary export path on the server. Uploads are limited to 512 MiB and pass the
same archive validation as the standalone engine. Import overrides are applied
with a separate profile edit. Service setup and Chromium installation remain
Browser CLI responsibilities.

The package is ready to build and pack locally; it has not been published to npm.

## Embed in another tool

```js
import { VesperBrowser } from '@true-utopian/vesper-browser';
const browser = new VesperBrowser({ directory: '.vesper/browser' });
try {
  await browser.ready();
  const { id } = await browser.create({ name: 'Research' });
  await browser.start(id);
  console.log(await browser.connectionUrl(id)); // attach through CDP locally
  await browser.stop(id);
  await browser.export(id, 'research.workbench.tgz');
} finally {
  await browser.close();
}
```

## Present capability

- Unique Chromium user-data directories, restart persistence and storage isolation.
- Authenticated HTTP and SOCKS5 upstream proxies through a private loopback bridge.
- Explicit page locale, timezone and viewport settings.
- Profile editing, duplication, import/export and browser crash recovery.
- Profile archives omit proxy credentials and disposable browser caches.
- Legacy `.workbench.tgz` archive and vault bytes remain compatible with existing local profiles.

This release uses standard Chromium. It does not implement coherent fingerprint
personas, native canvas/WebGL/audio masking, mobile browser emulation, or verified
protection against every network leak. Locale/timezone settings apply to pages and
cross-site frame targets; popup initialization races and service workers still
need broader coverage.

The observation fixture found that a cross-site frame initially used the host's
Europe/London timezone and locale `fr`, while its parent requested America/New_York
and `fr-FR`. Vesper now pauses new iframe targets through Chromium's supported
CDP attachment API, applies the explicit settings, and resumes script execution.
The regression check records values captured by the frame's first fixture script.
This is a consistency repair, not a fingerprint persona or masking implementation.

## Validate

```powershell
npm run check --workspace @true-utopian/vesper-browser
npm run observe:browser
node scripts/browser-manager-smoke.mjs
```

The observation command at repository root launches a fresh test store, records
the main frame, same-origin and cross-origin frames, worker and early popup environment, verifies profile
storage isolation and checks that an unavailable proxy blocks a controlled local
origin. It never opens existing profiles. Results live in
`test-results/vesper-browser/observations.json`; they are evidence of this build,
not a claim of detection parity with another product.
