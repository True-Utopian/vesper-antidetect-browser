# Bundled Windows native engine

Vesper Browser and Workbench are original open-source projects by **true-utopian**. The full Windows installer can include a previously qualified Vesper native runtime. A browser user does not need the Chromium source checkout or a compiler.

After building the JavaScript packages, package a qualified local runtime with:

```sh
node scripts/desktop-build.mjs browser win32 --full --native-kernel-manifest /path/to/vesper-kernel.json
node scripts/desktop-build.mjs workbench win32 --full --native-kernel-manifest /path/to/vesper-kernel.json
node scripts/workbench-plugin.mjs win32
```

The packager checks the manifest, executable and runtime hashes, prepares read/execute access for Chromium's restricted Windows sandbox, and repeats all nine native qualification cases on the actual copied package. It stops before producing an accepted installer if that proof fails. The installer applies the same restricted read/execute access only to the binary directory. It does not grant access to profile data or disable the browser sandbox.

On first startup, Browser validates and stages its bundled native engine under **Engine updates**. Discovery preserves existing engine selections and profile settings. **Test, back up and activate** runs fresh qualification and saves stopped-profile backups before changing the Vesper engine selection. An unactivated native profile refuses to launch. Workbench is an optional signed add-on and uses Browser's profile owner and active Vesper engine.

For a real upgrade, use `scripts/apply-local-desktop-upgrade.mjs` with the exact existing data directory and an accepted release record. Its default mode is a read-only preflight. Applying the upgrade requires idle runs, paused schedules and normally closed desktop/service processes. It checks the installed trust key, copies and verifies the complete private store, checks an offline copy of the coordinator database, and verifies original file hashes before relaunching the same store. No profiles are migrated to a new data directory or silently assigned a different engine.

Checksum verification uses eight bounded readers and still hashes every file. It rejects missing, changed or escaping files and drains active readers before reporting an error. An interrupted pre-install backup can be explicitly resumed with `--apply --resume-backup /path/to/existing-backup`; the helper requires a real sibling backup directory, rejects an already-applied backup, verifies the complete source/copy inventories again, and repeats the idle and unchanged-source checks before installation. Resumption never skips backup verification.

Local Browser 0.4.7 / Workbench 0.5.9 passed both copied package qualification and the guarded actual-installation checks. The installed Browser uses its own bundled native resource path and the signed Workbench add-on. See the [measured release results](validation.md#bundled-native-windows-release-13-october-2026).

Packaging, native qualification, isolated desktop checks and actual installed acceptance are separate gates. Installer binaries, local signing keys, private receipts and profile backups remain local. Linux native execution and broader masking surfaces remain separate pending work. See [native scope](native-surface-policy.md) and the [completion checklist](research/completion-gates.md).
