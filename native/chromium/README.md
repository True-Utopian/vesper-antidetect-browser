# Vesper native kernel by true-utopian

This directory contains original changes to the pinned open-source Chromium revision in `kernel.json`. Vendor binaries, proprietary patches and vendor profile formats are not part of the kernel.

The scalar patch adds immutable launch policies for hardware concurrency and device-memory buckets, including the browser's device-memory HTTP client hint. The canvas patch adds a profile seed to native RGBA8 canvas readback and export paths. Each profile must own a separate browser process. The process switches are configuration, not a JavaScript injection layer.

Source preparation, compilation, native unit tests and browser qualification are separate milestones. A source patch that applies cleanly is not a compiled or qualified engine. Browser uses the existing Chromium/Brave engine implementation until a new kernel passes qualification and integration.

## Windows build

Use a short checkout path without spaces, such as `C:\vesper-kernel`. Install official `depot_tools` in its `depot_tools` subdirectory and the exact Chromium commit in `src`. Use the official [Windows build instructions](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/docs/windows_build_instructions.md) for initial setup. The current pin needs Visual Studio 2026 C++ Build Tools with MFC/ATL, SDK 28000.2270 and its debugging tools.

Run these commands from the Vesper source directory:

```powershell
./scripts/build-native-kernel.ps1 -Stage Doctor
./scripts/build-native-kernel.ps1 -Stage Sync -Jobs 4
./scripts/build-native-kernel.ps1 -Stage Patch
./scripts/build-native-kernel.ps1 -Stage Generate
./scripts/build-native-kernel.ps1 -Stage Build -Jobs 2 -Targets chrome,blink_common_unittests,blink_platform_unittests
./scripts/build-native-kernel.ps1 -Stage Test
npm run build
node scripts/qualify-native-kernel.mjs --executable C:/vesper-kernel/src/out/Vesper/chrome.exe
```

The helper checks the pin, applies each original patch only when needed, and never resets an existing checkout or deletes files to make room. GN uses a component build, no symbols, no PGO and local compilation. These settings reduce development build cost; they are not a production performance claim. Reports and logs stay in the private `.workbench/kernel-toolchain` and `test-results/native-kernel` directories.

Native scalar unit tests live in `blink_common_unittests`; canvas unit tests live in `blink_platform_unittests`. Build those targets and run their `Vesper*` filters before accepting an engine. Run the existing approximated-memory regression tests without Vesper switches. Browser qualification launches the candidate directly, with no CDP environment overrides. It checks first-script page/worker values, HTTP client hints, repeated/cropped canvas reads, independently decoded PNG exports, process restart stability, differing seeds and malformed-switch fallback.

## Boundaries

The development Browser API adds `POST /api/v1/engine/native/stage` with an `executablePath`, and `family: "vesper"` for qualification and activation. Activation runs the direct native gate again, requires all profiles stopped and unleased, and preserves their archives. Every launch checks the selected executable and component DLL/resource inventory. Native CPU policy does not use the CDP CPU override; locale and timezone still use the existing target controller.

Vesper profiles accept desktop `environment.deviceMemory` buckets 2, 4, 8, 16 and 32. Standard protection enables the native RGBA8 canvas seed, stored inside the profile browser directory so export/import and restart preserve its identity. Off disables canvas changes while retaining explicitly requested CPU/memory policy. Fresh profiles get independent seeds. The desktop editor and Inspect automation expose these options; the engine requires a qualified native runtime before launch.

`scripts/package-native-kernel.mjs` consumes the compiled output and its `gn desc out/Vesper //chrome:chrome runtime_deps` list. It requires successful native unit-test records, copies only runtime files into a new local release directory, and repeats the native proof on the copied executable before writing a qualified runtime manifest. It does not overwrite a prior runtime or change the installed app.

The Windows kernel passed native compilation, 26 unit executions, nine direct and copied-runtime cases, guarded activation and installed Browser–Workbench integration. See the [qualification record](../../docs/native-kernel-qualification.md). The original C++ policy is intended to be portable to Linux; a Linux kernel binary must pass a separate native Linux build and the same browser gate. Existing Linux desktop packages do not imply a Linux kernel build has been verified.

The 12 October build exposed a checked-span type mismatch in canvas readback. The original patch now passes explicit `size_t` lengths. Both the complete browser and native test targets subsequently compiled and passed their runtime gates on 13 October.

End users install compiled browser files, not this source checkout. The current local Windows Browser 0.4.6 full installer includes upstream Chromium. The large Chromium development checkout is needed only to build the original native kernel. The separately qualified custom runtime is now activated locally for Vesper profiles; shipping it inside a new installer remains a separate packaging task.

For an independently prepared Linux host, `bash scripts/build-native-kernel.sh <Stage> <checkout> <jobs>` provides the same five stages. It installs no system packages. The Linux host prerequisites remain those in Chromium's pinned Linux build instructions. An isolated Linux worker is compiling the four patches; Linux native runtime and installer qualification remain pending.

RGBA8 Canvas2D is the initial canvas scope. Float16, WebGL, audio, fonts, media identities, user-agent/client-hint personas and networking policies need their own coherent implementations and measurements. Qualification records these limits explicitly.

A subsequent source review found that the earlier export hooks also transformed GPU-canvas exports, although GPU `readPixels` is outside the implemented scope. The original scope correction is now applied, compiled and qualified: both WebGL versions retain pixel/export agreement in the direct and copied-runtime fixtures. The surface-policy patch adds the bounded WebGL, offline-audio and local-font controls described in the qualification record.
