# DeepSeek Harness (`deepseek-ai/deepseek-harness`) 深度架构剖析与下一代桌面端旗舰插件/应用方案

---

## 目录
1. [DeepSeek Harness 仓库核心架构全景解密](#一deepseek-harness-仓库核心架构全景解密)
   - 1.1 架构哲学：基于 Cordis 的“一切皆插件”设计
   - 1.2 Host-Client 双面架构（Dual-Face Architecture）
   - 1.3 核心微内核脊柱与 Capability Seams（能力接缝）
   - 1.4 Append-Only Session 存储与事件驱动生命周期
   - 1.5 配置系统与分层补丁机制（`cordis.patch.yml`）
2. [目前插件社区生态与市场现状深度调研](#二目前插件社区生态与市场现状深度调研)
   - 2.1 社区现状与发现机制（GitHub Topic、`dsh-market`、`awesome-dsh-plugin`）
   - 2.2 现有第三方插件与桌面包装方案的致命痛点
3. [“超越社区现有方案”的下一代桌面端旗舰方案设计](#三超越社区现有方案的下一代桌面端旗舰方案设计)
   - 3.1 架构定位：双模混合架构（Cordis 官方原生插件 + 轻量极速桌面壳）
   - 3.2 6 大杀手级特性（Killer Features）
   - 3.3 系统架构图与交互时序图
4. [工程目录结构与完整实现清单](#四工程目录结构与完整实现清单)
5. [插件发布与社区上架全流程指南](#五插件发布与社区上架全流程指南)

---

## 一、DeepSeek Harness 仓库核心架构全景解密

`deepseek-ai/deepseek-harness`（简称 `dsh`）是 DeepSeek 官方开源的 Agent 运行框架与环境。与传统的单体或固定工作流 Agent（如 AutoGPT、MetaGPT、LangChain Agent）有着根本性的不同，`dsh` 采用了高度解耦的**微内核 + 插件化（Microkernel & Pluggable）**架构。

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          DeepSeek Harness (dsh)                          │
├──────────────────────────────────────────────────────────────────────────┤
│  Client-Side (Web / React / Slots)                                       │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌──────────────┐ │
│  │ UI Slot Registry      │  │ Conversation Node Asm │  │ Dynamic HMR  │ │
│  └───────────────────────┘  └───────────────────────┘  └──────────────┘ │
├──────────────────────────────────────────────────────────────────────────┤
│  RPC / SSE Gateway (TypeRT Remote Invocation & Transport Bridge)         │
├──────────────────────────────────────────────────────────────────────────┤
│  Host-Side (Node.js / Cordis Plugin Meta-Framework)                      │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Core Spine:                                                        │  │
│  │  • ctx.agents     (Live Agent registry & handle)                   │  │
│  │  • ctx.sessions   (Append-only SessionEvent store)                 │  │
│  │  • ctx.tools      (Guarded Tool execution pipeline)                │  │
│  │  • ctx.systemPrompt (Dynamic Prompt Section assembler)             │  │
│  │  • ctx.llm        (Adapter registry: DeepSeek / Pi / Replay)       │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Capability Seams (Three Roles: Interface, Provider, Consumer):     │  │
│  │  • ctx.fs         (fs-local / fs-sandbox / fs-e2b)                 │  │
│  │  • ctx.shell      (bash-local / bash-sandbox / pwsh-local)         │  │
│  │  • ctx.terminals  (persistent PTY session manager)                 │  │
│  │  • ctx.subagents  (in-process / fork / ACP / Codex / Claude Code)  │  │
│  │  • ctx.directoryPicker (Native OS dialog / Web Browser picker)     │  │
│  │  • ctx.userQuestions (Human-in-the-loop Ask/Answer bridge)         │  │
│  │  • ctx.settings   (Layered config store: base / profile / user)    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.1 架构哲学：基于 Cordis 的“一切皆插件”
- **Cordis 插件元框架**：`dsh` 没有硬编码的特权内核（No privileged core）。从 LLM 适配器、工具执行管线、会话日志、终端管理，甚至到 Agent 的主循环逻辑（`agent-loop`）本身，都是 Cordis 插件。
- **服务（Service）与依赖注入（DI）**：插件向共享的 `Context`（`ctx`）注册具名服务（如 `ctx.tools`, `ctx.sessions`），并通过 `export const inject = ['tools', 'llm']` 声明依赖。Cordis 会在依赖满足时自动激活插件。
- **可逆副作用（Reversible Effects）**：插件注册的所有事件监听器、工具定义、Prompt 片段都是通过 `ctx.effect()` 或 `ctx.on()` 挂载的。当插件卸载或热更新时，Cordis 会自动逆向回滚（unwind）所有副作用，保证运行时的零污染和纯净状态。

### 1.2 Host-Client 双面架构（Dual-Face Architecture）
`dsh` 创新地设计了“双面包（Dual-Face Package）”模型：
1. **Host 侧（Node.js 端）**：
   - 负责与系统底层、文件系统、子进程、数据库、API 网关通信。
   - 实现业务能力提供者（Service Provider）与事件总线。
2. **Client 侧（Browser / React 端）**：
   - 不直接调用 Host 内部类，而是通过统一的 **TypeRT Remote RPC / SSE** 与 Host 网关通信。
   - **Slot 统一插槽系统**：Client 界面严格遵循 `ctx.slots.register({ name, children, store, inject }, Component)` 机制，UI 完全模块化。
   - **ConversationNodeDefinition 会话节点装配**：将后端的持久化事件（`SessionEvent`）高效聚合为前端可渲染的对话流节点，具备动画帧合并（`animation-frame`）与防抖重放能力。

### 1.3 核心微内核脊柱与 Capability Seams（能力接缝）
在 `dsh` 中，任何可替换的能力都被抽象为 **Seam（接缝）**，严格分离三大角色：
- **Service Definition**：声明接口契约（例如 `ctx.directoryPicker`）。
- **Service Provider**：具体实现（例如 `directory-picker-native` 调用 OS 原生对话框，`directory-picker-browse` 提供 Web 端文件浏览器）。
- **Consumer**：消费者（例如前端调用、Agent 工具调用）。
这种设计使得我们只需替换 Provider，就能在不破坏上层逻辑的前提下赋予系统完全不同的原生底层能力！

### 1.4 Append-Only Session 存储与事件驱动生命周期
- **Model-visible means logged**：任何进入 LLM 上下文的数据必须在 Session 日志中有据可查。
- **Turn 与 Step 状态流**：
  ```
  turn/start ──> agent/pre-step ──> step/start ──> agent/request (llm/stream)
             ──> tool/call* ──> tools/execute ──> tool/result* ──> step/end
             ──> agent/turn-stopping ──> turn/end
  ```
- 拦截器体系（Waterfalls）：如 `agent/pre-step`、`tools/pre-execute`、`approval/request` 均采用中间件式 Waterfall，插件可以拦截、重写、权限审批或短路执行。

### 1.5 配置系统与分层补丁机制（`cordis.patch.yml`）
配置按确定性优先级严格叠加：
1. **Bundle 补丁**（如 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`）
2. **Profile 补丁**（`~/.dsh/profiles/<profile>/cordis.patch.yml`）
3. **Home 级全局补丁**（`$DSH_HOME/cordis.patch.yml`）
4. **CLI 运行时覆盖**（`dsh --patch <path>`）

---

## 二、目前插件社区生态与市场现状深度调研

### 2.1 社区发现与分发机制
- **GitHub Topic**：社区统一打标 `dsh-plugin`。
- **`dsh-market`**：基于 `awesome-dsh-plugin` 注册表的第三方插件市场扩展，提供图形化浏览与安装。
- **NPM 发布标准**：通过 `@deepseek-ai/dsh-*` 或独立命名空间包发布，`package.json` 中配置 `dsh.client` 或 `dsh.bundle`。

### 2.2 现有第三方插件与桌面包装方案的致命痛点
1. **粗暴的 Webview/Electron 套壳，性能极其低下**：
   - 仅仅用 Electron 打开一个 `http://127.0.0.1:3080` 网页。
   - 内存占用高达 400MB~800MB，冷启动耗时 5~10 秒。
2. **缺乏真正的原生操作系统交互**：
   - 无法实现类似 Raycast / Spotlight 的快捷悬浮窗（Floating HUD）。
   - 遇到 `tool/ask-user` 或敏感权限审批时，没有系统托盘气泡与原生通知交互，用户经常漏看后台 Agent 的提问。
   - 无法原生截屏带上下文提问（Screen Context Injection）。
3. **未能融入 Cordis 插件体系**：
   - 现有的桌面方案与 DSH 插件机制割裂，用户安装极其繁琐，无法通过 `cordis.patch.yml` 一键启用，无法在 Web 端和桌面端无缝共享插件。
4. **多任务与多会话（Multi-Session）体验孱弱**：
   - 现有 UI 依然是单线程聊天框模式，无法并行监控多个子 Agent（Subagent/Agent Teams）的实时执行状态与看板。

---

## 三、“超越社区现有方案”的下一代桌面端旗舰方案设计

我们要打造的 **`DeepSeek Harness Desktop Pro` (`dsh-desktop-pro`)**，采用 **双模无缝融合架构（Hybrid Microkernel Architecture）**：
既是一个 **标准的官方级 Cordis 插件**（可直接发布到 DSH 插件市场并通过 `cordis.patch.yml` 加载），也是一个 **基于 Electron 的独立桌面客户端**——主进程内嵌 cordis host，直接运行完整的 dsh 运行时，无需用户全局安装 dsh。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DeepSeek Harness Desktop Pro                           │
├───────────────────────────────────┬─────────────────────────────────────────┤
│    A. Electron Native Desktop     │      B. DSH Cordis Plugin (Host+Client) │
│  ┌─────────────────────────────┐  │  ┌────────────────────────────────────┐ │
│  │ Electron Main Process       │  │  │ Host Plugin (Node.js / Cordis)     │ │
│  │ • In-process dsh host boot  │◄─┼──┤ • Desktop Bridge Service           │ │
│  │ • Tray & Frameless Window   │  │  │ • Native Notification & Tray Pusher│ │
│  │ • Native Screen Capture     │  │  │ • OS DirectoryPicker Provider      │ │
│  │ • Auto-Update (GitHub)      │  │  │ • Subagent Live Telemetry Seam     │ │
│  └──────────────┬──────────────┘  │  └──────────────────┬─────────────────┘ │
│                 │ __DSH_DESKTOP_BRIDGE__ IPC                │ React Slots       │
│                 ▼                 │                     ▼                   │
│  ┌─────────────────────────────┐  │  ┌────────────────────────────────────┐ │
│  │ Multi-Session Canvas UI     │  │  │ Client Plugin (dsh.client)         │ │
│  │ • Tiling Agent Workspace    │  │  │ • Embedded Web UI (loadUrl)        │ │
│  │ • Visual Config / Market UI │ │  │ • System Status Badge & Quick Dock │ │
│  └─────────────────────────────┘  │  └────────────────────────────────────┘ │
└───────────────────────────────────┴─────────────────────────────────────────┘
```

### 3.1 六大降维打击级杀手特性（Killer Features）

| 序号 | 核心特性 | 传统社区方案 / Web 版 | **DSH Desktop Pro (本方案)** |
|:---:|:---|:---|:---|
| 1 | **开箱即用** | 需自备 Node.js 与 dsh 运行时，多步配置 | **单一安装包内置完整 dsh host，装完即用** |
| 2 | **全局快捷交互 (HUD)** | 无，必须手动切回浏览器窗口 | **`Alt+Space` 呼出 Raycast 式极简悬浮胶囊，无需切换上下文** |
| 3 | **深度 OS 系统集成** | 仅有简单网页弹窗 | **原生托盘气泡、任务完成音效、一键审批、原生剪贴板监听、全屏/区域截屏直投 Prompt** |
| 4 | **原生能力接缝替换** | 网页端虚拟文件树 | **以最高优先级无缝替换 `ctx.directoryPicker` 为原生 OS 原生文件/目录选择器** |
| 5 | **多 Agent 并行画布** | 单会话线性排列，频繁切换 | **Multi-Agent Tiling Canvas，支持多会话网格平铺、子 Agent 实时拓扑监控** |
| 6 | **时间旅行调试器** | 只能向上滚动查看死文本 | **基于 `ctx.sessions` 强一致性日志的“时间旅行播放器”，支持步骤快进、回溯与实时 Fork 会话** |

---

## 四、工程架构与代码落地规范

整个项目采用模块化 Monorepo 组织：
- **`packages/dsh-desktop-plugin`**：满足官方规范的 Cordis 双面插件（可独立发包并上架 DSH 插件市场）。
- **`packages/dsh-desktop-electron`**：Electron 桌面外壳工程（主进程内嵌 cordis host，与插件 client 通过 `__DSH_DESKTOP_BRIDGE__` IPC 通信）。
- **`docs/PUBLISHING_GUIDE.md`**：完整的发布、打包、签名与社区市场索引接入指南。

---

## 五、勘误与更新（2026-08，已对照真实源码核对）

上文为初版调研，以下条目与真实情况存在出入，**以本勘误为准**：

1. **没有内置插件市场。** `ctx.pluginInventory`（`packages/host/plugin-inventory`）只是只读清单。真实安装 = `dsh plugin --profile <p> add <path>` 或 `dsh --patch`。"dsh-market / awesome-dsh-plugin 官方推荐市场"中的"官方"不成立——它们是社区第三方注册表。参见 `docs/PUBLISHING_GUIDE.md`。
2. **`dsh.bundle` 是对象** `{ "patch": "./cordis.patch.yml" }`，不是字符串。写成字符串 dsh 不识别。
3. **`cordis.patch.yml` 规范写法**是顶层 `- insert:` 行数组（`dsh-notification` 已验证），或直接 `- id:` 行。
4. **插件不能通过 `(ctx as any).directoryPicker = {...}` 覆盖服务**——绕过 Cordis 服务机制。真实 seam 需 subclass `DirectoryPicker extends Service`。**且仓库已自带 `directory-picker-native`**，"原生目录选择器"不是差异化点。
5. **审批/提问的 seam 是 `ctx.userQuestions`（唯一 provider，注册第二个抛 `DUPLICATE_PROVIDER`）**，默认由 `api-gateway` 行持有。因此本插件采用**客户端方案**：订阅 mux 流 `question/requested` → `PendingWait.answer()` 通道，而非注册自己的 provider。
6. **发布的 npm 运行时比仓库 master 旧**：`shell.overlay` 插槽只在 master，`@deepseek-ai/dsh-client-*@0.0.1-rc.1` 没有它。浮动 HUD 因此未实现（备件组件已移除，插槽发布后再评估）。
7. **npm rc 生态有断依赖**：6 个未发布的内部包（`dsh-compact`、`dsh-type-meta`、`dsh-user-interaction`、`dsh-paths`、`dsh-tasks`、`dsh-client-ui-slash`）。本仓库用 `stubs/` type-stub + pnpm workspace override 绕过（详见 `pnpm-workspace.yaml`）。
8. **客户端 bundle 是单文件 + ModuleLoader 握手**，不是普通 ESM：`window.__ModuleLoader__.load({ id, factory })`，esbuild `banner`/`footer` 实现（见 `build.mjs`）。
9. **桌面外壳已从 Tauri 迁移到 Electron**：初版设想的 Tauri 2.0 + Rust 方案（`packages/dsh-desktop-app`）已被 `packages/dsh-desktop-electron` 取代——Electron 主进程内嵌 cordis host 直接运行 dsh 运行时，插件与外壳统一走 `__DSH_DESKTOP_BRIDGE__` 单一 IPC 通道。上文涉及 Tauri 的描述均已按此更新。
