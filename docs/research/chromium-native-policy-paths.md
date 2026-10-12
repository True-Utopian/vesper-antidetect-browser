# Chromium native scalar policy paths

Author: true-utopian. Source inspected: Chromium commit `4afca57b57f531a92ffc15af0ffb5cf0038fb273`, version `157.0.8100.0`. This is an original source-based Vesper implementation proposal, separate from the vendor artifact findings. REA's skill routes complete source-repository analysis to ordinary repository tools; no new vendor analysis was needed here.

The source checkout at `C:/vesper-kernel/src` was read without modification. `native/chromium/patches/0001-native-scalars.patch` was generated from in-memory copies. Static source inspection and a successful `git apply --check` establish the patch's integration locations, **not successful compilation or browser execution**.

## Source observations

| Question | Exact pinned source path and observed behavior | Status |
| --- | --- | --- |
| CPU getter | [`navigator_concurrent_hardware.cc`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/third_party/blink/renderer/core/frame/navigator_concurrent_hardware.cc) returns `base::SysInfo::NumberOfProcessors()` converted to unsigned. | Answered statically |
| Page and worker sharing | [`navigator_base.h`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/third_party/blink/renderer/core/execution_context/navigator_base.h) inherits the CPU and device-memory mixins. [`worker_navigator.h`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/third_party/blink/renderer/core/workers/worker_navigator.h) inherits NavigatorBase; [`worker_navigator.idl`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/third_party/blink/renderer/core/workers/worker_navigator.idl) includes both mixins. | Answered statically |
| Inspector priority | [`navigator_base.cc`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/third_party/blink/renderer/core/execution_context/navigator_base.cc) calls the shared CPU getter and then `ApplyHardwareConcurrencyOverride`. An active DevTools override can supersede the proposed native value. | Answered statically |
| Memory getter | [`navigator_device_memory.cc`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/third_party/blink/renderer/core/frame/navigator_device_memory.cc) delegates to ApproximatedDeviceMemory. Its [`IDL`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/third_party/blink/renderer/core/frame/navigator_device_memory.idl) preserves a secure-context requirement. | Answered statically |
| Current memory buckets | [`approximated_device_memory.cc`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/third_party/blink/common/device_memory/approximated_device_memory.cc) rounds physical memory to a power of two and clamps desktop to 2–32 GiB, Android to 1–8 GiB. Older 0.25–8 assumptions do not match this commit. | Answered statically |
| HTTP memory coherence | [`client_hints.cc`, AddDeviceMemoryHeader](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/content/browser/client_hints/client_hints.cc) reads the same ApproximatedDeviceMemory getter in the browser process. Changing only NavigatorDeviceMemory would leave an inconsistent HTTP hint. | Answered statically |
| Browser-to-renderer propagation | [`render_process_host_impl.cc`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/content/browser/renderer_host/render_process_host_impl.cc) builds renderer command lines and calls the embedder's AppendExtraCommandLineSwitches. [`chrome_content_browser_client.cc`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/chrome/browser/chrome_content_browser_client.cc) has a renderer-only CopySwitchesFrom allowlist. | Answered statically; real worker launches untested |

## Original patch contract

Each Vesper profile must own a distinct browser process and user-data directory. One immutable policy belongs to that browser and its renderer processes; this is not a policy transport for several different profiles sharing one browser process. Worker threads naturally read the renderer's native process policy through their shared navigator getters. Newly spawned worker renderers must receive the same switches through Chrome's renderer allowlist.

| Switch | Canonical values | Behavior |
| --- | --- | --- |
| `--vesper-hardware-concurrency` | Decimal integer 1–1024, without leading zeroes, signs or whitespace | Shared native CPU getter returns the policy value; missing or invalid input uses Chromium's existing CPU getter. |
| `--vesper-device-memory` | Desktop: `2`, `4`, `8`, `16`, `32`; Android: `1`, `2`, `4`, `8` | Shared approximated-memory getter returns the policy value in browser and renderer processes; missing or invalid input uses existing native approximation. |
| `--vesper-canvas-seed` | Canvas patch owns its validation and implementation | Included only in renderer propagation here; scalar patch does not interpret this field. |

The host must reject invalid explicit profile values before launching. Native fallback provides safe default behavior for absent or malformed switches; it must not hide a failed host validation. Profile values remain stable for a browser-process lifetime. Updating scalar values requires stopping and relaunching the profile.

The header-only `blink/public/common/device_memory/vesper_native_scalar_policy.h` parses the process command line once through thread-safe C++ static initialization. `Get()` returns a const policy containing optional unsigned CPU and float memory values. Local `Parse(command_line)` exists for tests; getters consume only the immutable process policy. Parsing one invalid field does not discard a different valid field. This adds no JavaScript injection, CDP dependency, Mojo schema change, or vendor source.

The seven patch files are:

