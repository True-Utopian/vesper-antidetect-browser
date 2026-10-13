# Linux native packages and per-user installation

Vesper's Linux packaging path can build full amd64 Browser and Workbench packages from a qualified native Chromium runtime on Linux. These are source changes under qualification; **Linux native compilation, copied runtime, installed desktop integration and sandbox acceptance remain pending** until measured on Linux. Windows 0.4.7 / Workbench 0.5.10 acceptance remains separate.

## Building a native package

Use the pinned native build and its actual 26 unit executions and nine-case qualification receipts. Copy and qualify its complete runtime with `scripts/package-native-kernel.mjs`, then run these commands on the Linux build host:

```sh
xvfb-run -a node scripts/desktop-build.mjs browser linux --full --native-kernel-manifest /path/to/qualified-runtime/vesper-kernel.json
xvfb-run -a node scripts/desktop-build.mjs workbench linux --full --native-kernel-manifest /path/to/qualified-runtime/vesper-kernel.json
node scripts/workbench-plugin.mjs linux
```

The packager refuses another host platform/architecture, a light or directory-only request, a different Chromium revision, incomplete native cases and changed executable/library bytes. It runs fresh native qualification in each copied application runtime before producing the packages. One native binary serves the standard Chromium mode and the explicitly selected Vesper native policies; a second browser download is not needed for a full native Linux package. Existing profile engine choices are preserved. Building from source still requires the Chromium toolchain; end users use compiled packages.

The outputs include an amd64 Debian package, a portable tar archive, the signed Workbench add-on, update signatures for the Debian installers and SHA256SUMS. Debian archive permissions retain both Electron and native-kernel executables, shared libraries and sandbox helpers. Structural checks are not runtime or sandbox acceptance.

## Portable per-user installer

The portable package contains `install.sh` and a file checksum manifest. Extract it into a fresh directory and run:

```sh
./install.sh
```

It verifies the package, copies the application into a new immutable version directory under `~/.local/share/vesper-apps`, verifies the copy and creates a launcher in `~/.local/bin` if none exists. Existing versions and launchers are preserved. Browser profiles, credentials, Workbench databases and archives are separate application data and are not copied, removed or overwritten by this installer. The application carries its own runtime; no operator-installed Node.js is required.

For an isolated installation without registering a launcher:

```sh
./install.sh --prefix /path/to/owned-installations --no-launcher
```

Checksums detect changed package bytes; they are not publisher authentication. Debian offline update signatures use the locally retained release key, and downloadable public releases remain unpublished. Portable installation does not grant root ownership to a sandbox helper or disable sandboxing. Actual namespace/seccomp behavior must pass on the target Linux system.

## Acceptance

Qualification must execute the installer, launch the installed applications, install and enable the signed Workbench add-on, verify the installed native runtime and sandbox, and save a Browser-owned native Workbench run. Restart and profile/archive preservation must pass in the installed store. Debian structure, a copied launcher, source CI or a development service alone cannot satisfy the native Linux release gate. A per-user portable installation is qualified independently of a privileged Debian package-manager installation; report which method was actually tested.
