# Workbench runtime baseline

Workbench CLI development and source builds require Node.js 26 or newer. Browser's independent source repository continues to support Node.js 24 or newer because it does not host the embedded PostgreSQL WebAssembly runtime. Desktop installers include Electron's own runtime; users do not install Node.js to run either app.

On 12 October, one Windows source-check job aborted in V8 while repeatedly opening and closing PGlite. The fatal assertion was `jit_page_->allocations_.erase(addr) == 1`; the other exact-head run passed. This is consistent with the [reported Node 24 WebAssembly code-lifecycle issue](https://github.com/nodejs/node/issues/66366), whose [upstream V8 fix](https://github.com/v8/v8/commit/9b8ca54d5a) is present in newer V8 versions. A passing retry alone was not accepted as the resolution.

The Workbench CI baseline uses Node.js 26. Local validation uses an official, checksum-verified Node.js 26.11.1 portable runtime without replacing the PC's global installation. Database-heavy test files use two concurrent workers to bound memory use. No assertions are skipped to avoid the runtime failure, and no WebAssembly garbage-collection or security feature is disabled.

The installed Browser 0.4.3 / Workbench 0.5.5 desktop uses Electron 44.7.0 with V8 15.2.124.28 and Node.js 24.21.0. Its own V8 version, rather than the Node major alone, matters here. The installed pair passed extended automation, storage, archive and calendar qualification. This does not qualify the custom Chromium kernel or establish that every upstream runtime bug is absent.
