import {
	autocompletion,
	closeBrackets,
	closeBracketsKeymap,
	completionKeymap,
} from "@codemirror/autocomplete";
import {
	defaultKeymap,
	history,
	historyKeymap,
	indentWithTab,
} from "@codemirror/commands";
import {
	bracketMatching,
	HighlightStyle,
	indentUnit,
	syntaxHighlighting,
} from "@codemirror/language";
import { EditorState, Prec } from "@codemirror/state";
import {
	drawSelection,
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	keymap,
	lineNumbers,
	placeholder,
	rectangularSelection,
	tooltips,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { cssDeclarations } from "./cssDeclarations";

/**
 * Token colours are expressed with Obsidian's own CSS variables so the editor
 * follows whatever theme (light or dark) the user has active. Obsidian defines
 * --color-* from the user's accent palette, and --text-* for semantic text.
 */
const cssHighlight = HighlightStyle.define([
	{ tag: t.comment, color: "var(--text-faint)", fontStyle: "italic" },
	{ tag: t.propertyName, color: "var(--text-accent)" },
	{ tag: t.variableName, color: "var(--color-yellow)" },
	{ tag: t.function(t.variableName), color: "var(--color-purple)" },
	{ tag: [t.atom, t.keyword], color: "var(--color-blue)" },
	{ tag: [t.number, t.unit], color: "var(--color-orange)" },
	{ tag: t.string, color: "var(--color-green)" },
	{ tag: t.punctuation, color: "var(--text-muted)" },
	{ tag: t.invalid, color: "var(--color-red)" },
]);

export interface CssEditorOptions {
	placeholderText?: string;
	ariaLabel?: string;
	onChange?: (value: string) => void;
	onSubmit?: () => void;
}

export interface CssEditorHandle {
	getValue(): string;
	setValue(value: string): void;
	focus(): void;
	destroy(): void;
}

/**
 * A small CodeMirror 6 editor for CSS declarations, embedded in plugin UI.
 *
 * It owns a completely separate `EditorState` from Obsidian's markdown
 * editors, so bundling our own `@codemirror/*` copy cannot interfere with
 * Obsidian's — no shared `StateField`/`StateEffect` instances are involved.
 */
export function createCssEditor(
	parent: HTMLElement,
	doc: string,
	options: CssEditorOptions = {}
): CssEditorHandle {
	const extensions = [
		EditorView.editorAttributes.of({ class: "custom-syntax-cm-editor" }),
		lineNumbers(),
		highlightActiveLineGutter(),
		highlightActiveLine(),
		history(),
		drawSelection(),
		rectangularSelection(),
		bracketMatching(),
		closeBrackets(),
		autocompletion({ icons: false }),
		// Keep completion/​lint popups inside our own container so they pick up
		// scoped styles instead of leaking into Obsidian's global editors.
		tooltips({ parent }),
		EditorView.lineWrapping,
		indentUnit.of("  "),
		cssDeclarations,
		syntaxHighlighting(cssHighlight),
		// Ctrl/Cmd+Enter submits the surrounding dialog before the default
		// keymap can turn it into a newline.
		Prec.highest(
			keymap.of([
				{
					key: "Mod-Enter",
					run: () => {
						if (options.onSubmit) {
							options.onSubmit();
							return true;
						}
						return false;
					},
				},
			])
		),
		keymap.of([
			...closeBracketsKeymap,
			...defaultKeymap,
			...historyKeymap,
			...completionKeymap,
			indentWithTab,
		]),
	];

	if (options.placeholderText) {
		extensions.push(placeholder(options.placeholderText));
	}

	if (options.onChange) {
		const notify = options.onChange;
		extensions.push(
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					notify(update.state.doc.toString());
				}
			})
		);
	}

	if (options.ariaLabel) {
		extensions.push(
			EditorView.contentAttributes.of({
				"aria-label": options.ariaLabel,
				autocapitalize: "off",
				autocorrect: "off",
				spellcheck: "false",
			})
		);
	}

	const view = new EditorView({
		state: EditorState.create({ doc, extensions }),
		parent,
	});

	return {
		getValue(): string {
			return view.state.doc.toString();
		},
		setValue(value: string): void {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: value },
			});
		},
		focus(): void {
			view.focus();
		},
		destroy(): void {
			view.destroy();
		},
	};
}
