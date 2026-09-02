# Custom Syntax

> [English](README.md)

一个 [Obsidian](https://obsidian.md) 插件，让你自定义**行内语法分隔符**，并用**你自己的 CSS** 渲染它们——享受与内置 Markdown 一致的**原生实时预览**体验。

用你定义的分隔符包裹文字（例如 `++文字++`），它就会立即以你指定的 CSS 渲染。标记（分隔符）在光标移出时自动隐藏、光标进入时淡色显示——就像 Obsidian 原生的 `**粗体**` 或 `~~删除线~~` 一样。

## 特性

- 自定义任意行内分隔符，映射到任意 CSS 样式
- Live Preview / 源码模式原生实时预览
- 分隔符自动隐藏，光标进入时淡色显示，便于编辑
- 阅读视图渲染，自动跳过代码块、行内代码、链接、公式
- 与 Markdown 内置语法（如 `**`、`==`、`` ` ``）及其他自定义规则做冲突检测
- 中英双语界面，支持「跟随系统」语言

## 原理

插件从不改写你的 Markdown 源码，而是使用两个官方扩展点：

- **Live Preview / 源码模式**——通过 CodeMirror 6 编辑器扩展（`registerEditorExtension`）应用装饰，与 Obsidian 渲染自身语法的机制相同。
- **阅读视图**——通过 Markdown 后处理器（`registerMarkdownPostProcessor`）渲染内容，并跳过代码块、行内代码、链接、公式。

## 使用方法

1. 打开 **设置 → Custom Syntax**。
2. 点击 **添加规则**。
3. 填写**规则名**、**分隔符**（如 `++`）和 **CSS**（如 `border: 1px solid var(--interactive-accent); border-radius: 6px; padding: 1px 5px;`）。
4. 在笔记中输入 `++文字++` 即可。

每条规则是一张卡片，支持启用/禁用、编辑、删除。当规则与其它规则（或内置 Markdown 语法）冲突时，会在创建前提示你。

## CSS 示例

- 圆角边框：`border: 1px solid var(--interactive-accent); border-radius: 6px; padding: 1px 5px;`
- 高亮：`background-color: var(--text-highlight-bg); border-radius: 3px;`
- 红色文字：`color: red; font-weight: bold;`
- 下划线：`text-decoration: underline;`

## 安装

从 Obsidian 社区插件目录安装，或手动安装：

1. 从最新 release 下载 `main.js`、`manifest.json`、`styles.css`。
2. 放入仓库的 `.obsidian/plugins/custom-syntax/` 目录。
3. 在 **设置 → 第三方插件** 中启用。

## 开发

```bash
npm install
npm run dev     # 监听模式
npm run build   # 类型检查 + 生产打包到 main.js
```

## 发布

`.github/workflows/release.yml` 工作流会在你推送与 `manifest.json` 版本号一致的 tag 时，自动构建并生成草稿 release。
