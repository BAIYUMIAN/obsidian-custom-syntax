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
3. 填写**规则名**和**分隔符**（如 `++`）。
4. 可选填写**类名**（如 `my-highlight`），如果你希望通过 CSS 片段而非行内声明来控制样式。
5. 在**样式声明**里只写 CSS 花括号 `{ }` 里的内容——每行一条声明，不需要写选择器：

   ```css
   border: 1px solid var(--interactive-accent);
   border-radius: 6px;
   padding: 1px 5px;
   ```

6. 在笔记中输入 `++文字++` 即可。

每条规则是一张卡片，右侧有编辑、删除，以及启用/禁用开关。当规则与其它规则（或内置 Markdown 语法）冲突时，会在创建前提示你。

样式声明输入框是一个小型 CodeMirror 编辑器：语法高亮、属性与值补全（含 Obsidian 自带的 CSS 变量）、括号与引号自动配对、撤销历史、多光标、`Tab` 缩进、`Ctrl/Cmd+Enter` 保存。

> **提示：** 你不需要写选择器——插件会把你的声明包进规则自己的类里。一对中间没有内容的分隔符（如 `++++`）会被忽略，不会破坏渲染。

## 两种方式给规则加样式

### 一、样式声明（快捷）

直接在规则里写声明，它们会以行内样式应用，规则立即生效，无需任何额外设置。

### 二、类名（可复用、可被主题覆盖）

给规则填一个**类名**（如 `my-highlight`），并把**样式声明留空**。此时插件只给匹配文字挂 class，完全不写行内样式，外观由你自己在 CSS 片段里写的规则决定：

```css
.my-highlight {
	color: var(--color-red);
	background-color: var(--text-highlight-bg);
	border-radius: 3px;
}
```

```markdown
++这段文字++ 会带上这个类
```

每个匹配还会额外带上一个公共类（`.custom-syntax-content`）和一个按规则固定的类（`.custom-syntax-<id>-content`），因此片段既能一次性命中所有匹配，也能精确命中某一条规则。

类样式支持行内样式做不到的东西——`:hover`、伪元素、媒体查询、被主题覆盖——还能让多条规则共用一份样式。

### 如何把已有规则迁移到类样式

1. 点击设置页底部的 **导出**。
2. 把生成的 CSS 粘到 **设置 → 外观 → CSS 片段** 里的一个片段文件中，并启用。
3. 清空该规则的**样式声明**（保留类名）。

之后样式就完全由片段接管了。

> **注意：** 只要规则里还写着声明，它们就会以行内样式优先生效、盖过片段。想让片段说了算，请清空声明，或在片段里使用 `!important`。

## 声明示例

下面的每条示例都和你在声明框里写的一模一样——只有声明、没有选择器：

- 圆角边框：

  ```css
  border: 1px solid var(--interactive-accent);
  border-radius: 6px;
  padding: 1px 5px;
  ```

- 高亮：

  ```css
  background-color: var(--text-highlight-bg);
  border-radius: 3px;
  ```

- 红色文字：

  ```css
  color: red;
  font-weight: bold;
  ```

- 下划线：

  ```css
  text-decoration: underline;
  ```

## 后续计划

- **可视化编辑**——一种图形化、无需手写 CSS 就能调整规则样式的方式，目前以声明框右侧一个禁用的「可视化编辑」按钮呈现，暂未上线。

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
