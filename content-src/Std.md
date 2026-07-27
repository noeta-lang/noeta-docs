# Standard library reference

The `std` namespace is the toolchain's built-in module surface — imported explicitly with `use std.{…}`, tree-shaken when unused. This section is the API reference for every `std` module: one page per module family, each listing the module's public functions and types with the exact signatures the compiler enforces.

<!-- std-index -->

## How this reference is built

These pages are **generated, not written**. Every docs build runs the toolchain's own `noeta doc --api`, which walks the intrinsic registry — the same source of truth the compiler, the LSP, and `noeta mcp` serve — and emits each module's public API with its signatures and doc prose. The reference cannot drift from the toolchain, because it *is* the toolchain's registered API: a new function appears here on the next build, and a signature here is exactly what the type checker enforces. Deployed builds generate it with the released binary named by the version pill in the header, so the reference always matches the release you install.

The doc prose itself lives beside the intrinsics in [`noeta-stdlib`](https://github.com/noeta-lang/noeta/blob/main/crates/noeta-stdlib/src/registry.rs) — that file is where fixes and improvements belong; the "Edit on GitHub" link on every generated page points there.

## What isn't here

The always-available **Ring 1** surface — the built-in methods on strings, lists, maps, sets, options, and results that need no import — is covered on [Standard Library](Standard-Library), along with the import forms and how the rings fit together. Conceptual guides (error handling, concurrency, reactivity, the type system) live under Language reference in the sidebar.
