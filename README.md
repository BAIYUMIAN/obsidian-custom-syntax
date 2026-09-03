# Custom Syntax

> [中文说明](README.zh-CN.md)

An [Obsidian](https://obsidian.md) plugin that lets you define **custom inline and block syntax** and render it with **your own CSS** — with native, real-time preview, just like built-in Markdown.

Wrap text with a delimiter you define (e.g. `++text++`), or mark a whole block with `:::note … :::`, and it renders instantly with the CSS you specify. Markers are hidden until you place the cursor inside them — exactly like Obsidian's native `**bold**` or `~~strikethrough~~`.

## Features

- Define any **inline delimiter** and map it to arbitrary CSS.
- Define **block syntax** in four shapes: fenced blocks (`:::type`), multiline blocks (`++ … ++`), custom callouts (`> [!type]`), and inline pairs.
- Optional **parameter capture** — `{ .class #id key=value }` applied dynamically.
- Native real-time preview in Live Preview and Source mode (markers dim while editing).
- Reading-view rendering via a Markdown post-processor, skipping code blocks, inline code, links, and math.
- Conflict detection against built-in Markdown syntax (e.g. `**`, `==`, `` ` ``) and against your other custom rules.
- A built-in, queryable **syntax index** (with an opt-in Dataview-readable companion file).
- Bilingual UI (English / 中文), with "follow system" language detection.

## How it works

The plugin never rewrites your Markdown source. It uses official extension points:

- **Live Preview / Source mode** — a CodeMirror 6 editor extension (`registerEditorExtension`) applies decorations, the same mechanism Obsidian uses for its own syntax. Block markers are highlighted with a subtle accent so you can see them recognised.
- **Reading view** — a Markdown post-processor (`registerMarkdownPostProcessor`) restructures matched blocks into styled containers and styles inline matches, skipping code blocks, inline code, links, and math.

> The plugin only decorates — it does not add real Markdown AST nodes, so copying to other editors or exporting keeps your delimiters as-is.

## Usage

1. Open **Settings → Custom Syntax** (or the right-sidebar rule manager).
2. Click **Add rule**.
3. Pick a **syntax category**: inline pair / fenced block / multiline block / custom callout.
4. Fill in the **marker** (e.g. `++` or `:::`) and a **name**.
5. In **Style declarations**, write only what goes inside a CSS rule's curly braces `{ }` — one declaration per line, no selector needed:

   ```css
   border: 1px solid var(--interactive-accent);
   border-radius: 6px;
   padding: 1px 5px;
   ```

6. Type your syntax in a note.

Each rule is a card with edit, delete, and an enable/disable toggle. When a rule conflicts with another (or with built-in Markdown), you're warned before creating it.

## Block-level syntax

All four categories render in both the editor (marker highlight) and reading view (styled container):

```markdown
++inline text++

:::note
This is a fenced block.
:::

++

This is a multiline block
spanning two lines.

++

> [!mynote]
This is a custom callout (styled by the plugin)
```

- **Fenced block** — Pandoc-style `:::type … :::`. With *Read type* on, the type becomes a class hook (e.g. `:::note` → `.cs-fence-note`), so a CSS snippet can target it.
- **Multiline block** — a marker alone on its line opens, the same marker alone on a later line closes.
- **Custom callout** — `> [!type]` triggers Obsidian's native callout box; the plugin only adds your class/style.
- **Capture parameters** — with the toggle on, write `{ .class #id key=value }` after the marker:
  `:::note { .box #main color=red } … :::` adds the class `box`, the id `main`, and `color: red`.

## Block styling class model

In reading view, every block-level match is wrapped in a container `<div>` carrying a fixed set of classes, so you can target it precisely from a CSS snippet:

| Class | When | Purpose |
| --- | --- | --- |
| `.cs-block` | always | common container for all block syntax (a base box ships as a built-in default) |
| `.cs-block-<ruleId>` | always | pin a single rule (rule id is shown on its settings card) |
| `.cs-fence-<type>` | fenced blocks with *Read type* on | `:::note → .cs-fence-note`, `:::warning → .cs-fence-warning` … |

The plugin ships sensible default accent colours for the common types (left colour bar):
`note` (accent), `info` (blue), `tip`/`success` (green), `warning` (orange), `danger` (red),
`example` (purple), `quote` (grey). Any other type name works simply by writing `.cs-fence-<yourtype>`.

> **Gotcha: a rule's *declarations* are inline styles and override the type colours above.** If you write
> `border-left` in a rule's declaration, `:::note` and `:::warning` will show the same colour. To let type
> colours show, either drop `border-left` from the declaration (keep `padding`/`border-radius`) and let
> `.cs-fence-*` own the colour, or use `!important` in your snippet (see below).

### Snippet example

Save the following as a `.css` file under **Settings → Appearance → CSS snippets** and enable it
(this repo ships `custom-syntax-blocks.css`, which also adds type titles):

```css
/* base box */
.cs-block {
	margin: 1em 0;
	padding: 0.9em 1em 0.9em 1.2em;
	border: 1px solid var(--background-modifier-border);
	border-left-width: 4px;
	border-radius: var(--radius-m, 8px);
	background-color: var(--background-secondary);
}

/* per-type colour (!important beats a rule's inline declaration) */
.cs-fence-note    { border-left: 4px solid var(--interactive-accent) !important; }
.cs-fence-info    { border-left: 4px solid var(--text-link) !important; }
.cs-fence-tip     { border-left: 4px solid var(--color-green) !important; }
.cs-fence-warning { border-left: 4px solid var(--color-orange) !important; }
.cs-fence-danger  { border-left: 4px solid var(--color-red) !important; }

/* type title */
.cs-block[class*="cs-fence-"]::before {
	display: block;
	margin: -0.1em 0 0.55em;
	font-size: var(--font-ui-smaller);
	font-weight: 600;
	text-transform: uppercase;
	color: var(--text-muted);
}
.cs-fence-note::before    { content: "Note"; }
.cs-fence-warning::before { content: "Warning"; }
.cs-fence-danger::before  { content: "Danger"; }
```

## Two ways to style a rule

### Declarations (quick)

Write the declarations directly in the rule. They are applied inline, so the rule works immediately with no other setup.

### Class name (reusable, themeable)

Give the rule a **class name** (e.g. `my-highlight`) and leave the declarations **empty**. The plugin then only adds classes to matched text — no inline styles at all — and the look comes from CSS you write yourself in a CSS snippet:

```css
.my-highlight {
	color: var(--color-red);
	background-color: var(--text-highlight-bg);
	border-radius: 3px;
}
```

```markdown
++this text++ gets the class
```

Every match also carries a shared class (`.custom-syntax-content`) and a stable per-rule class (`.custom-syntax-<id>-content` for inline, `.cs-block-<id>` for blocks), so a snippet can target all matches or one rule exactly.

Class-based styling supports everything inline declarations cannot — `:hover`, pseudo-elements, media queries, and overrides from themes — and lets several rules share one style.

### Migrating a rule to class-based styling

1. Click **Export** at the bottom of the settings tab.
2. Paste the generated CSS into a snippet under **Settings → Appearance → CSS snippets**, and enable it.
3. Clear that rule's **Style declarations** (keep the class name).

The snippet now owns the styling.

> **Note:** while a rule has declarations, they are applied inline and take precedence over a snippet. To let a snippet win, clear the declarations — or use `!important` in your snippet.

## Semantic index & companion (experimental)

As you open or edit a note, the plugin lazily builds its own index of where each rule matched. Other plugins can read it through the plugin instance's `syntaxIndex` API — the Obsidian metadata cache is **never patched**, so it survives app updates.

The command **Generate syntax metadata companion** writes a `<note>.cs-meta.md` file next to the current note, containing Dataview-readable inline fields (`cs-rule::`, `cs-kind::`, `cs-line::`, `cs-type::`) so your custom markers become queryable from Dataview. The companion is an extra file you can delete at any time.

## Example declarations

Each example is written exactly as you would in the declarations box — declarations only, no selector:

- Rounded box:

  ```css
  border: 1px solid var(--interactive-accent);
  border-radius: 6px;
  padding: 1px 5px;
  ```

- Highlight:

  ```css
  background-color: var(--text-highlight-bg);
  border-radius: 3px;
  ```

- Red text:

  ```css
  color: red;
  font-weight: bold;
  ```

- Underline:

  ```css
  text-decoration: underline;
  ```

## Known limitations

- The plugin decorates only — it does not add real Markdown AST nodes; copying to Typora or exporting via Pandoc keeps the delimiters as-is.
- Nested block syntax has limited support; code blocks and math are never rendered.
- The "Visual editor" button is a placeholder and is not yet available.

## Roadmap

- **Visual editor** — a graphical, no-code way to tune a rule's style, shown today as a disabled **Visual editor** button next to the declarations box. Not yet available.

## Installation

Install from the Obsidian community plugin directory, or manually:

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Place them in `.obsidian/plugins/custom-syntax/` inside your vault.
3. Enable the plugin under **Settings → Community plugins**.

## Development

```bash
npm install
npm run dev     # watch mode
npm run build   # type-check + production bundle to main.js
```

## Releasing

The `.github/workflows/release.yml` workflow builds and drafts a release whenever you push a tag matching the `manifest.json` version.
