# dsh-conversation-jump

[![release](https://img.shields.io/github/v/release/uigdwunm/dsh-conversation-jump?style=flat)](https://github.com/uigdwunm/dsh-conversation-jump/releases)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-blue)](https://github.com/topics/dsh-plugin)
[![license: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

English | [中文](#中文)

A rail of four circular buttons for the DSH Web conversation: **to top**, **previous user message**, **next user message**, **to bottom**. It floats above the composer at the right edge of the conversation, and replaces the product's single built-in "to bottom" button.

## What makes it different

Sibling plugins mostly draw a **minimap**, a **table of contents**, or **inline anchors**. This one does none of that. It steps through the conversation **one user message at a time** — a click lands exactly on the previous or next thing *you* asked — and pages older history in automatically when the target sits outside the loaded window.

Navigation targets are only `user` and `steering` entries. Tool calls, context injections, compaction markers and other process nodes are skipped, so "previous" means "my previous question", not "the previous DOM block".

## Install

```sh
# From npm
dsh plugin --profile web add dsh-conversation-jump

# From GitHub, when you want the source
dsh plugin --profile web add github:uigdwunm/dsh-conversation-jump

# From the prebuilt release tarball (nothing to build locally)
dsh plugin --profile web add https://github.com/uigdwunm/dsh-conversation-jump/releases/download/v0.1.3/dsh-conversation-jump-0.1.3.tgz
```

Restart `dsh web` afterwards.

`dsh plugin` is a thin forwarder to `pnpm` in the profile directory, so a plain registry name, a `github:` spec and a remote tarball URL all work. This package declares no `prepare` script, so no `allowBuilds` entry is needed for the GitHub or tarball route.

### Local development

```sh
npm install
npm run build

# install into the web profile; restart dsh web afterwards
dsh plugin --profile web add file:/absolute/path/dsh-conversation-jump
```

## Capabilities

| Capability | Behaviour |
|---|---|
| To top | Scrolls to the current top, then keeps paging older history in until the real top is reached |
| Previous | Jumps to the previous user message; if it lies beyond the loaded window, it goes to the top and pages older history in first |
| Next | Jumps to the next user message |
| To bottom | Goes straight to the newest position |
| Message anchor | The target message settles about `1/12` down from the top of the viewport |
| When it appears | Hidden by default; appears when the average upward scroll speed exceeds `200 px/s`, hides again as soon as you scroll down |
| Auto-hide | Disappears `5 s` after appearing; clicking any button restarts that countdown |
| Position | Aligned to the right edge of the conversation and `12 px` above the composer, positioned synchronously before paint so it does not flash |
| State | Page-memory only — nothing persisted |

Button labels are Chinese (`回到顶部` / `上一个` / `下一个` / `回到底部`); each button carries the same text as both its `title` and `aria-label`, and the rail is a `role="toolbar"` labelled `会话导航`.

## Implementation notes

- **Targeting is attribute-based, not hash-based.** The scrollport is `[data-conversation-scroll]`, user messages are `[data-chat-anchor-key]` filtered by `data-chat-flow-kind`, and the composer seat is `[data-composer-seat]`. The built-in "to bottom" button is hidden by matching the stable `_toBottomSlot` class **suffix** rather than a CSS-module hash, so a DSH upgrade that rehashes class names does not break it.
- **Paging drives the product's own control.** It locates the "load older" button inside `[data-chat-flow]` — the first button that is not inside a message row and precedes the first row — clicks it, then polls the anchor count until it grows. Attempts are bounded, so a host that never grows the list cannot spin forever.
- **Only the `slots` seat is injected.** `cordis-plugin-timer` is host-only and absent in the web client, so the plugin declares `inject: ['slots']` and uses native `setTimeout` / `setInterval`, tracking every handle so disposal cancels them.
- **The stylesheet heals itself.** It lives in a `<style data-dsh-conversation-nav>` node owned by the fiber, but every 100 ms sample checks the view and recreates the node when it is missing. A fiber re-apply that removes the styles (for example the dev-mode HMR driver rebuilding this plugin) therefore cannot leave the rail unstyled in the page's top-left corner with the product's own "to bottom" button reappearing while the rail is still mounted — it recovers on the next sample instead of needing a page refresh.
- **Everything is cleaned up on unload**: the style element, every pending timer, and the scroll listener.

## Boundaries

- This is a **Web UI plugin only**. The host half (`index.mjs`) is an empty `apply` — no host services, events, tools or storage.
- It keeps **page-memory state only**: no `localStorage`, IndexedDB, cookies, files or backend database.
- If the host never renders a "load older" button, paging cannot proceed and the jump stops there rather than looping.

## Development

```sh
npm run build       # esbuild bundles src/client.ts into lib/client.js
npm run typecheck   # tsc --noEmit
```

## Publishing

```sh
npm login      # requires an npm account
npm publish    # prepublishOnly runs the build first
```

> The `repository` field must point back at this GitHub repo. `awesome-dsh-plugin`'s npm probe only claims a package when the package exists **and** its `repository` points at the same repo — otherwise there is no download-count sorting and no npm install entry.

## Getting listed

- **GitHub `dsh-plugin` topic** — already set; plugin markets sync from it.
- **awesome-dsh-plugin** — open a PR adding `data/plugins/uigdwunm__dsh-conversation-jump.yml` (category `ui`) to [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin). That repo's READMEs are generated from the data files — do not edit them by hand.

## Naming

The npm name `dsh-conversation-nav` is taken by another author (not this repo), so this package is published as `dsh-conversation-jump`. Repo name and package name match.

## Structure

| File | Purpose |
|---|---|
| `package.json` | DSH bundle/client declaration, exports, metadata and build scripts |
| `cordis.patch.yml` | Mounts the plugin into the web profile composition |
| `index.mjs` | Host half (browser-only plugin, empty apply) |
| `src/client.ts` | Browser-side navigation, paging, positioning and visibility policy |
| `build.mjs` | esbuild browser build and ModuleLoader wrapper |
| `lib/client.js` | Build output (shipped with the package) |

## License

MIT — see [LICENSE](LICENSE).

---

## 中文

DSH Web 对话区的一组圆形导航按钮：**回到顶部**、**上一条用户消息**、**下一条用户消息**、**回到底部**。它悬浮在输入框上方、对话内容右缘，并替换产品自带的单个“回到底部”按钮。

### 与同类插件的区别

同类插件大多在做**缩略图（minimap）**、**目录（TOC）**或**行内锚点**。本插件都不做，而是**按「用户消息」这个语义单位逐条前后跳转**——一次点击精确落到上一条或下一条你提过的问题，并在目标超出已加载窗口时自动翻页加载更早历史。

导航目标只包含 `user` 与 `steering` 两类条目，会跳过工具调用、上下文注入、压缩标记和其他过程节点。所以“上一条”指的是“我上一个问题”，而不是“上一个 DOM 块”。

### 安装

```sh
# 从 npm 安装
dsh plugin --profile web add dsh-conversation-jump

# 从 GitHub 安装（需要源码时）
dsh plugin --profile web add github:uigdwunm/dsh-conversation-jump

# 从预构建 Release 包安装（无需本地构建）
dsh plugin --profile web add https://github.com/uigdwunm/dsh-conversation-jump/releases/download/v0.1.3/dsh-conversation-jump-0.1.3.tgz
```

安装后重启 `dsh web` 生效。

`dsh plugin` 只是把参数转发给 profile 目录里的 `pnpm`，因此「registry 包名」「`github:` 规格」「远程 tarball URL」三种写法都可用。本包没有声明 `prepare` 脚本，所以走 GitHub 或 tarball 路线都不需要额外配置 `allowBuilds`。

### 本地开发安装

```sh
npm install
npm run build

# 安装到 web profile，重启 dsh web 后生效
dsh plugin --profile web add file:/绝对路径/dsh-conversation-jump
```

### 能力

| 能力 | 行为 |
|---|---|
| 回到顶部 | 先滚到当前顶部，再持续翻页加载更早历史，直到真正的顶部 |
| 上一个 | 跳到上一条用户消息；若它在已加载窗口之外，会先到顶部并自动加载更早历史 |
| 下一个 | 跳到下一条用户消息 |
| 回到底部 | 直接到最新位置 |
| 消息锚点 | 目标消息停在视口上方约 `1/12` 处 |
| 显示策略 | 默认隐藏；往上平均速度超过 `200 px/s` 时显示，往下滚动立即隐藏 |
| 自动隐藏 | 出现后 `5 秒`无点击自动消失；点击任一按钮重新计时 |
| 定位 | 对齐对话内容右缘、输入框上方 `12 px`；绘制前同步定位以避免闪动 |
| 状态 | 仅页面内存状态，不做持久化 |

### 实现说明

- **定位基于数据属性而非哈希类名。** 滚动容器是 `[data-conversation-scroll]`，用户消息是 `[data-chat-anchor-key]` 并按 `data-chat-flow-kind` 过滤，输入区是 `[data-composer-seat]`。产品自带的“回到底部”按钮通过匹配稳定的 `_toBottomSlot` 类名**后缀**隐藏，而不是写死 CSS-module 哈希，因此 DSH 升级重新生成类名不会失效。
- **翻页走产品自身的控件。** 在 `[data-chat-flow]` 中定位“加载更早”按钮（第一个不在消息行内、且位于首行之前的按钮）并点击它，然后轮询锚点数量直到增长；尝试次数有上限，宿主始终不增长列表时也不会空转。
- **只注入 `slots` 一个席位。** `cordis-plugin-timer` 是纯 Host 服务，在 Web 端不存在，因此插件声明 `inject: ['slots']` 并使用原生 `setTimeout` / `setInterval`，同时记录每个句柄以便卸载时取消。
- **样式会自愈。** 样式挂在 fiber 拥有的 `<style data-dsh-conversation-nav>` 节点上，但每 100ms 采样都会检查它是否还在，缺失就重新创建。因此当 fiber 被重新 apply 而移除样式时（例如 dev 模式下 HMR 重建本插件），不会出现“导航条仍挂着却变成页面左上角的无样式按钮、产品自带『回到底部』同时回来”的状态——下一个采样周期就恢复，不需要刷新页面。
- **卸载时全部清理**：样式元素、所有待执行定时器、滚动监听。

### 边界

- 这是**纯 Web UI 插件**。Host 半边（`index.mjs`）是空的 `apply`——不需要 Host 服务、事件、工具或存储。
- 只维护**页面内存状态**：不使用 `localStorage`、IndexedDB、Cookie、文件或后端数据库。
- 若宿主始终没有渲染“加载更早”按钮，翻页无法进行，跳转会就此停止，不会死循环。

### 开发

```sh
npm run build       # 用 esbuild 把 src/client.ts 打包到 lib/client.js
npm run typecheck   # tsc --noEmit
```

### 发布

```sh
npm login      # 需要 npm 账号
npm publish    # prepublishOnly 会先执行构建
```

> `repository` 字段必须指回本 GitHub 仓库。awesome-dsh-plugin 的 npm 探测只在「npm 包存在 **且** 其 `repository` 指向同一仓库」时才认领，否则拿不到下载量排序与 npm 安装入口。

### 收录渠道

- **GitHub `dsh-plugin` topic**：已添加，各类插件市场会据此同步收录。
- **awesome-dsh-plugin**：向 [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 提 PR，新增 `data/plugins/uigdwunm__dsh-conversation-jump.yml` 一个文件（分类 `ui`）。**该仓库的 README 由数据文件生成，不要手工编辑。**

### 命名说明

npm 上 `dsh-conversation-nav` 这一名称已被其他作者占用（非本仓库），因此本包发布名为 `dsh-conversation-jump`。仓库名与包名一致。

### 结构

| 文件 | 作用 |
|---|---|
| `package.json` | DSH bundle/client 声明、exports、元数据与构建脚本 |
| `cordis.patch.yml` | 把插件挂进 web profile 组合 |
| `index.mjs` | Host 半边（浏览器 UI 插件，空 apply） |
| `src/client.ts` | 浏览器端导航、分页、定位与显示策略 |
| `build.mjs` | esbuild 浏览器构建与 ModuleLoader 包装 |
| `lib/client.js` | 构建产物（发布时包含） |

### 许可证

MIT，见 [LICENSE](LICENSE)。
