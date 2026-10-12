# Multilogin native findings

This is a bounded, static investigation of installed Multilogin artifacts using REA 6.3.0. It supports independent architecture decisions for Vesper Browser and Vesper Workbench by true-utopian. It does not establish complete feature parity, browser fingerprint behavior, or a working replacement for the vendor's service.

No inspected executable was launched. The analysis did not inspect account profiles, credentials, or browser user data. Vendor executable bytes and decompiler output remain private research inputs; this document contains observations and evidence identifiers rather than vendor implementations.

## Artifact identity

| Artifact | Bytes | SHA-256 | Scope |
| --- | ---: | --- | --- |
| Installed desktop `Multilogin.exe` | 97,145,056 | `e650e479544cb8c4c4400b257b5cef437b64ddde46b534fa3fe263f0c64426c8` | Container and PE metadata |
| Installed CLI `xcli.exe` | 15,678,464 | `74fd4e60a539f55f44bd5899835eda27128f02d547946311dd46a53f6173e4d4` | Native overview, string search, supplemental Go metadata |

The desktop artifact inspection found a PE root with no extracted child artifacts and no reported integrity contradiction. Evidence: `ev_0975890c934a035cc7dd619926b878234f887d545ff5a8899dc1c54c41cda183`; inventory sub-evidence `ev_2a8b08e6768d5bb8ac1a6d3c7e6e43e2b93886a6af538fa59a679502b1caf750`.

The managed-artifact provider identified x86-64 PE metadata, nine sections, and no CLR directory. Managed CIL analysis was unavailable for this artifact. That observation does not identify its source language. Evidence: `ev_60909fa5e288bc156c9f2a3fa71028e61388ffafba8dec45125190ef03a18ae4`.

The desktop native overview exceeded its 330-second operation budget. It did not produce a trustworthy desktop function inventory. A smaller installed CLI artifact was selected for the native investigation; conclusions about that CLI must not be attributed to the desktop application or browser engine.

## What REA established for the CLI

The initial Ghidra 12.1 overview reported nine segments, 15,426 procedures, and 29,315 strings for the exact CLI digest above. Its code section begins at `0x140001000`. These are provider observations, not counts of product features. Evidence: `ev_867a06b87bca7e00cca68373ce3816121dbf0fb892edbf990dca7c7f9953cc42`.

A procedure-name search for `proxy|profile|launch` returned no matches. That search is not evidence that those functions are absent. The Go runtime analysis reported an unsupported or untested Go 1.26.5 version and did not recover useful Go names; a later checksum-verified Ghidra 12.1.4 build also reported that version limitation. The older procedure-search evidence is `ev_481ce9e68f913d6102e846389f9b553c0835a3017dad64ed35dff4017d68e070`.

REA's literal `StartBrowserProfile` trace returned 12 string matches, including generated launcher-client method names and response types. It returned no references, was not truncated, and supplied no native call path. Evidence: `ev_35b3e738fa764c37e0bcd6d81b61930cdcda494947c60c2f3554bc02c95b61cb`.

Examples are the launcher-client name string at `0x140985a99` and request-builder name string at `0x1409872ee`. These are addresses of string data. Treating them as executable function addresses would be incorrect.

## Supplemental Go metadata recovery

An original, private, read-only metadata reader was written to recover bounded function-entry candidates from this CLI's Go table. This is **analyst-derived metadata**, outside REA's provider evidence. It does not alter or execute the binary, and it is not part of the Vesper product.

The reader checks the exact SHA-256, PE32+ sections and file mappings, table offsets, monotonic entry offsets, function metadata offsets, bounded UTF-8 names, and that every recovered code entry maps to file-backed `.text`. It validates 17,193 entries before retaining 115 names relevant to profile, launcher, proxy, command, and REA-observed call questions. It does not retain vendor instructions or reconstructed function implementations.

