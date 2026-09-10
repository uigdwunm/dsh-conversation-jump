# dsh-conversation-jump

为 DSH Web 对话区增加一组圆形导航按钮：回到顶部、上一条用户消息、下一条用户消息、回到底部。按钮横向悬浮在输入框上方、对话内容右缘，并替换产品自带的单个“回到底部”按钮。

**与同类插件的区别**：本插件不做缩略图（minimap）、不做目录（TOC）、不做行内锚点标记，而是**按「用户消息」这个语义单位逐条前后跳转**——一次点击精确落到上一条/下一条提问，并自动处理更早历史的分页加载。导航目标只包含 `user` 与 `steering`，会跳过工具调用、上下文注入、压缩标记和其他过程节点。

插件只维护页面内存状态，不使用 `localStorage`、IndexedDB、文件或后端数据库。

## 安装

### 从 npm 安装

```sh
dsh plugin --profile web add dsh-conversation-jump
# 重启 dsh web 后生效
```

### 从 GitHub 安装（未发布 npm 时）

```sh
dsh plugin --profile web add github:uigdwunm/dsh-conversation-jump
# 重启 dsh web 后生效
```

### 本地开发安装

```sh
npm install
npm run build

# 安装到 web profile（重启 dsh web 后生效）
dsh plugin --profile web add file:/绝对路径/dsh-conversation-jump
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

## 命名说明

npm 上 `dsh-conversation-nav` 这一名称已由其他作者占用（非本仓库），因此本包发布名为 `dsh-conversation-jump`。仓库名与包名一致。

## 发布

```sh
npm login                      # 需要 npm 账号
npm publish                    # prepublishOnly 会自动执行构建
```

> `repository` 字段必须指回本 GitHub 仓库：awesome-dsh-plugin 的 npm 探测脚本只在「npm 包存在 **且** 其 `repository` 指向同一仓库」时才认领，否则不会关联，也就拿不到下载量排序与 npm 安装入口。

## 收录渠道

- **GitHub `dsh-plugin` topic**：已添加，会被各类插件市场自动同步收录。
- **awesome-dsh-plugin**：向 [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 提 PR，新增 `data/plugins/uigdwunm__dsh-conversation-jump.yml` 一个文件（分类 `ui`），**不要手工编辑生成的 README**。

## 结构

| 文件 | 作用 |
|---|---|
| `package.json` | DSH bundle/client 声明、exports、元数据与构建脚本 |
| `cordis.patch.yml` | 把插件挂进 web profile 组合 |
| `index.mjs` | Host half（浏览器 UI 插件，空 apply） |
| `src/client.ts` | 浏览器端导航、分页、定位与显示策略 |
| `build.mjs` | esbuild 浏览器构建与 ModuleLoader 包装 |
| `lib/client.js` | 构建产物（发布时包含） |
