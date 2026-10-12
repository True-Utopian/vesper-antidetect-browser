# Multilogin and Dolphin: native engine follow-up

Research date: 11 October 2026. By **true-utopian**. This pass uses the pinned REA 6.3.0 workflow, retained canonical evidence, focused new semantic traces and read-only inspection of installed binary artifacts. It does not launch a vendor browser, inspect user profiles, read credentials, modify either vendor application or add vendor code to Vesper.

The central result is a boundary, not a recovered masking engine: **none of the fingerprint fields below has been traced end to end from a vendor profile setting to a native enforcement point in this evidence**. Multilogin has separately installed browser artifacts that need their own analysis; Dolphin's inspected desktop shell imports a separately obtained local API module. A launcher response, a UI field or a file named after a browser cannot establish native masking.

## Questions and present answers

| Question | Status | Evidence needed to close the gap |
| --- | --- | --- |
| Is the Multilogin CLI itself the browser fingerprint engine? | Partially answered: decoded code builds a launcher request; actual browser enforcement is unresolved | Resolve launcher dispatch, then identify the selected adapter and browser inputs |
| Are independent Multilogin browser artifacts installed locally? | Answered for file identities and PE classification | Runtime selection and loaded-module observation remain separate questions |
| Does Dolphin's desktop shell contain the full local API and native engine? | Partially answered: packaged syntax delegates to an imported local API module | Identify that module and any browser payload independently |
| Which canvas, graphics, audio, font or navigator controls reach a native kernel? | Unresolved for both products | A source-bound producer-to-consumer trace and controlled browser observations |
| Do advertised values stay consistent across targets and restarts? | Unresolved | Owned synthetic profiles, a multi-target probe and repeated lifecycle tests |

## Multilogin: separate identities matter

The existing [native findings](multilogin-native-findings.md) establish two bounded native paths in `xcli.exe`, SHA-256 `74fd4e60a539f55f44bd5899835eda27128f02d547946311dd46a53f6173e4d4`:

- REA `ev_1eec9fb85e164c05b32bbe618f930a5f31227904b4b34f4634ea4fa168b23e08` decodes the profile-start function candidate at `0x14065d200` and its direct call at `0x14065d602` to a response-wrapper candidate at `0x14056e860`.
- REA `ev_67664a8ffcea0cc38b7a5023543c0e8890ef62b5dacc6bebb59a203a0b5c173f` decodes a request builder at `0x14056d5e0`: a GET start request with folder/profile identifiers, optional automation/headless/window parameters and a strict-mode header.
- REA `ev_63e679939f32e890d535357cbe4042d0e37f6a6e38bb6c2a7ae9d786270a246b` leaves the wrapper's interface-dispatched destination unresolved. It does not establish the complete request path, a child process or browser settings applied by that child.

Those start parameters are lifecycle controls. They are not a canvas seed, font inventory, audio policy or graphics configuration. No conclusion about such values follows from this CLI trace.

A follow-up inspects three separate files in the installed `mlx/deps/mimic_154.2` distribution. The folder name is an inventory label, not independent proof of the running browser version or a patch level.

| Artifact | Bytes | SHA-256 | New REA evidence |
| --- | ---: | --- | --- |
| `adapter.exe` | 50,843,896 | `d8ee8b75cc15aac0f21bb74e5325e263462468d3924c0e0fb217dad5ece16150` | `ev_64360b2625f06276c435b6409dc17126ce976a4622236544051c14f0f4ee3814` |
| `chrome.exe` | 4,486,352 | `f629aff195af261dd15aed08492d4b67a6441f66c1bcca9d91584d4ac39544cb` | `ev_55db928c57b0bad7e3c39dc94c0d7ead5cf19ec1fb10fd44ea0a5dc0a04fde5e` |
| `chrome.dll` | 313,048,784 | `e4ebc500dc0f61496dd9db2b5e9d821649312c36966f8815c53fdcd9f6363898` | `ev_d38ffe8535cc4474e92064c8704e78f6f923656e1fa5835b596c5f66d4816ce0` |

REA identifies each as x86-64 PE32+ with no CLR directory; managed metadata/CIL is unavailable. This classification is not a recovered implementation, source-language determination or proof that a particular fingerprint surface resides in one of these files. The adapter, loader executable and large library must be treated as separate targets, with digest-matched evidence for any claimed handoff.

A new completed Ghidra 12.1.4 literal search on the exact `chrome.exe` digest observes `chrome.dll` at `0x14036aa18`, Evidence `ev_09a3e4df1897a2db4e04a60cea956c76d921d04f49b8a5998c4f7bc8cf3aab1a`. That is a string location, not an executable function address, loaded-module observation or native call edge. The provider also explicitly excludes DLL targets from its current Windows P0 native-analysis admission. A subsequent cross-reference attempt would require a fresh import after the first ephemeral session closed; it was stopped before producing evidence to avoid repeating a heavy import solely for this marker. The library load edge and any graphics-policy consumer remain unresolved.

## Dolphin: downloaded local API is another boundary

The retained ASAR identity is `74167cef583eb91d284a9d4001cba367b8f3585a2c19a2562baea86059d16d54`. Its `js_dist/background.js` member is SHA-256 `03f5c7d030df6b636652adab365ea5c8fb19ef8f3c2e680c3c3f69e8a95ac466`. The [earlier desktop report](dolphin-desktop-findings.md) establishes the Electron shell and a packaged `downloadLocalApi` listener, while retaining unresolved external bindings.

