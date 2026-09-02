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
	indentUnit,
	syntaxTree,
} from "@codemirror/language";
import { EditorState, Prec, Range } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	drawSelection,
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	keymap,
	lineNumbers,
	placeholder,
	rectangularSelection,
	tooltips,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import { cssDeclarations } from "./cssDeclarations";

/**
 * Map the stream parser's token style strings to our own, namespaced CSS
 * classes. We deliberately do NOT use CodeMirror's `HighlightStyle` + injected
 * `<style>`: inside an Obsidian modal its auto-generated class names and the
 * `var(--…)` colours it injects are not reliably applied, so nothing gets
 * coloured. Defining the colours in this plugin's own `styles.css` (scoped via
 * `.custom-syntax-css-editor`) is guaranteed to render.
 */
const TOKEN_CLASS: Record<string, string> = {
	comment: "cs-tok-comment",
	prop: "cs-tok-prop",
	propertyName: "cs-tok-prop",
	variable: "cs-tok-var",
	variableName: "cs-tok-var",
	fn: "cs-tok-fn",
	number: "cs-tok-num",
	unit: "cs-tok-unit",
	value: "cs-tok-val",
	atom: "cs-tok-val",
	string: "cs-tok-str",
	important: "cs-tok-kw",
	keyword: "cs-tok-kw",
	punct: "cs-tok-punct",
	punctuation: "cs-tok-punct",
};

function buildHighlight(view: EditorView): DecorationSet {
	const builder: Range<Decoration>[] = [];
	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: (node) => {
				const cls = TOKEN_CLASS[node.name];
				if (cls && node.from < node.to) {
					builder.push(
						Decoration.mark({ class: cls }).range(node.from, node.to)
					);
				}
			},
		});
	}
	return Decoration.set(builder, true);
}

const cssHighlightPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = buildHighlight(view);
		}
		update(update: ViewUpdate): void {
			if (update.docChanged || update.viewportChanged) {
				this.decorations = buildHighlight(update.view);
			}
		}
	},
	{ decorations: (v) => v.decorations }
);

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
		// Keep completion/lint popups inside our own container so they pick up
		// scoped styles instead of leaking into Obsidian's global editors.
		tooltips({ parent }),
		EditorView.lineWrapping,
		indentUnit.of("  "),
		cssDeclarations,
		cssHighlightPlugin,
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
