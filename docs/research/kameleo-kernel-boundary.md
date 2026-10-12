# Kameleo browser interaction boundary

Local REA inspection, 10 October 2026. This report records static observations, not execution or recovered original source.

## Selected artifact

The installed Chroma 151 kernel directory contains `client-browser-interactor-chroma.dll`. REA's execution-free managed parser admitted a PE CLI header and classified this particular assembly as managed CIL targeting `.NETCoreApp,Version=v8.0`. That is distinct from the separately inspected main `Kameleo.Engine.exe`, whose CLI directory was absent.

- Artifact SHA-256: `a5b22721d7a198c821aba7ee9f40b0ccea5ce246d0b5add903633ed71fd2f310`.
- Byte length: 4,477,440.
- Metadata evidence: `ev_016fae4e1a22b0e6e0d4d31d3fad7720545489be4e85ebf3b311bc9195719f91`.
- Member/CIL evidence: `ev_a51305d192c92c85b9d26db2af1631a205006ce486bd29ab24899be50edbc9be`.
- MVID: `1e881d08-e1f6-127a-fb1c-d5aaeed7e6dd`.
- Private raw outputs: `.workbench/research/kameleo-chroma-interactor-metadata.json` and `kameleo-chroma-interactor-members.json`.

The member inventory records 3,593 types, 26,672 methods, 115,908 call edges and 69,518 field accesses. This includes embedded dependency code and many obfuscated names. Counts do not measure recovered first-party source or complete functional understanding. REA marks the overall member coverage partial.

## Focused observations

A bounded selection of endpoint, launch and CDP-related call edges produced the following coordinates. Tokens are valid only for the exact artifact hash and MVID above.

| Caller | Caller token | Observed referenced member | Meaning supported by evidence |
| --- | --- | --- | --- |
| `e.GetWebdriverEndpoint` | `0x06000031` | `get_WebSocketEndpoint`, token `0x0a000081` | This method body contains a call to the named endpoint getter |
| `e.GetCdpEndpoint` | `0x06000032` | `get_WebSocketEndpoint`, token `0x0a000081` | The second endpoint method also references that getter |
| `h.MoveNext` | `0x0600006f` | `CreateCDPSessionAsync`, token `0x0a000147` | A state-machine body contains a call to the named CDP session member |
| `i.MoveNext` | `0x06000071` | `LaunchAsync`, token `0x0a000189`, and `SendAsync` | A state-machine body has launch and send call anchors |

REA records file-backed CIL bodies for these methods. For example, `GetWebdriverEndpoint` has its method body at file offset 7,536, with 54 decoded instructions and no omitted instructions in that selected body. The focused projection is retained privately in `kameleo-chroma-interactor-trace.json`.

The supported inference is that the shipped kernel has a managed browser-interaction layer with endpoint and debugging-session interfaces. The evidence does not establish which runtime path uses those interfaces, which external endpoint a particular launch selects, or what the browser's native masking patches do.

## Limitations and design consequences

Some generic signatures are unsupported by this REA parser and retain their raw signature hashes. Member-reference names alone do not provide a complete resolved declaring type. Obfuscated global types and compiler-generated state machines complicate attribution. No assembly was loaded into a CLR, no target method executed, and no runtime dependency resolution occurred.

Vesper's independent design keeps browser lifecycle and local CDP connection ownership in the Browser package, while Workbench consumes that public boundary. That is our design choice, compatible with the observed separation of concerns; the vendor's implementation is not copied.

Further research must connect desktop settings, engine lifecycle, kernel configuration and actual browser observations on owned fixtures. This managed inventory leaves rendering masks, fingerprint generation, proxy leak behavior and detection parity unresolved.

## Reproduce

```powershell
npx --yes rea-agents@6.3.0 inspect-managed-artifact "$env:APPDATA\Kameleo\Kernels\chroma-151-win-x64-2026_07_30T12_05\client-browser-interactor-chroma.dll" --format json
npx --yes rea-agents@6.3.0 inspect-managed-members "$env:APPDATA\Kameleo\Kernels\chroma-151-win-x64-2026_07_30T12_05\client-browser-interactor-chroma.dll" --format json
```

These outputs are large and contain source-bearing analysis. Keep them private; product documentation needs evidence coordinates and findings rather than distributed vendor artifacts.
