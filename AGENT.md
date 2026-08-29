# DeepSeek Harness Desktop (DSH Desktop) — Agent 协作与开发规范

> 本文档为项目顶层架构准则、功能规范与开发守则记录。所有 AI Agent 与开发者均需严格遵守。

---

## 一、协作与开发守则（Agent Rules）

1. **权限与代码落地铁律**：
   - **即使拥有最高读写与执行权限，严禁在未获得用户明确指令/命令前擅自修改或落地业务代码。**
   - 遵循先规划、先对齐设计，待用户确认并下达落地指令后，方可逐步推进实现。
2. **设置系统统一收敛原则（Settings First Principle）**：
   - **以后所有新增功能、用户偏好、交互控制项，必须统一定义并写入 DSH 原生设置系统**（前端接入 `@deepseek-ai/dsh-client-ui-settings` 的 `settings.section` 与 `settings.general.item` 插槽，后端接入 `ctx.settings` 与 Cordis 补丁校验）。
   - 禁止在页面各处散落临时、不可持久化或无统一样式的独立配置弹窗。

---

## 二、本地 ChatGPT 桌面端深度剖析与对标参考

通过对本地安装的官方 ChatGPT 桌面端（`OpenAI.Codex` / `ChatGPT.exe`）逆向与架构分析，总结以下桌面伴侣核心机制与设计参考：

### 1. 架构与资源组织
- **宿主与辅进程分离**：核心 UI 基于轻量化 WebView/Electron 容器，底层搭配高性能辅助可执行程序（CLI runner, sandbox host, notification helpers）。
- **音频与托盘资源**：内嵌专属系统通知音效（`codex-notification.wav`）及高对比度托盘图标（`dark/light` 动态适应），在任务完成或等待审批时通过声画双重反馈。

### 2. 桌面伴侣交互机制（Companion HUD）
- **常驻与快捷唤醒**：提供全局快捷键（如 `Alt + Space`）即时呼出悬浮伴侣胶囊/小窗，支持无缝切换“紧凑伴侣态”与“完整工作台态”。
- **系统上下文联动**：支持全局截屏直投、剪贴板监控以及多屏吸附。
- **状态可视化感知**：伴侣具备清晰的交互状态反馈：
  - `Idle`（空闲巡航/待命）
  - `Thinking`（Agent 深度推理/流式生成）
  - `Executing`（工具调用/命令执行）
  - `WaitingApproval`（等待用户确认/回答，高亮并播放提示音）
  - `Error / Warn`（任务异常反馈）

### 3. 原生设置（Settings）整合标准
- 桌面端的所有行为（快捷键、开机启动、伴侣悬浮窗置顶/透明度、音频反馈开关、截屏权限等）全部收敛于原生统一设置面板中，分类清晰、持久化安全。

---

## 三、DSH 宠物/桌面伴侣系统（Desktop Pet & Companion）设计规范

### 1. 系统架构定位
- **宿主层（Electron 主进程）**：负责独立无边框透明悬浮窗（`pet-window`）、置顶（Always-on-top）、鼠标穿透与拖拽吸附、全局快捷键与原生系统通知/音效。
- **扩展层（Cordis Plugin）**：
  - **Host 端**：提供配置 Schema、权限守卫与系统能力。
  - **Client 端**：监听 DSH 事件总线（`turn/start`, `step/start`, `tools/execute`, `question/requested`, `turn/end`），驱动伴侣动画与状态机，并注册原生设置插槽。

### 2. 状态映射契约
| DSH 会话生命周期事件 | 伴侣状态 (Pet State) | 动画/表现形式 | 辅助反馈 |
| :--- | :--- | :--- | :--- |
| 无活动 / 会话静止 | `Idle / Sleep` | 待机呼吸、微动小动作、眨眼 | 静音 |
| `turn/start` -> `step/start` (LLM 流式) | `Thinking` | 思考光晕、转圈、阅读/计算动画 | 状态提示 |
| `tool/call` -> `tools/execute` | `Working / ToolUse` | 搬砖/敲代码/工具微动画 | 进度气泡 |
| `question/requested` / 审批等待 | `Alert / Waiting` | 弹跳提示、举手提问、伴侣发光 | 原生通知 + 提示音效 |
| `turn/end` (任务完成) | `Success / Cheerful` | 开心庆祝、比心/点赞动画 | 任务完成提示音 |
| 异常报错 / 终端失败 | `Confused / Error` | 困惑抓头/感叹号 | 托盘状态报警 |

---

## 四、原生设置（Settings）接入技术标准

DSH 插件需严格通过插槽协议向原生设置注入控制面：

```typescript
// Client 端注册桌面与伴侣设置专区
ctx.slots.register(
  {
    name: 'settings.section',
    id: 'desktop-companion',
    order: 30,
    locale: 'desktop',
    label: () => t('settings.section.title'), // "桌面与伴侣设置"
  },
  DesktopCompanionSettingsSection,
);
```

### 设置项清单设计
1. **基础设置**：
   - 开机自动启动桌面伴侣
   - 伴侣常驻桌面（总在最前 Always on Top）
   - 伴侣窗口尺寸与透明度调节（Opacity: 50% ~ 100%）
   - 鼠标穿透模式（Click-through）与拖拽锁定
2. **交互与音效**：
   - 全局呼出热键（默认 `Alt + Space`）
   - 任务完成提示音（开启/关闭、音量）
   - 敏感权限与人机交互提问强提醒（声画联动）
3. **宠物形象与个性**：
   - 伴侣形态切换（极简灵动胶囊 / 像素数码兽 / Live2D / 机械球体）
   - 伴侣互动问候与状态提示语风格（专业沉稳 / 活泼搞怪 / 极简静音）
4. **工具权限与安全**：
   - 屏幕截图工具授权（`screen_capture` 显式开关）
