# DeepSeek Harness Desktop

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的桌面辅助插件与轻量 Tauri 外壳。

[English](README.md) | 中文

## 当前状态

Cordis 双面插件已经完成，并针对当前已发布的 dsh API 通过类型检查和构建。Tauri 外壳已经具备启动 dsh、显示 Web UI 和系统托盘控制；全局快捷键等高级原生能力仍在规划中。

## 已实现能力

| 能力 | 位置 | 说明 |
|---|---|---|
| 等待交互通知 | 插件 Client | 会话等待审批、问题回答或计划评审时发送浏览器桌面通知，点击可打开对应会话。 |
| `screen_capture` 工具 | 插件 Host | 截取 Host 主显示器并把图片作为附件写入会话；默认关闭，必须由用户明确启用。 |
| 多智能体画布 | 插件 Client | 在 `conversation.view` 中显示会话和子智能体的实时状态网格。 |
| Tauri 桌面外壳 | Desktop App | 启动 `dsh --profile web`、嵌入本地 Web UI，并提供系统托盘显示/退出操作。 |

## 尚未实现

- `Alt+Space` 全局快捷面板；
- 原生操作系统通知；
- 时间旅行、会话回溯和实时 Fork；
- 多显示器或区域截图；
- Floating Attention HUD：依赖尚未进入已发布 dsh Client Runtime 的 `shell.overlay` 插槽。

## 安装插件

```sh
dsh plugin --profile web add ./packages/dsh-desktop-plugin
```

需要屏幕截图工具时，在 profile 的 patch 中显式启用：

```yaml
- id: dsh-desktop-plugin
  config:
    screenCapture: true
```

## 开发验证

```sh
pnpm install
pnpm check
pnpm --filter @mixian/dsh-desktop-plugin check
```

详细发布步骤参见 [发布指南](docs/PUBLISHING_GUIDE.md)，架构调研与勘误参见 [架构分析](docs/ARCHITECTURE_ANALYSIS.md)。

## License

MIT
