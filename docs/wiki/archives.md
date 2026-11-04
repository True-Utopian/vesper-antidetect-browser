# Archives and extensions

Browser 0.4.14 / Workbench 0.5.19. By **true-utopian**.

Transport profile state and verify the saved result.

## Profile transport

Browser GET /api/v1/profiles/{id}/archive streams a profile archive to a client. The profile must be stopped and lease rules still apply. POST /profiles/import accepts application/gzip with a 512 MiB streaming limit. Imported profiles get an independent identity and proxy credentials are cleared. Archive transfer does not guarantee encrypted cookies will decrypt on a different PC.

## Workbench saved artifacts

A run is saved only after the browser is stopped and the archive is verified. GET /api/v1/runs/{id}/artifact downloads the saved file. Inspect run state and artifact size/hash metadata before treating it as durable output. A retained run or failed export is not a saved run. Resolve cleanup and ownership before retry-export; never discard an original profile while export is uncertain.

## Manifest V3 extensions

Browser /extensions/import accepts application/zip, up to 40 MiB compressed and 128 MiB expanded. Catalog IDs identify immutable versions. Assign a version to a stopped profile after reviewing its permissions. Assigned profiles, including trash, block catalog removal. Profile copies keep their extension packages and storage. Untrusted extensions run with their declared browser permissions.

## Binary requests

Send archive or extension bytes with the exact documented content type; do not wrap them in JSON. JSON request examples do not apply to binary endpoints. Keep profile archives private: cookies, browser history and website storage may contain sensitive data.

## Restore a saved run in the manager

Open Runs & archives and select a saved run. Download its archive and retain the recorded SHA-256 and byte size. In Browser Profiles, use Import and select that .tgz file. Import creates an independent profile with a new ID; it does not overwrite the original. Open the imported profile, inspect the expected owned website state, then stop it normally. Proxy credentials are omitted from transport and must be assigned again. Same-machine cookie recovery is tested separately from cross-PC cookie portability; keep the original profile until you have verified the restored copy.

## Restore with the TypeScript client

Use a private Browser origin and token-file path discovered from its running service. Verify the downloaded file digest against the saved run record before importing. The helper below streams the saved file through the Browser archive API; keep it out of source control.

```text
import { VesperBrowserClient } from "@true-utopian/vesper-browser";

const url = process.env.VESPER_BROWSER_ORIGIN;
const tokenFile = process.env.VESPER_BROWSER_TOKEN_FILE;
if (!url || !tokenFile) {
  throw new Error("Set the private Browser origin and token-file path first.");
}
const browser = new VesperBrowserClient({ url, tokenFile });
const restored = await browser.importProfile("owned-saved-profile.tgz");
console.log(restored.id); // Independent profile; original remains intact.
```

## Restore with cURL

Use the Browser token, not the Workbench token. POST the raw gzip archive, without a JSON wrapper. The server enforces a 512 MiB import limit. A successful import returns the new profile; inspect it before deleting any original data.

```text
curl --fail \
  --header "Authorization: Bearer $VESPER_BROWSER_TOKEN" \
  --header "Content-Type: application/gzip" \
  --data-binary @owned-saved-profile.tgz \
  "$VESPER_BROWSER_ORIGIN/api/v1/profiles/import"
```

[Wiki contents](README.md) · [Report a correction](https://github.com/True-Utopian/vesper-workbench/issues)
