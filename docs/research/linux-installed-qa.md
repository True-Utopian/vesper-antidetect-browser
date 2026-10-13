# Linux installed-pair qualification inventory

This inventory is prepared for the isolated non-root Linux build account. It is not a passing runtime receipt.

| Claim | Functional check | Visual evidence / limit |
| --- | --- | --- |
| Compiled applications install per user | Execute both portable installers into new version directories; verify installed native component hashes and executable permissions | Debian installation is separate; no privileged package-manager installation is claimed |
| Browser owns the native engine | Run all nine fresh installed native cases, back up a stopped owned profile before activation and retain its settings | Inspect the installed Browser manager and original moth branding at launch size |
| Signed Workbench integrates with Browser | Verify local signatures, install the add-on in the owned store and confirm both API versions | Use normal Add-ons/Workbench controls and inspect the native embedded view |
| Native automation saves correctly | Verify page and extension-startup policies and checksum-verified archive through the installed services | Inspect the saved run in embedded Workbench |
| Native sandbox remains enabled | Inspect the installed browser's namespace and seccomp-BPF status | Never infer sandbox acceptance from a successful package build |
| State survives restart | Normal Quit, restart the installed Browser, retain the signed enabled add-on, original owned profile and saved run | Inspect the reopened manager and Workbench |
| Inspect remains a usable form | Select Inspect, review the 13 fields, exercise form/JSON/form and cancel using normal controls | Review the drawer, its scrolling fields and fixed footer at launch and a smaller native window size |
| Failure boundaries preserve data | A changed package is refused; an existing version is retained; wrong host or incomplete native evidence cannot bundle | These are source/installer checks, separate from vendor feature parity |

The runtime helper retains its owned installation and asks for separate user-control and screenshot review before its final receipt can pass. Explore at least the cancelled Inspect path and disabled/reenabled Workbench behavior in the idle owned store. Record visible clipping, errors, incorrect bounds or failed controls as failures; document-level dimensions alone cannot sign off the UI.

All source and package checks, copied runtime cases, actual installer execution, native sandbox and installed integration must pass before marking Native Linux runtime verified. Never copy Windows profiles, credentials, release keys or raw vendor research to the build account.

On the GPU-less qualification server, the default headed backend failed to create either WebGL context. A separate owned diagnostic confirmed both contexts with ANGLE SwiftShader. The installed helper's explicit `--software-graphics` mode sets `VESPER_GRAPHICS_BACKEND=software`; the runtime adds only `--use-gl=angle --use-angle=swiftshader` on Linux. This uses software rendering, retains namespace/seccomp sandbox checks and runs the unchanged strict surface assertions. It does not qualify hardware GPU behavior or conceal the software renderer. Desktop users keep the native default unless they opt in.
