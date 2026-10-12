# Kameleo engine and fingerprint boundary follow-up

Research date: 11 October 2026. This local, execution-free follow-up reuses REA 6.3.0 evidence and adds a focused managed/native declaration inspection. It establishes a configuration-building and launch boundary in one installed Chroma kernel. Native configuration consumption and fingerprint enforcement remain unresolved.

No vendor application or browser was launched, no account/profile data was read, and no vendor implementation, configuration key, or encrypted payload was copied into Vesper. Temporary research helpers and raw results remain under the ignored `.workbench/research` directory.

## Exact artifacts

| Artifact | Bytes | SHA-256 | Evidence scope |
| --- | ---: | --- | --- |
| `Kameleo.Engine.exe` | 115,270,256 | `273c70a42294b951ea83ed980f6333e4569bb11224631a0c4dc236fa4984a9fa` | Existing REA PE/managed classification |
| Chroma 151 interactor DLL | 4,477,440 | `a5b22721d7a198c821aba7ee9f40b0ccea5ce246d0b5add903633ed71fd2f310` | Existing REA CIL evidence; new native-boundary declarations |
| Chroma 151 `browser/chrome.exe` | 3,869,184 | `4c24fccc7df020b41ee564daa4eca5744901e5480182cf92dbb9642d1f8cd87a` | Supplemental read-only PE identity and bounded marker search |
| Chroma 151 `browser/chrome.dll` | 334,254,592 | `42a47e8fd46b0a841be9aca4041c4c92ea1820cd8048614ac4f8130adbce56cf` | Supplemental read-only PE identity and bounded marker search |

The selected kernel is installed under `%APPDATA%/Kameleo/Kernels/chroma-151-win-x64-2026_07_30T12_05`. Its managed interactor and supporting libraries are beside a separate `browser` directory containing native browser artifacts. Other installed kernel-directory names include Chroma 150, 152 and 153 and Junglefox 153. Directory presence does not establish which kernel an active profile uses.

The engine PE has no CLI directory: existing evidence `ev_e08ad9f4e45005941adc1dc0d24d4fa35a127292ac5140da6a70f764e4cb1db4`. This does not prove a particular native language or NativeAOT implementation. The selected interactor is managed CIL targeting .NET 8: metadata evidence `ev_016fae4e1a22b0e6e0d4d31d3fad7720545489be4e85ebf3b311bc9195719f91`.

All managed method/type tokens below are build-local and require the interactor hash above and MVID `1e881d08-e1f6-127a-fb1c-d5aaeed7e6dd`. They are not native addresses. The authoritative member/CIL evidence is `ev_a51305d192c92c85b9d26db2af1631a205006ce486bd29ab24899be50edbc9be`.

## Resolved managed configuration and launch anchors

The existing CIL evidence supports more than a list of settings names. It contains a call from the launch state-machine body into an options-building method, a call from that method into common spoofing-options preparation, and a later encrypted-file write sequence.

| Caller/body | File-backed body coordinate | Decoded call anchor | Established observation |
| --- | --- | --- | --- |
| `i.MoveNext`, `0x06000071` | File offset 14,404; IL size 4,237 | IL 1,197 → `0x0600003c` | Launch-state body calls the options-building method `e.g` |
| `e.g`, `0x0600003c` | File offset 8,440; IL size 1,913 | IL 19 → `0x06005195` | Options builder calls `SetCommonSpoofingOptions` |
| Same options builder | Same body | IL 1,896 → `0x0600002e`; 1,902 → `0x06005191`; 1,907 → `0x0a0000db` | Calls a string-valued property getter, `EncryptWithOptsKey`, then `WriteAllBytes` |
| Same launch-state body | Same body | IL 3,030 → `0x0a000184`; 3,037 → `0x0a000185`; 3,050 → `0x0a000186` | References setters named `ExecutablePath`, `IgnoreDefaultArgs`, and `Args` |
| Same launch-state body | Same body | IL 3,075 → `0x0a000189` | References `LaunchAsync` |