1. `chrome/browser/chrome_content_browser_client.cc`: propagate the three exact Vesper switch names to renderers.
2. `third_party/blink/public/common/device_memory/vesper_native_scalar_policy.h`: original immutable parser and process policy.
3. `third_party/blink/public/common/BUILD.gn`: declare that public header.
4. `third_party/blink/renderer/core/frame/navigator_concurrent_hardware.cc`: apply native CPU policy before existing fallback.
5. `third_party/blink/common/device_memory/approximated_device_memory.cc`: apply native memory policy in the shared browser/renderer getter.
6. `third_party/blink/common/device_memory/vesper_native_scalar_policy_unittest.cc`: eight original native unit tests.
7. `third_party/blink/common/BUILD.gn`: add those tests to `blink_common_unittests`.

Neither renderer/platform GN nor canvas helper files are modified, keeping the canvas patch independent.

## Language paths and recommendation

Language needs its own coherent policy rather than an extra navigator string override. [`renderer_preferences_util.cc`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/chrome/browser/renderer_preferences_util.cc) derives renderer `accept_languages` from the profile's language preference. [`Navigator::GetAcceptLanguages`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/third_party/blink/renderer/core/frame/navigator.cc) reads page settings; [`WebViewImpl::UpdateRendererPreferences`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/third_party/blink/renderer/core/exported/web_view_impl.cc) updates those settings when renderer preferences change.

[`WorkerNavigator`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/third_party/blink/renderer/core/workers/worker_navigator.cc) reads WorkerOrWorkletGlobalScope's fetch context. [`DedicatedOrSharedWorkerGlobalScopeContextImpl`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/third_party/blink/renderer/platform/loader/fetch/url_loader/dedicated_or_shared_worker_global_scope_context_impl.cc) and [`WebServiceWorkerFetchContextImpl`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/third_party/blink/renderer/modules/service_worker/web_service_worker_fetch_context_impl.cc) return renderer-preference accept languages and notify registered watchers when they change. WorkerNavigator invalidates its cached languages and dispatches `languagechange`.

[`navigator_language.cc`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/third_party/blink/renderer/core/frame/navigator_language.cc) sanitizes comma-separated languages, handles inspector accept-language overrides, and reduces the exposed list to its first entry when ReduceAcceptLanguage is enabled. Preserve these paths. Set a validated per-profile BCP47 language list at the browser preference/network boundary, then verify network Accept-Language, window and all worker navigator languages, and Intl locale separately. A UI locale switch alone is not evidence that these surfaces agree. This patch does not implement language policy.

## Validation and remaining proof

Performed: source revision checked with `git rev-parse HEAD`; original new C++ files formatted with the checkout's clang-format; read-only `git apply --check` passed against the exact pinned checkout. No native source files were changed in the checkout, and no native compilation or browser execution is claimed.

After dependencies and toolchain are ready, build `chrome` and `blink_common_unittests`. Run `blink_common_unittests.exe --gtest_filter=VesperNativeScalarPolicyTest.*` both without switches and with `--vesper-hardware-concurrency=3 --vesper-device-memory=4`. The launch-policy test exercises the actual shared approximated-memory getter, not a duplicated implementation. The parser tests cover missing fields, CPU boundaries and malformed/overflow input, current platform buckets, malformed memory strings, other-platform buckets and independent field failure. Run the existing approximated-memory tests without policy switches because those tests deliberately change physical-memory inputs.

Existing regression suites provide complementary checks: [`device-memory.https.any.js`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/third_party/blink/web_tests/external/wpt/device-memory/device-memory.https.any.js), [`WorkerNavigator-hardware-concurrency.any.js`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/third_party/blink/web_tests/external/wpt/workers/WorkerNavigator-hardware-concurrency.any.js), and [`worker_navigator_language.html`](https://chromium.googlesource.com/chromium/src/+/4afca57b57f531a92ffc15af0ffb5cf0038fb273/third_party/blink/web_tests/navigator_language/worker_navigator_language.html). The first two check generic API properties; they do not prove propagation of a specific Vesper profile value. Chrome's switch propagation is not automatically present in content_shell.

Required browser proof: launch the newly built Chrome with those scalar switches and a fresh isolated test directory; check exact values in a secure window, same-origin and cross-origin frames, dedicated worker, shared worker and service worker, including a worker created after a renderer restart. Request `Accept-CH: Sec-CH-Device-Memory` from a secure test server, then verify the subsequent request's hint equals the configured memory. Include reload/restart stability, independent simultaneous profiles with different values, and malformed-switch native fallback. Run this without any CDP CPU override or init script; inspect own property descriptors/prototypes to preserve the native API surface.

Unresolved until those checks run: build compatibility, actual cross-process worker propagation, HTTP hint delivery under browser permissions and origin policy, and runtime performance. This limited patch changes reported native navigator/client-hint scalars; it does not change the browser's actual thread count, physical-memory behavior, other hardware APIs, network fingerprint, WebGL, audio, fonts, or fingerprint protection enforcement generally.
