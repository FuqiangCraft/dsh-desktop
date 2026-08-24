# @mixian/dsh-desktop-plugin 发布指南

> 基于对真实 deepseek-harness 源码与 npm 生态的核对（2026-08）。**dsh 没有内置插件商店**：`ctx.pluginInventory` 只是只读的已加载插件清单。"市场"由社区注册表 + GitHub topic 组成。

## 一、包结构规范（决定能否被 dsh 识别）

```jsonc
{
  "name": "@mixian/dsh-desktop-plugin",
  "type": "module",
  "main": "lib/index.js",
  "exports": {
    ".":       { "types": "./lib/types/index.d.ts",         "default": "./lib/index.js"  },
    "./client":{ "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" }
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },   // 注意：必须是对象，不是字符串
    "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-runtime", "…"] }
  },
  "files": ["lib", "cordis.patch.yml", "dsh.plugin.json", "README.md"]
}
```

**关键规则（全部从真实源码核对）：**
1. `dsh.bundle` 是对象 `{ "patch": "./cordis.patch.yml" }`。写成字符串 dsh 不会识别。
2. `dsh.client` 声明浏览器端，需要 `./client` 导出，加载路径 `/plugins/<id>/client.js`。
3. **客户端 bundle 必须是单文件 + 特殊握手**：web 服务器每个插件只服务一个 `client.js`，格式为
   ```js
   window.__ModuleLoader__.load({ id: "<包名>", factory: (require) => { … return module.exports } })
   ```
   用 esbuild 的 `banner`/`footer` 即可（见 `build.mjs`）。
4. `cordis.patch.yml` 用顶层 `- insert:` 行数组（`dsh-notification` 插件验证过的写法）：
   ```yaml
   - insert:
       - id: dsh-desktop-plugin
         name: '@mixian/dsh-desktop-plugin'
   ```
5. `dsh.plugin.json` 为插件清单文件（注册表收录时用于识别）。

## 二、真实安装方式

```sh
# 推荐：装进 profile（会写入 profile 的 node_modules）
dsh plugin --profile web add @mixian/dsh-desktop-plugin

# 或临时覆盖（不安装）
dsh web --patch ./path/to/cordis.patch.yml
```

## 三、生态发现与"上架"

- **GitHub topic**：仓库打 `dsh-plugin`（必需）、`deepseek-harness`、`cordis-plugin`。
- **社区注册表**（这就是实际的市场）：
  - `jqueryscript/awesome-dsh-plugins` — 截至 2026-08，收录门槛为 ≥50 stars，并要求可识别的 `dsh.bundle` manifest、bundle patch、插件入口和文档化安装路径；提交前应再次核对其最新规则。
  - `beancookie/awesome-dsh-plugin`、`wgd753/awesome-dsh-plugin`（按 topic 自动爬取）。
- `dsh-market`、`dsh-plugin-store` 是**社区第三方插件**，不是官方渠道。

## 四、npm 生态的已知坑（重要）

`@deepseek-ai/dsh-client-*@0.0.1-rc.1` 等 rc 包依赖 6 个**未发布**的内部包（`dsh-compact`、`dsh-type-meta`、`dsh-user-interaction`、`dsh-paths`、`dsh-tasks`、`dsh-client-ui-slash`）。本地开发用 workspace type-stub 覆盖（见仓库 `stubs/` + `pnpm-workspace.yaml` 的 `overrides`）。**发布插件给用户时，这些包是 peerDependencies，由用户侧的 dsh 提供，不随插件安装，因此不阻塞。**

## 五、构建与发布

```sh
pnpm --filter @mixian/dsh-desktop-plugin build   # esbuild host+client + tsc 类型
cd packages/dsh-desktop-plugin && npm pack --dry-run    # 检查 lib/*、cordis.patch.yml 等
npm publish --access public
```
