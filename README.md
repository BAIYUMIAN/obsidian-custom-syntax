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
3. Enter a **name**, a **delimiter** (e.g. `++`), and **CSS** (e.g. `border: 1px solid var(--interactive-accent); border-radius: 6px; padding: 1px 5px;`).
4. Type `++text++` in a note.

Each rule is a card with enable/disable, edit, and delete actions. When a rule conflicts with another (or with built-in Markdown), you're warned before creating it.

## Example CSS

- Rounded box: `border: 1px solid var(--interactive-accent); border-radius: 6px; padding: 1px 5px;`
- Highlight: `background-color: var(--text-highlight-bg); border-radius: 3px;`
- Red text: `color: red; font-weight: bold;`
- Underline: `text-decoration: underline;`

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
