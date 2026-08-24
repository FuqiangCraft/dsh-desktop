# DeepSeek Harness Desktop Pro

Desktop-grade companion for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`).

**Status (2026-08):** the Cordis plugin is implemented and built against the published dsh APIs. A minimal Tauri shell is also implemented; advanced native features remain planned.

## What's built

| Capability | Where | Notes |
|---|---|---|
| Native notifications for pending interactions (approval / question / plan review) | `dsh-desktop-plugin` client | Fires a browser desktop notification when any session waits on the user; click opens the session. No slot required — works against the published runtime. |
| `screen_capture` model tool | `dsh-desktop-plugin` host | Captures the host display and commits the screenshot into the conversation as an image attachment. **Disabled by default** (consent gate). |
| Multi-agent tiling canvas | `dsh-desktop-plugin` client | A `conversation.view` tab rendering a live grid of sessions/sub-agents from the sessions store. |

## Native shell

- The Tauri 2.0 shell starts `dsh --profile web`, embeds the local Web UI, and provides show/quit tray controls.
- Global hotkeys and native OS notifications are planned, not part of the current release.
- Floating attention HUD — blocked on the `shell.overlay` slot, which exists in dsh `master` but is not yet in the published client runtime. The component ships ready (`AttentionCard.tsx`).

## Workspace

```
packages/dsh-desktop-plugin/   # dual-face Cordis plugin (dsh.bundle + dsh.client)
packages/dsh-desktop-app/      # minimal Tauri shell
stubs/                         # local type-stubs for unpublished @deepseek-ai/* transitive deps
docs/                          # ARCHITECTURE_ANALYSIS + PUBLISHING_GUIDE (verified 2026-08)
```

## Verified facts (see docs/ARCHITECTURE_ANALYSIS.md §5)

- dsh has **no built-in plugin store**; "the market" is GitHub topic `dsh-plugin` + community registries (`awesome-dsh-plugin`).
- `dsh.bundle` must be the object form `{ "patch": "./cordis.patch.yml" }`.
- Client bundles are single files wrapped in the `__ModuleLoader__.load({ id, factory })` handshake.

## License

MIT
