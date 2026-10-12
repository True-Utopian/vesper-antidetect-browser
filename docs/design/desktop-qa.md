# Desktop acceptance inventory

By true-utopian. This inventory records checks to run; a check is not passed until evidence is captured.

The installed Windows release passed the core execution, archive, restart, Python API discovery and installer retention checks in [the validation record](../validation.md). Both uninstallers returned exit code 0 and preserved profile manifests, exports and the database. Linux package structure passed; Linux execution remains unqualified. Controls such as tray restoration and every startup failure branch still require broader qualification; this inventory does not imply they have all passed.

| Claim / control | Functional check | Visual state / evidence |
| --- | --- | --- |
| Separate Browser and Workbench applications | Launch both executables with one isolated data root; compare Browser owner PID and ports | Each native window title and author lockup |
| No installed Node.js required | Launch packaged executables and their Electron Node-mode service children | Native workspace opens without token prompt |
| Private automatic desktop authentication | Renderer has no Node API; token absent from URLs and browser storage; authenticated API works | Unlocked workspace |
| Browser create / edit / open / stop / duplicate | Use controls, confirm settings and persisted storage | Populated profile table, editor, running and stopped states |
| Shared run ownership | Start Workbench run, see it in Browser, confirm manager cannot stop it | Browser automation-owner label and disabled controls |
| Automation controls and export | Inspect local fixture, finish and verify archive hash; test cancellation | Run details, saved archive, cancelled run |
| Window lifecycle | Close window, reopen from tray, confirm service remains; explicit quit drains Workbench | Native window and tray menu |
| First-run engine setup | Light installer exposes engine installation; full Windows installer launches bundled engine | Setup notice / ready state |
| Installer data retention | Silent isolated-directory install, launch, uninstall; keep private profile store | Installer/uninstaller result and retained manifest |
| Linux installer structure | Decode ar container; check control, desktop entry, ELF executable and executable/setuid modes | Package manifest and checksums; native execution pending |
| Failure cases | Occupied default port must not be killed; incompatible discovery must fail without adopting unrelated service | Clear startup error / logs |
| Layout | Inspect native launch size, 800px and 680px sizes, focus/overflow | Screenshots with no horizontal clipping |

Shell uses the existing original V mark, iris #4a4e87, slate #edf0f5 and restrained operational tables. Typography follows the installed system UI family. Application menus use platform-native conventions. No new decorative dashboard or copied vendor artwork is introduced.
