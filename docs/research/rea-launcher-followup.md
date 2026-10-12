# REA launcher follow-up — 12 October 2026

A focused read-only REA 6.3.0 / Ghidra 12.1.4 pass followed an installed Multilogin Mimic launcher beyond string matching. The target executable SHA-256 is `f629aff195af261dd15aed08492d4b67a6441f66c1bcca9d91584d4ac39544cb`.

The `chrome.dll` string at `0x14036aa18` has a reference from a data descriptor at `0x14036a9f0`. That descriptor is not a function. A second reference query reaches the containing procedure at `0x140037d70`, whose observed body spans 1,602 bytes. REA's function dossier records library loading, entry-point resolution and dispatch through the `ChromeMain` export. Evidence ID: `ev_fbf89d16244eaa80bba43cc7d2608b51be565f9511d356efc3e66aad227b55a3`.

This establishes a static launcher-to-library handoff, not the proprietary fingerprint consumer or a controlled runtime result. The decompiler emitted control-flow/restart warnings; the observed reference graph and native API identities are stronger evidence than treating its pseudocode as complete source. The first attempted function query correctly failed because its address was data; the follow-up resolved the data reference to code before analysis. No vendor program, profile or credential was executed or inspected.

The Windows REA/Ghidra provider admits native PE application targets but does not admit DLL targets. Kameleo's managed/native boundary and Dolphin's protected loader/module boundary remain partially understood, as recorded in the existing [research ledger](feature-ledger.md) and [native follow-up](vendor-native-engine-followup.md). This pass does not turn those unknowns into completed features.

Vesper's independent consequence is to package and verify the complete compiled runtime, including its libraries, and qualify native behavior in fresh browser targets. The source tree and compiler belong to kernel developers. End users should install compiled runtime files, and a successful launcher startup must not substitute for tests of the native policy consumers. Private dossiers and any implementation-bearing vendor material remain local; no vendor code or binary is included in the public source.
