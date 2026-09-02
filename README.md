# Custom Syntax

> [中文说明](README.zh-CN.md)

An [Obsidian](https://obsidian.md) plugin that lets you define **custom inline syntax delimiters** and render them with **your own CSS** — with native, real-time preview, just like built-in Markdown.

Wrap text with a delimiter you define (e.g. `++text++`) and it renders instantly with the CSS you specify. The markers are hidden until you place the cursor inside them — exactly like Obsidian's native `**bold**` or `~~strikethrough~~`.

## Features

- Define any inline delimiter and map it to arbitrary CSS.
- Native real-time preview in Live Preview and Source mode.
- Markers hide automatically and reappear when the cursor is inside the match.
- Reading view rendering via a Markdown post-processor.
- Conflict detection against built-in Markdown syntax (e.g. `**`, `==`, `` ` ``) and against your other custom rules.
- Bilingual UI (English / 中文), with "follow system" language detection.

## How it works

The plugin never rewrites your Markdown source. It uses two official extension points:

- **Live Preview / Source mode** — a CodeMirror 6 editor extension (`registerEditorExtension`) applies decorations, the same mechanism Obsidian uses for its own syntax.
- **Reading view** — a Markdown post-processor (`registerMarkdownPostProcessor`) styles the rendered content, skipping code blocks, inline code, links, and math.

## Usage

1. Open **Settings → Custom Syntax**.
2. Click **Add rule**.
3. Enter a **name** and a **delimiter** (e.g. `++`).
4. Optionally fill in **Class name** (e.g. `my-highlight`) if you want to style this rule from a CSS snippet instead of inline declarations.
5. In **Style declarations**, write only what goes inside a CSS rule's curly braces `{ }` — one declaration per line, no selector needed:

   ```css
   border: 1px solid var(--interactive-accent);
   border-radius: 6px;
   padding: 1px 5px;
   ```

6. Type `++text++` in a note.

Each rule is a card with edit, delete, and an enable/disable toggle. When a rule conflicts with another (or with built-in Markdown), you're warned before creating it.

The declarations editor is a small CodeMirror instance: syntax highlighting, property and value completion (including Obsidian's own CSS variables), bracket/quote auto-closing, undo history, multi-cursor, `Tab` to indent, and `Ctrl/Cmd+Enter` to save.

> **Tip:** you don't need a selector — the plugin wraps your declarations in the rule's own class for you. A delimiter pair with nothing inside it (e.g. `++++`) is ignored, so it won't break rendering.

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

Every match also carries a shared class (`.custom-syntax-content`) and a stable per-rule class (`.custom-syntax-<id>-content`), so a snippet can target all matches or one rule exactly.

Class-based styling supports everything inline declarations cannot — `:hover`, pseudo-elements, media queries, and overrides from themes — and lets several rules share one style.

### Migrating a rule to class-based styling

1. Click **Export** at the bottom of the settings tab.
2. Paste the generated CSS into a snippet under **Settings → Appearance → CSS snippets**, and enable it.
3. Clear that rule's **Style declarations** (keep the class name).

The snippet now owns the styling.

> **Note:** while a rule has declarations, they are applied inline and take precedence over a snippet. To let a snippet win, clear the declarations — or use `!important` in your snippet.

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