The options-builder body has decoded setters for Chroma-specific configuration in addition to its common-options call. `EncryptWithOptsKey` has a decoded one-string-parameter signature returning a byte array. These call anchors support an encrypted options-file handoff as a static interpretation. The exact filename, launch-switch text, selected runtime values, and the native reader of that file are not established here. No encryption key or payload was recovered.

These are ordered anchors in decoded method bodies, not proof that every launch branch traverses the same path. The state machine has conditional and asynchronous control flow. This pass does not establish all-path dominance, successful process creation, or native option consumption.

The selected bodies are file-backed, and the launch body records 1,250 decoded instructions with zero omitted instructions in that body. Whole-assembly member coverage remains partial; many generic signatures and obfuscated names remain unresolved.

## Fingerprint configuration coverage

| Surface group | REA metadata/call anchors | What is established | What remains unproved |
| --- | --- | --- | --- |
| Canvas, audio, WebGL/WebGL2 | Common setter `0x06005195`; setters `0x060051ba`, `0x060051b4`, `0x060051c6`, `0x060051c8`, `0x060051ca` | Configuration preparation for canvas/audio/WebGL properties and noise is present | Native rendering changes, deterministic behavior, readback consistency, frame/worker coverage |
| Hardware, screen, WebRTC, media devices | Common setters `0x060051bc`, `0x060051c4`, `0x060051cc`, `0x060051ce` | Related configuration fields and setter calls are present | Browser API enforcement, traffic routing, permission semantics, leak behavior |
| UA and client hints | Chroma model `0x0200001f`; UserAgent model `0x02000023`; Metadata model `0x02000020` | Reduced/full UA, brands, versions, platform, architecture, model, mobile, bitness and WOW64 metadata are represented | Headers/API agreement, high-entropy hint behavior, cross-context consistency |
| Language, timezone, fonts, speech | Chroma model setters in `e.g`; SpeechVoice model `0x02000022` | Options builder represents these settings and voice attributes | Actual locale/Intl behavior, installed-font exposure, voice enumeration coherence |
| WebGPU | Adapter model `0x02000024`; setter `0x06000096` | Block/vendor/architecture/device/description configuration is represented | Adapter limits, feature sets, renderer coherence, native enforcement |
| Memory, touch, battery, Bluetooth | Chroma setters `0x06000098`, `0x0600009a`, `0x060000a0`, `0x0600009e` | Model fields and configuration setter calls are present | API availability, value validity, events, mobile consistency |
| Device metrics and touch emulation | CDP request types `0x02000032`, `0x02000036`; state-machine body `0x0600007d` | Request models and setter calls cover viewport/screen/mobile metrics and touch | Which runtime path sends them, initial-navigation timing, effect on all contexts |
| Instrumentation | Common setters `0x060051d0`, `0x060051d2`, `0x060051d4` | Shadow-root/instrumentation configuration is represented | Native observation coverage, inspector accuracy, and production defaults |

This is a configuration-surface inventory, not a compatibility or anti-detection score. A declared `ProxyAuth` model establishes username/password field names, not credentials, proxy transport, DNS isolation or WebRTC routing. No field values from profiles were inspected.

## New REA managed/native declaration evidence

`inspect_managed_native_boundaries` was run once against the exact selected interactor. New evidence: `ev_fde32d748290920f26db72acf8c83b4a7b05f450238284707f1181cf585a5fa3`, private result `kameleo-native-engine-boundaries.json`.

The provider reports complete coverage for this narrow declaration inventory: three ModuleRefs, 149 P/Invoke declarations, and 293 non-IL/runtime boundary entries. The P/Invoke scopes are 146 SQLite imports, two `crypt32.dll` imports and one `kernel32.dll` import. The remaining 144 boundary entries are runtime-provided declarations. The CLI header is IL-only and has no ReadyToRun/native-header indicator.