The candidate Go header is at file offset `9,219,264`, with magic `0xfffffff1`, pointer size 8, 17,193 functions, and 1,193 files. The encoded `textStart` is zero. The Go standard library's parser permits an externally supplied text base for an unrelocated table; this reader uses the PE `.text` virtual start, `0x140001000`, as a candidate base. Therefore the name-to-entry association still requires native decoding or cross-reference confirmation. [Go's official table parser](https://go.dev/src/debug/gosym/pclntab.go).

| Metadata name suffix | Candidate code entry | File offset | Research question |
| --- | --- | ---: | --- |
| `startProfile.StartProfile` | `0x14065d200` | 6,670,336 | Which client and request fields does the CLI use? |
| `launcherapi.(*Client).StartBrowserProfile` | `0x1405571e0` | 5,597,152 | Does the client call the recovered request builder? |
| `launcherapi.NewStartBrowserProfileRequest` | `0x140560900` | 5,635,840 | Which URL, method, and parameter transformation are visible? |
| `launcherapi_v2.(*Client).StartBrowserProfileV2` | `0x14056cee0` | 5,686,496 | How does the second launcher interface differ? |
| `stopProfile.StopProfile` | `0x14065dbc0` | 6,672,832 | What does shutdown request and report? |
| `mobileProfilesProxyCheck.CheckProxy` | `0x140642d00` | 6,562,560 | Is this a proxy service call or browser transport configuration? |

Private reproducibility inputs are `.workbench/research/multilogin-go-table-candidates.py` and its JSON output. The JSON labels the text base as requiring REA validation. A following table entry is a metadata boundary, not proof of a complete function body.

## Native validation of the profile-start command

The newer Ghidra 12.1.4 overview is retained as evidence `ev_a4faaac74e387c6f58bc245dc37953dc69162d696945643fc67564e772bceb5e`. REA successfully decoded the candidate `0x14065d200` into an actual function with 1,751 body bytes across two ranges. It found an incoming unconditional call at `0x14065d1a5`, inside the function at `0x14065d040`. The supplemental metadata associates that caller with the profile-start command callback, and the decoded callee with `StartProfile`. These associations are analyst interpretations; the provider reports generic `FUN_...` names. Function evidence: `ev_1eec9fb85e164c05b32bbe618f930a5f31227904b4b34f4634ea4fa168b23e08`.

That native body contains a direct call at `0x14065d602` to the decoded function at `0x14056e860`. The independently recovered metadata associates its destination with the V2 launcher response wrapper. A later branch at `0x14065d6a0` compares a returned status field against 200. These are actual decoded call and comparison instructions, rather than string matches.

Other observed direct-call destinations map, through the supplemental table, to `context.WithTimeout`, UUID parsing, token retrieval, claim extraction, formatted output, and process exit. The timeout call receives the integer 30,000,000,000, consistent with a 30-second Go duration. The request operation and error/status branches support a CLI-to-launcher boundary; token contents were not inspected. Exact recovered argument types remain uncertain because Ghidra did not recover the Go calling convention accurately.

This validates a bounded preparation and request-response portion of the command. It does not demonstrate that a browser process actually starts. Targetless indirect calls remain outside the recovered reference edges.

## Request builder and response wrapper

REA decoded `0x14056d5e0`, the metadata candidate for the V2 request builder. Its observed calls and exact-length string operands support the following static request contract. Evidence: `ev_67664a8ffcea0cc38b7a5023543c0e8890ef62b5dacc6bebb59a203a0b5c173f`.

| Observed item | Finding | Address or call site |
| --- | --- | --- |
| Method | `GET` | Literal `0x14083fdc9`, length 3 |
| Path template | `/profile/f/%s/p/%s/start` | Literal `0x140855ccc`, length 24; formatting call `0x14056d789` |
| Path parameter labels | `folder_id`, `profile_id` | Literals `0x1408451e3`, `0x14084608b` |
| Optional query keys | `automation_type`, `headless_mode`, `window_mode` | Serialization calls `0x14056d833`, `0x14056db46`, `0x14056de22` |
| Optional header | `X-Strict-Mode` | Serialization call `0x14056e160`; canonicalization `0x14056e1a0` |
| Request construction | URL serialization followed by request construction with a nil body | Calls `0x14056e0ca`, `0x14056e0f5` |

The call targets are associated through the supplemental metadata with URL parsing, query encoding, parameter serialization, and `net/http.NewRequestWithContext`. Because Go strings are length-delimited and the generic decompiler expands adjacent string-pool data, these findings use exact operand lengths instead of copying the decompiler's long apparent string literals. The private bounded-literal reader records each file offset and the exact artifact hash in `.workbench/research/multilogin-request-observations.json`.

The wrapper at `0x14056e860` makes an interface-dispatched call through a method-table slot, tests an error result, then directly calls `0x14056e940` at `0x14056e8c5`. Supplemental metadata names that direct callee as the V2 start-response parser. Evidence: `ev_63e679939f32e890d535357cbe4042d0e37f6a6e38bb6c2a7ae9d786270a246b`.

The request-builder evidence also records an incoming unconditional call at `0x14056cf2d` from the decoded function at `0x14056cee0`. Supplemental metadata associates that caller with the V2 launcher's `Client.StartBrowserProfileV2`. This establishes a native client-to-builder edge in addition to the command-to-wrapper edge.

The wrapper's interface-dispatched destination is unresolved in this bounded trace. Consequently the client-to-request-builder and command-to-wrapper paths are individually established, while the complete command-to-HTTP chain is not yet proven. The base URL, port, network transport, browser process, and actual response were not observed. Optional parameter value domains also remain unresolved.

## Architecture implications for Vesper

The decoded command-to-wrapper call and request builder support a launcher-client boundary. Vesper should define its own local profile lifecycle and documented API rather than depend on an undocumented vendor interface.

The split between profile commands, launcher-client methods, and request-builder candidates is a useful way to scope independent implementation: the workbench requests an operation, the local browser service validates a profile and starts or stops its process, and the browser runtime owns its isolated storage and transport. These are design decisions for Vesper, not claims about proven Multilogin internals.

Proxy-check names do not demonstrate that browser traffic uses a proxy, that DNS is isolated, or that WebRTC routing is controlled. Those properties need direct tests of Vesper's own runtime. Likewise, no evidence here establishes canvas, WebGL, audio, font, timezone, mobile-device, or fingerprint consistency behavior.

## Remaining evidence needed

1. Continue from the decoded `StartProfile` to the V2 response wrapper and launcher client, confirming each call relationship.
2. Resolve the wrapper's interface dispatch and connect it to the decoded request builder; establish base-URL configuration separately.
3. Follow a bounded stop path and distinguish API acknowledgement from actual child-process exit.
4. Investigate proxy-check and proxy configuration separately; establish what reaches browser transport.
5. Inspect the actual browser engine independently before making claims about fingerprint surfaces or feature parity.

This investigation currently establishes artifact identity, native inventory, relevant name strings, bounded code-entry candidates, a decoded command-to-launcher-wrapper call, and a separate static request contract. It does not yet establish an end-to-end executable profile lifecycle or complete understanding of Multilogin.