This pass reuses bounded parent Evidence `ev_83aaf6c122dd6c2b71e32b138dfe74147e120e71591a85d88278c4ab694290f4` rather than repeating the full installer analysis. Its semantic graph is not truncated, but its overall coverage is **unknown**, and individual relation families remain partial. Exact node selection avoids mistaking a failed generic property/literal query for absence of a feature.

| Focused query | REA evidence | Result |
| --- | --- | --- |
| Exact `localApiPort` read, forward influence | `ev_f7636d269fad08aad8e6e8ccc6fb3c8ba48ca0c088f8b20222a9bd7d4ddb52de` | One matched node, zero traversed relations, one relevant unresolved fact |
| Same read, backward provenance | `ev_8a3444b3c52181b8143ededfe726177620ebbd70e91af1214027bd252f65b14d` | One matched node, zero traversed relations, one relevant unresolved fact |
| Exact download listener, ownership | `ev_ddff8037dfaa8dc4c28181c3613d3c60de62670f45d3e8e69951258f94237f46` | One matched listener; no ownership traversal into a local API or native browser |

Supplemental inert AST inspection verifies the parent member digest and records source offsets and range hashes privately. It observes a computed dynamic import at offsets `1,161,649–1,161,659`, `dist`/`main.js` path components in the same containing function, and reads of `globalThis.localApiPort`. **Analyst interpretation:** the shell expects a separately supplied JavaScript local API entry, then waits for a port published by its integration. This does not establish successful execution, the imported module's identity, a separate process, a native binding or the browser kernel it may eventually start. It corrects the stronger assumption that “local API” automatically means a native fingerprinting binary.

No native Dolphin browser payload was identified in the retained extracted desktop target, which contains the desktop executable and its ASAR rather than an exhaustive installed-runtime inventory. That bounded result is not a claim that Dolphin has no native browser: the shell's separate download/import boundary is precisely where additional artifact identity is needed.

## Fingerprint contract versus enforcement evidence

Multilogin's current official guide describes coordinated navigator fields; separate graphics metadata and graphics read-out policies; persistent noise options whose final results can still depend on host hardware; and distinct network/location controls. These are documented product semantics, not REA verification of their implementation. [Multilogin fingerprint settings](https://multilogin.com/help/en_US/browser-profile-setup/profile-settings-fingerprint-section).

Dolphin's guide advertises browser/device controls and constrained hardware combinations across editing, import and templates. The guide does not disclose a validated UI-to-kernel call chain. [Dolphin fingerprint settings](https://docs.dolphin-anty.com/en/working-with-fingerprints/digital-fingerprint-and-profile-settings-in-dolphin-anty).

| Surface | Native enforcement established by this pass? | Minimum independent acceptance target |
| --- | --- | --- |
| Navigator, user agent and client hints | No | Browser version, headers, document and worker values agree under the declared policy |
| Canvas, WebGL/WebGPU and audio | No | Measure output at actual read-out APIs, document/frame/worker contexts and repeated lifecycle points; distinguish metadata from rendering |
| Fonts and media devices | No | Qualify enumeration, text measurements and permission-dependent behavior rather than a single hash |
| Screen, locale and timezone | No vendor native path | Verify first navigation, new targets, frame contexts and restarts; make host constraints visible |
| Proxy, DNS and WebRTC | No vendor native path | Observe owned destination traffic, unavailable-upstream behavior and supported transports; an IP label is insufficient |

## Original Vesper implementation recommendations

1. Keep profile management and the automation plugin separate from the browser enforcement contract. A profile should select a versioned engine policy with an explicit capability report. A successful launch must not imply all requested surfaces were applied.
2. Preserve the current honest capability boundary: Vesper's Chromium/CDP policy implementation declares no masking engine and incomplete worker qualification. Optional upstream Brave is a separately versioned privacy engine, not proof of vendor parity. Reject unsupported controls instead of storing successful-looking settings that do nothing.
3. Prefer coherent policies over random independent values. Validate browser/header/client-hint relationships and permitted hardware combinations as constraints. Report which values remain native to the host; do not invent a fake rendering stack by changing only a vendor string.
4. Qualify original engine behavior with owned test pages before adding more UI toggles. Include initial inline scripts, same-origin and cross-origin frames, dedicated/shared/service workers, offscreen rendering, new tabs, profile restart, and imported profiles. Record engine digest/version, policy revision and target coverage alongside results.
5. If original native engine changes become necessary, develop them against an auditable open-source browser upstream. Keep policy transport, validation and browser consumers traceable and tested. No vendor executable, patched kernel, proprietary configuration corpus or copied decompiler implementation should enter a Vesper release.
6. For further vendor research, follow one non-secret synthetic setting from its producer to serialization, launch input and native consumer, then compare a controlled observation. Resolve Multilogin's launcher/adapter dispatch and identify Dolphin's imported module before widening kernel analysis. More strings or a larger graph cannot replace that missing handoff.

Private reproductions and complete evidence from this pass use the prefix `.workbench/research/vendor-native-followup-*`. Vendor implementation-bearing evidence stays in ignored local storage. This document records observations, remaining gaps and independently chosen requirements; it is not a claim of full reverse engineering or superiority.