Those counts do not describe fingerprint hooks. They establish managed import declarations and runtime-provided methods; they do not verify resolved native exports or executed calls. This distinguishes the managed interactor's utility/database boundaries from native browser rendering behavior.

## Native browser marker candidates

An original, supplemental read-only PE scanner hashed the explicit browser files, mapped raw offsets to sections and preferred image addresses, and searched only for Kameleo-prefixed ASCII markers. It found seven matches in `chrome.dll`, all in `.rdata`, and no such matches in `chrome.exe` within this ASCII search boundary. This scanner is analyst evidence, not a REA native disassembler result.

| Native DLL marker | File offset | Preferred PE address |
| --- | ---: | --- |
| `KameleoBattery` | 301,025,528 | `0x191f15ef8` |
| `KameleoNetworkInformation` | 301,025,544 | `0x191f15f08` |
| `KameleoDeviceMemory` | 301,025,576 | `0x191f15f28` |
| `KameleoScreenDetails` | 301,025,600 | `0x191f15f40` |
| `KameleoUserAgentClientHint` | 301,025,624 | `0x191f15f58` |
| `KameleoWebGPU` | 301,025,656 | `0x191f15f78` |
| `kameleo` | 308,978,163 | `0x1926ab7f3` |

These markers corroborate vendor-specific material in the native browser DLL and provide precise seeds for a future admitted native-provider investigation. They do not identify functions, runtime addresses, command-line parsers, configuration readers, or enforcement. The absence of ASCII matches in the launcher executable cannot be interpreted as absence of modified behavior.

Supplemental bounded decoding of the managed `#US` heap used existing REA `ldstr` anchors and the exact artifact hash. Selected launch/configuration strings were nonprintable/obfuscated or empty; this did not establish argument or file-path text. The result is retained without attempting to recover keys or execute a string-decoder method.

## Independent architecture consequences

Vesper needs an explicit browser-engine boundary, separate from its desktop UI and Workbench plugin. Engine packages should have immutable identities and declare their supported configuration surfaces. Profile configuration should compile into a validated launch plan; the launcher should report the exact engine identity and what it applied.

Capability reporting should distinguish configuration accepted, configuration applied, and behavior verified. Stock browser automation may provide UA, timezone or viewport controls, while native rendering/privacy features require separately implemented and tested engine support. A settings toggle or script injection must not be labeled equivalent to proven native masking.

The configuration writer and native reader should share an original versioned schema. Their compatibility, file lifecycle, process ownership and error reporting must be independently tested. A readable local configuration contract does not need the vendor's encryption scheme, keys or opaque format. Workbench should consume the Browser service's versioned profile/automation interfaces and remain optional.

A coherent test fixture should compare configured intent against observed surfaces across initial navigation, frames, dedicated/shared workers, service workers and headless mode. Rendering checks, client hints, WebGPU, memory, media, fonts, timezone and proxy routing need separate results. Performance superiority needs matched workload measurements rather than an inference from this architecture.

## Remaining research and reproduction

The next native questions are the option-file reader, its configuration validation, and cross-references to the seven DLL markers. Then each rendering/API surface needs controlled runtime tests on disposable owned fixtures. Engine-to-interactor dispatch, actual switch text, native DLL consumption, and kernel selection policy also remain open. The main engine and native browser machine code were not decompiled in this follow-up.

Private reproductions are `kameleo-native-engine-index.py`, `kameleo-native-engine-strings.py`, and `kameleo-native-kernel-markers.py`; their JSON outputs preserve source evidence, exact hashes, tokens, offsets and limits. They supplement rather than replace the original REA Evidence. The new REA declaration inspection can be reproduced with the pinned CLI against the same managed interactor, without launching it.

See [Kameleo desktop findings](kameleo-desktop-findings.md) for shell/engine lifecycle evidence and [Kameleo browser interaction boundary](kameleo-kernel-boundary.md) for the initial endpoint/CDP anchors. This pass advances the options-building/file/launch boundary and native search seeds; complete kernel behavior and fingerprint enforcement are still unresolved.
