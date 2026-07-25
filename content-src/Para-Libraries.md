# Para libraries

**para** is Noeta's first-party library suite — the packages the Noeta project builds and maintains alongside the language, one layer above the [standard library](Standard-Library). Where `std` ships inside the toolchain, a para library is an ordinary package: opt-in, versioned and released on its own cadence, and pulled in through `[dependencies]` like anything else. The suite covers the ground an application hits right after the language itself — web serving, databases, sessions, HTTP clients, CLIs, reactive HTML, local-first state.

<!-- para-index -->

## First-party, concretely

- **One org, one scope.** Every library is developed in the open under [github.com/noeta-lang](https://github.com/noeta-lang) and published under the `para` scope on the [hosted registry](https://registry.noeta.dev). `para` is a **reserved first-party namespace**: the registry allows only the `noeta-lang` org to claim it, so a `para/…` identity is guaranteed to be the real thing.
- **Standalone by design.** Each library lives in its own repository with its own examples, tests, and releases, so the language and its libraries can move on different cadences. Toolchain and `std` issues belong in [the main repo](https://github.com/noeta-lang/noeta); library issues in the library's repo.
- **Noeta-first.** `para/cli`, `para/aether`, `para/aether_db`, and `para/html` are pure Noeta. `para/api`, `para/db`, and `para/p2p` ship a native Rust extension for the part that must touch the OS (a database driver, a QUIC transport, a spec parser) — which the consuming app authorizes explicitly under `[trust]`, like any native package.

## Installing para packages

Packages of one scope bind under a single dependency key — as an array when you use several (see [the manifest reference](Manifest)):

```toml
[dependencies]
para = [
    { version = "^0.1", package = "para/aether" },
    { version = "^0.1", package = "para/db" },
]

# A native extension is authorized by the app that runs it:
[trust]
native = ["para/db"]
```

The scope key is the import root: `para/aether` addresses as `para.aether`, `para/db` as `para.db` — `use para.aether.{App}`, `use para.db.{Db}`.

## How these pages work

Each library's page on this site mirrors its repository README — the complete guide to that library. The registry page linked at the top of each page carries the released versions and the full API reference; deeper design write-ups live in the repositories themselves.
