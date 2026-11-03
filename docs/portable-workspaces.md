# Portable source workspaces

By **true-utopian**. Vesper source can live on an exFAT data drive. Installed applications still use their private per-user data directories; moving the source checkout does not move profiles or credentials.

## Workspace dependencies

`npm run build:browser` in Workbench, or `npm run build` in Browser, compiles the Browser package and runs `scripts/sync-browser-workspace.mjs`. Normal workspace links remain in use where supported. An empty or previously generated dependency directory on exFAT becomes an ordinary verified copy of the built package. Content hashes detect changes even when file sizes and coarse timestamps are unchanged. Unrelated dependencies and linked source assets are refused.

Desktop packaging installs its local `file:` package with npm's `--install-links` option, which packs the dependency into the payload instead of leaving an unusable link to the checkout. End users install compiled application files and do not need the Chromium source tree.

Production dependencies install in fresh temporary staging seeded from the source dependency lock. Local Browser package snapshots are regenerated and their contracts checked before the generated dependency directory is activated. This prevents a reused packaging folder from silently retaining older nested dependencies when the local package changes without another version bump. The exact resulting lock and dependency notices accompany the payload; both product graphs are audited separately.

Packaging uses the project's ignored `.workbench/npm-cache` by default so unrelated global-cache problems do not contaminate it. `VESPER_NPM_CACHE` can select another build-cache directory. Dependency-install regression fixtures use their own temporary caches and leave the caller's npm configuration unchanged.

## Private locations

Keep profiles, proxy credentials, signing/SSH keys and Windows sandbox runtime on NTFS or an equivalent permission-aware filesystem. Use the existing private data root when launching a moved checkout; never select an empty substitute store and describe it as the original installation. Source paths and historical qualification receipts are separate from private data locations.

Both desktop products support an optional private `~/.vesper/desktop-location.json` file containing `{"schemaVersion":1,"dataRoot":"<absolute existing directory>"}`. It selects the same canonical store when different launchers expose different application-data directories. Explicit `VESPER_DESKTOP_DATA_DIR` settings take precedence for owned test fixtures and operator overrides. An unavailable or invalid saved location stops startup instead of creating an empty fallback store. Existing installations without this file retain their normal per-user location.

The Windows upgrade helper can register the verified original store with `--register-data-root` during a full Browser upgrade. Its dry run checks for conflicts without writing the file. Registration happens only after the backup, installed-version verification and original private-file checks pass; an existing configuration for another store is refused, and a matching configuration retains its original bytes. The helper does not move profiles or set global environment variables.

For an SSD source checkout, keep source, `node_modules`, the development Node toolchain and active packaging output on the SSD. Bulky historical artifacts and downloads may remain on a separate archive drive. `scripts/desktop-build.mjs` accepts `--stage-root`, `--release-root` and `--upstream-browser` so active packaging can use explicit SSD directories and a verified installed stock runtime without rewriting historical native proof paths. Preserve the existing Chromium compiler cache when moving a checkout.

New Windows update signing keys default to `%LOCALAPPDATA%/true-utopian/vesper-build/signing/ed25519-private.pem`. Existing project keys retain their trust identity. To use a moved key, set the absolute `VESPER_UPDATE_SIGNING_KEY_FILE` path or the `privateKeyFile` field in ignored `.workbench/release-signing/location.json`. A missing configured key is an error, not permission to generate a replacement. Protect the actual file with the operating system's private-key permissions and verify its public key still matches the installed application.

## Upgrades and evidence

The local desktop upgrade helper still requires stopped applications, idle profiles/runs/schedules, a checksum-verified backup and an offline database check. An incremental backup base must include completed verification metadata. Missing metadata requires a fresh full backup; existing data is not overwritten to recreate that metadata.

After moving source, the release audit can explicitly verify a copied runtime at its new location without rewriting old receipts:

```text
node scripts/release-gates.mjs --copied-runtime <qualified-bundle>/vesper-kernel.json
```

The original executable, native unit XML, copied manifest, native proof and every runtime component hash remain required. Changing a path does not qualify an untested binary. The repeatable installed docs/integration helper lives in the [Workbench source](https://github.com/True-Utopian/vesper-workbench/blob/main/scripts/qualify-desktop-docs.mjs); raw receipts and screenshots remain private.
