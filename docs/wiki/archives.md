# Archives and extensions

Browser 0.4.10 / Workbench 0.5.15. By **true-utopian**.

Transport profile state and verify the saved result.

## Profile transport

Browser GET /api/v1/profiles/{id}/archive streams a profile archive to a client. The profile must be stopped and lease rules still apply. POST /profiles/import accepts application/gzip with a 512 MiB streaming limit. Imported profiles get an independent identity and proxy credentials are cleared. Archive transfer does not guarantee encrypted cookies will decrypt on a different PC.

## Workbench saved artifacts

A run is saved only after the browser is stopped and the archive is verified. GET /api/v1/runs/{id}/artifact downloads the saved file. Inspect run state and artifact size/hash metadata before treating it as durable output. A retained run or failed export is not a saved run. Resolve cleanup and ownership before retry-export; never discard an original profile while export is uncertain.

## Manifest V3 extensions

Browser /extensions/import accepts application/zip, up to 40 MiB compressed and 128 MiB expanded. Catalog IDs identify immutable versions. Assign a version to a stopped profile after reviewing its permissions. Assigned profiles, including trash, block catalog removal. Profile copies keep their extension packages and storage. Untrusted extensions run with their declared browser permissions.

## Binary requests

Send archive or extension bytes with the exact documented content type; do not wrap them in JSON. JSON request examples do not apply to binary endpoints. Keep profile archives private: cookies, browser history and website storage may contain sensitive data.

[Wiki contents](README.md) · [Report a correction](https://github.com/True-Utopian/vesper-workbench/issues)
