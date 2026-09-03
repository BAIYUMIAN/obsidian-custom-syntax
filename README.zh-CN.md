# Custom Syntax

> [English](README.md)

一个 [Obsidian](https://obsidian.md) 插件，让你自定义**行内与块级语法**，并用**你自己的 CSS** 渲染它们——享受与内置 Markdown 一致的**原生实时预览**体验。

用你定义的分隔符包裹文字（例如 `++文字++`），或用 `:::note … :::` 标记一整块，它就会立即以你指定的 CSS 渲染。标记（分隔符）在光标移出时自动隐藏、光标进入时淡色显示——就像 Obsidian 原生的 `**粗体**` 或 `~~删除线~~` 一样。

## 特性

- 自定义任意**行内分隔符**，映射到任意 CSS 样式
- 自定义**块级语法**，四种形态：围栏块（`:::类型`）、多行块（`++ … ++`）、自定义 Callout（`> [!类型]`）、行内配对
- 可选**参数捕获**——`{ .类名 #id 键=值 }` 动态套用
- Live Preview / 源码模式原生实时预览（编辑时标记淡色显示）
- 阅读视图渲染，自动跳过代码块、行内代码、链接、公式
- 与 Markdown 内置语法（如 `**`、`==`、`` ` ``）及其他自定义规则做冲突检测
- 内置可查询的**语法索引**（含可选的 Dataview 可读伴生文件）
- 中英双语界面，支持「跟随系统」语言

## 原理

插件从不改写你的 Markdown 源码，而是使用官方扩展点：

- **Live Preview / 源码模式**——通过 CodeMirror 6 编辑器扩展（`registerEditorExtension`）应用装饰，与 Obsidian 渲染自身语法的机制相同。块级标记会以淡色强调显示，让你知道它已被识别。
- **阅读视图**——通过 Markdown 后处理器（`registerMarkdownPostProcessor`）把匹配的块重组为带样式的容器，并装饰行内匹配，跳过代码块、行内代码、链接、公式。

> 插件只做视觉装饰，不新增真正的 Markdown AST 节点，因此复制到其它编辑器或导出时分隔符原样保留。

## 使用方法

1. 打开 **设置 → Custom Syntax**（或右侧边栏规则管理器）。
2. 点击 **添加规则**。
3. 选择**语法类别**：行内配对 / 围栏块 / 多行块 / 自定义 Callout。
4. 填写**标记**（如 `++` 或 `:::`）与**规则名**。
5. 在**样式声明**里只写 CSS 花括号 `{ }` 里的内容——每行一条声明，不需要写选择器：

   ```css
   border: 1px solid var(--interactive-accent);
   border-radius: 6px;
   padding: 1px 5px;
   ```

6. 在笔记中输入你的语法即可。

每条规则是一张卡片，右侧有编辑、删除，以及启用/禁用开关。当规则与其它规则（或内置 Markdown 语法）冲突时，会在创建前提示你。

## 块级语法

四种类别在编辑器（标记高亮）与阅读视图（带样式的容器）中都会渲染：

```markdown
++行内文字++

:::note
这是围栏块。
:::

++

这是多行块
跨两行。

++

> [!mynote]
这是自定义 callout（由插件加样式）
```

- **围栏块**——Pandoc 式 `:::类型 … :::`。开启「读取类型」后，类型成为类名钩子（如 `:::note` → `.cs-fence-note`），CSS 片段可按类型精确定制。
- **多行块**——起始标记独占一行，结束标记也独占一行。
- **自定义 Callout**——`> [!类型]` 触发 Obsidian 原生 callout 盒子，插件仅加你的类名/样式。
- **捕获参数**——开启开关后，在标记后写 `{ .类名 #id 键=值 }`：`:::note { .box #main color=red } … :::` 会加上类 `box`、id `main` 与 `color: red`。

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

每个匹配还会额外带上一个公共类（`.custom-syntax-content`）和一个按规则固定的类（行内为 `.custom-syntax-<id>-content`，块级为 `.cs-block-<id>`），因此片段既能一次性命中所有匹配，也能精确命中某一条规则。

类样式支持行内样式做不到的东西——`:hover`、伪元素、媒体查询、被主题覆盖——还能让多条规则共用一份样式。

### 如何把已有规则迁移到类样式

1. 点击设置页底部的 **导出**。
2. 把生成的 CSS 粘到 **设置 → 外观 → CSS 片段** 里的一个片段文件中，并启用。
3. 清空该规则的**样式声明**（保留类名）。

之后样式就完全由片段接管了。

> **注意：** 只要规则里还写着声明，它们就会以行内样式优先生效、盖过片段。想让片段说了算，请清空声明，或在片段里使用 `!important`。

## 语义索引与伴生文件（实验性）

当你打开或编辑笔记时，插件会懒加载建立自有索引，记录每条规则在何处匹配。其它插件可通过插件实例的 `syntaxIndex` API 读取——**绝不修改 Obsidian 元数据缓存**，因此能随版本更新长期可用。

命令面板中的 **Generate syntax metadata companion** 会为当前笔记生成 `<笔记名>.cs-meta.md` 伴生文件，内含 Dataview 可读的内联字段（`cs-rule::`、`cs-kind::`、`cs-line::`、`cs-type::`），使你的自定义标记可被 Dataview 查询。该伴生文件为额外生成，可随时删除。

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

## 已知限制

- 插件只做视觉装饰，不新增真正的 Markdown AST 节点；复制到 Typora 或 Pandoc 导出时分隔符原样保留。
- 嵌套块级语法为有限支持；代码块与公式内部不渲染。
- 「可视化编辑」按钮为占位，尚未开放。

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
