# Rust desktop architecture

## Decision

The desktop migration uses a hybrid boundary rather than rewriting DeepSeek
Harness in Rust. Rust owns native lifecycle and process supervision. A Node.js
sidecar continues to own Cordis, DSH services, NPM package resolution and the
host/client plugin graph.

```text
Rust desktop host
  | newline-delimited, versioned JSON over stdio
  v
Node.js DSH sidecar
  | loopback HTTP + DSH transport
  v
React client / DSH client plugins
```

The protocol uses stdout exclusively for machine-readable events. Sidecar
logs are redirected to stderr. The initial handshake contains the loopback
origin, bound port, protocol version and a unique runtime generation.

## Ownership boundaries

Rust owns:

- sidecar start, health and forced termination;
- later Tauri window, tray, notification and updater integration;
- native permission enforcement and resource limits.

Node owns:

- Cordis effects, dependency injection and plugin lifecycle;
- profile bundles and `cordis.patch.yml`;
- DSH agent, tool, session and model services;
- NPM host/client plugin discovery.

## Migration sequence

1. Run and validate the out-of-process sidecar under the Rust supervisor. **Complete.**
2. Validate the sidecar boundary through the former compatibility shell. **Complete.**
3. Add the Tauri shell and reuse the current React client URL. **Complete for the main window and sidecar lifecycle.**
4. Provide a capability-scoped Tauri IPC bridge and Rust-owned settings store. **Complete.**
5. Move tray, native notifications and recent-session actions to Rust providers. **Complete.**
6. Move the companion window, state synchronization and custom PNG resources to Rust providers. **Complete.**
7. Move update and packaging services to Rust. **Complete; production activation awaits release credentials.**
8. Retire Electron after feature parity. **Complete.**

This order keeps the existing plugin contract operational throughout the
migration and makes rollback possible at every stage.

## Tauri production packaging

`pnpm tauri:prepare` creates a self-contained production runtime in the ignored
`.tauri-runtime` staging directory. It includes a pinned Node executable, the
versioned sidecar and a hoisted production-only dependency tree. Development
type declarations and source maps are removed because they are not loaded at
runtime and can exceed the Windows NSIS path limit.

`pnpm tauri:package` builds the Rust host and a Windows NSIS installer. Release
builds resolve Node and the sidecar from the Tauri resource directory; debug
builds retain environment overrides for migration testing.

The Rust update provider implements check, verified download, progress events,
deferred install and application restart. It refuses non-HTTPS endpoints and
maps transport and signature errors to stable UI states. The release trust root
is compiled into the binary and cannot be overridden through the runtime
environment. Debug builds may use runtime variables for local integration tests:

- `DSH_UPDATER_ENDPOINT`: HTTPS endpoint using Tauri update variables;
- `DSH_UPDATER_PUBKEY`: Minisign public key used to verify artifacts.

Signed automatic updates use the repository's GitHub Releases `latest.json`
endpoint. The public verification key is committed with the Rust shell; the
private signing key is stored only as the `TAURI_SIGNING_PRIVATE_KEY` GitHub
Actions secret and must stay outside the repository and build artifacts. Tag
releases generate signed updater artifacts through the official Tauri action.

## Native release gate

The Tauri bridge now owns profile directory access, canonical desktop-profile
reset and controlled application restart for boot recovery. A reset overwrites
only `profiles/desktop/package.json`, `cordis.patch.yml`, `cordis.yml` and its
checkpoint; the Sidecar reloads them after the native host restarts.

The remaining release gate is an installed-version to signed-update-version
upgrade test using two published Tauri versions.

If Node or the Sidecar cannot start, the Tauri setup phase now opens a bundled
recovery window instead of aborting the desktop process. It exposes only the
capability-scoped retry, profile-folder, canonical-reset and quit operations.
The diagnostic is JSON-encoded, rendered through `textContent` and limited to
2,000 characters. A forced missing-Node smoke test verifies that this recovery
shell remains alive after startup failure.

The single-instance plugin is registered before every other native provider.
A secondary launch exits before Tauri setup can start another Sidecar, while
the primary instance is shown, unminimized and focused. Secondary command-line
arguments are not executed or forwarded to the web client.

The main window uses a single frameless, ChatGPT-style top row instead of the
stacked Windows title and menu bars. It contains sidebar/history controls, the
localized File, Edit, View, Window and Help entries, and window controls, with
no visible product title. The injected bar can only request capability-scoped
Rust commands; popup contents remain native menus and editing actions retain
native roles. `openApplicationMenu` accepts only the ten known Chinese/English
top-level labels and clamps popup coordinates before opening a menu. The pet is
disabled for new profiles and is never restored automatically at application
startup; it opens only after an explicit in-session setting action.

## Development performance baseline

Run `pnpm benchmark:desktop` to create `docs/performance-baseline.json`. The
Windows harness uses three isolated cold profiles per runtime, waits for the
shared Sidecar handshake marker, settles for two seconds and then sums the
working set and private bytes of the complete process tree.

The 2026-08-31 development baseline on Windows x64 produced these medians:

| Runtime | Sidecar ready | Working set | Private memory | Processes |
| --- | ---: | ---: | ---: | ---: |
| Tauri debug | 2,258.6 ms | 704.7 MiB | 554.6 MiB | 9 |
| Electron development | 2,685.9 ms | 766.8 MiB | 535.8 MiB | 5 |

All six samples observed the Sidecar and loaded `@mixian/dsh-desktop-plugin`.
On this machine Tauri reached the shared readiness point 15.9% sooner and used
8.1% less working-set memory, while private memory was 3.5% higher and WebView2
used four more processes. This is a development diagnostic, not a release-build
performance claim; installed production builds still require comparison before
The compatibility shell was removed after this comparison and feature-parity audit.

## Portable production performance baseline

Run `pnpm benchmark:desktop:release` after creating the optimized Tauri binary,
staging `.tauri-runtime` beside it with `prepare-portable-release.mjs`, and
The historical production benchmark compared the Tauri Release executable with
the retired compatibility shell. New performance baselines measure Tauri only.

The 2026-08-31 Windows x64 production-equivalent baseline produced these
medians:

| Runtime | Sidecar ready | Working set | Private memory | Processes |
| --- | ---: | ---: | ---: | ---: |
| Tauri Release | 1,512.9 ms | 684.1 MiB | 552.9 MiB | 8 |
| Electron win-unpacked | 2,012.1 ms | 577.8 MiB | 446.1 MiB | 5 |

All six samples observed the Sidecar and loaded the desktop plugin. Tauri
reached readiness 24.8% sooner, but used 18.4% more working-set memory and 23.9%
more private memory; WebView2 also used three more processes. The packaged
startup/plugin-load retirement gate is therefore measured and functionally
passed, but memory parity is not achieved and remains an optimization target.
This portable comparison exercises production binaries and resources, not
installer/update behavior; the signed installed-version upgrade test remains a
separate release gate.

The report also records per-process-role medians. The Tauri desktop host itself
uses 28.9 MiB working set versus Electron's 137.9 MiB main process. The remaining
gap is concentrated in the WebView2 process group and the standalone Node
Sidecar. Release builds use the Windows GUI subsystem and launch the Sidecar as
a detached process, eliminating two unnecessary console hosts without changing
the stdin/stdout supervision protocol. More aggressive Chromium single-process,
GPU-disable or V8 heap caps are intentionally not used because they would trade
away renderer isolation, acceleration or workload headroom.
