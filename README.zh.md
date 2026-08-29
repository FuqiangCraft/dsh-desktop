# DeepSeek Harness Desktop Pro

[![CI](https://github.com/FuqiangCraft/dsh-desktop/actions/workflows/ci.yml/badge.svg)](https://github.com/FuqiangCraft/dsh-desktop/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@mixian/dsh-desktop-plugin.svg)](https://www.npmjs.com/package/@mixian/dsh-desktop-plugin)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的 Cordis 插件与 Tauri 桌面外壳。插件提供等待交互的桌面通知、可选开启的 `screen_capture` 模型工具、多智能体画布、桌面宠物伴侣窗口和桌面设置分区；外壳以原生方式运行 `dsh --profile web` 并提供托盘控制。

[English](README.md) | 中文

## 功能说明

| 能力 | 端 | 说明 |
|---|---|---|
| 等待交互通知 | client | 订阅会话存储；会话等待审批、问题回答或计划评审时发送浏览器桌面通知，点击打开对应会话。 |
| `screen_capture` 模型工具 | host | 截取主显示器并把截图作为图片附件写入会话。**默认关闭**——见[授权说明](#授权说明)。 |
| 多智能体画布 | client | `conversation.view` 标签页，从会话存储渲染会话与子智能体的实时只读状态网格。 |
| 桌面宠物 | client | 悬浮伴侣窗口（猫 / 机器人 / 鲸鱼），由状态引擎根据会话实时状态推导宠物形态（待机 / 思考 / 工作中 / 警示 / 成功），并在 dsh 导航栏拥有专属图标。 |
| 桌面设置 | client | 设置分区：宠物偏好、窗口皮肤（磨砂 / 二次元 / 赛博朋克 / 太空预设，支持自定义上传、模糊与暗度调节）、关于与更新信息。 |
| 原生外壳 | app | Tauri 2.0 应用：启动 `dsh --profile web`、嵌入本地 Web UI、固定应用内目录浏览，并提供带最近会话菜单和更新检查的托盘控制。 |

## 挂载方式

- 包声明了 `dsh.bundle` manifest（对象形式：`{ "patch": "./cordis.patch.yml" }`）——这是 dsh 识别可安装插件的依据。`dsh.client` 声明 web 平台及其注入的 `@deepseek-ai/*` 运行时包。
- host 侧仅注册 `screen_capture` 模型工具。
- client 侧只读取会话存储和 `question/requested` 交互流（经 `PendingWait.answer` 通道），**不注册第二个 `ctx.userQuestions` provider**，因此与已发布运行时无插槽冲突。
- client bundle 为单文件，以 `window.__ModuleLoader__.load({ id, factory })` 握手包裹（见 `build.mjs`）。

## 安装

插件以 [`@mixian/dsh-desktop-plugin`](https://www.npmjs.com/package/@mixian/dsh-desktop-plugin) 发布，提供双面 Cordis bundle（`dsh.bundle` + `dsh.client`）。两种挂载方式任选：

```sh
# 推荐：装进 profile（会写入 profile 的 node_modules）
dsh plugin --profile web add @mixian/dsh-desktop-plugin

# 从源码检出安装
dsh plugin --profile web add ./packages/dsh-desktop-plugin

# 或临时覆盖（不安装）
dsh web --patch ./packages/dsh-desktop-plugin/cordis.patch.yml
```

### 授权说明

`screen_capture` 会暴露操作者的整个屏幕。除非在 profile patch 中显式设置 `screenCapture: true`，该工具**不会注册**：

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: dsh-desktop-plugin
  config:
    screenCapture: true   # 显式开启：注册 screen_capture 工具
```

截图始终会回显到会话中以保证透明——绝不静默注入。

### 运行桌面应用

```sh
pnpm install
pnpm dev            # Electron 开发
pnpm electron:package # Windows 生产构建
```

需要 Node.js ≥ 22 和 pnpm 11（`corepack enable`）。

## 模型体验

- 空闲时**不增加任何 token**：通知监听、画布、桌面宠物和设置均为 client 侧实现，只读取会话存储，不进入模型上下文。
- `screen_capture` 只增加一个描述简短的模型侧工具；其输出是持久 `tool/result` 事件中的图片块，与会话内其他图片遵循相同的附件限制。需要支持图片输入的模型。

## 已知限制

- 浮动 Attention HUD 依赖 `shell.overlay` 插槽：该插槽在 dsh `master` 已存在，但**尚未进入已发布 client 运行时**（`@deepseek-ai/dsh-client-*@0.0.1-rc.1`）。组件已就绪（`AttentionCard.tsx`），插槽发布后才会挂载。
- 屏幕截图仅限 host 侧、仅支持主显示器；不支持多显示器和区域截图。
- 多智能体画布是只读监视器，不能创建或附加会话。
- 通知使用浏览器桌面通知 API；原生系统通知与 `Alt+Space` 全局快捷面板在规划中，尚未发布。
- 时间旅行、会话回溯和实时 Fork 未实现。

## 开发

```sh
pnpm install
pnpm check          # lint + 类型检查 + 测试 + Electron 构建 + 插件构建 + bundle 校验
pnpm dev:plugin     # 插件开发循环
```

### 目录结构

```
packages/dsh-desktop-plugin/   # 双面 Cordis 插件（dsh.bundle + dsh.client）
packages/dsh-desktop-electron/ # Electron 桌面应用
stubs/                         # 尚未发布的 @deepseek-ai/* 传递依赖的本地类型桩
docs/                          # ARCHITECTURE_ANALYSIS + PUBLISHING_GUIDE（2026-08 验证）
```

## 文档与社区

- [架构分析](docs/ARCHITECTURE_ANALYSIS.md)——dsh 内部机制调研与已验证约束
- [发布指南](docs/PUBLISHING_GUIDE.md)——打包规范、注册表提交、npm 已知坑
- [贡献指南](CONTRIBUTING.md) · [安全策略](SECURITY.md) · [更新日志](CHANGELOG.md)

仓库已打 `dsh-plugin`、`deepseek-harness`、`cordis-plugin` topic，便于生态发现。

## License

MIT
