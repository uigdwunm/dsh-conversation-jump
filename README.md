# dsh-conversation-nav

为 DSH Web 对话区增加一组圆形导航按钮：回到顶部、上一条用户消息、下一条用户消息、回到底部。按钮横向悬浮在输入框上方、对话内容右缘，并替换产品自带的单个“回到底部”按钮。

插件只维护页面内存状态，不使用 `localStorage`、IndexedDB、文件或后端数据库。

## 安装

### 从 npm 安装（发布后）

```sh
dsh plugin --profile web add dsh-conversation-nav
# 重启 dsh web 后生效
```

### 本地构建安装

```sh
# 在仓库根目录构建
pnpm --filter dsh-conversation-nav build

# 安装到 web profile（重启 dsh web 后生效）
dsh plugin --profile web add file:./packages/dsh-conversation-nav
```

## 能力

| 能力 | 行为 |
|---|---|
| 回到顶部 | 先滚到当前顶部，再自动连续加载所有更早历史，直到真正顶部 |
| 上一个 | 跳到上一条用户消息；遇到分页会先到顶部再自动加载更早 |
| 下一个 | 跳到下一条用户消息 |
| 回到底部 | 直接到最新位置 |
| 消息锚点 | 目标消息停在视口上方约 `1/12` 处 |
| 显示策略 | 默认隐藏；往上平均速度超过 `200 px/s` 显示并保持，往下滚隐藏 |
| 定位 | 对齐对话内容右缘、输入框上方 16px；绘制前同步定位避免闪动 |
| 状态 | 仅页面内存状态，不做持久化 |

导航目标只包含 `user` 与 `steering`，会跳过工具调用、上下文注入、压缩标记和其他过程节点。

## 发布

`repository` / `homepage` / `bugs` / `author` 为**可选字段**，npm 发布不强制；建议有公开 GitHub 仓库后补上，便于社区/市场收录。

```sh
npm login                      # 需要 npm 账号
cd packages/dsh-conversation-nav
npm publish                    # prepublishOnly 会自动执行构建
```

收录渠道：

- **GitHub `dsh-plugin` topic**：把包放进公开仓库并打上 `dsh-plugin` topic，会被 [dsh-plugin-marketplace](https://github.com/AwesomeHou/dsh-plugin-marketplace) 等市场自动同步收录，无需单独提交。
- **awesome-dsh-plugin**：向 [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 提 PR，在 README 加一条独立条目（分类：UI Enhancements）。

## 结构

| 文件 | 作用 |
|---|---|
| `package.json` | DSH bundle/client 声明、exports、元数据与构建脚本 |
| `cordis.patch.yml` | 把插件挂进 web profile 组合 |
| `index.mjs` | Host half（浏览器 UI 插件，空 apply） |
| `src/client.ts` | 浏览器端导航、分页、定位与显示策略 |
| `build.mjs` | esbuild 浏览器构建与 ModuleLoader 包装 |
| `lib/client.js` | 构建产物（发布时包含） |
