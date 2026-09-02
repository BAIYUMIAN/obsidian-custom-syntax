import { syntaxTree } from "@codemirror/language";
import { Extension, Range } from "@codemirror/state";
import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginSpec,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";
import {
	contentClasses,
	escapeRegExp,
	ruleClassName,
	SyntaxRule,
} from "./settings";

interface CodeRange {
	from: number;
	to: number;
}

function collectCodeRanges(view: EditorView): CodeRange[] {
	const ranges: CodeRange[] = [];
	try {
		for (const { from, to } of view.visibleRanges) {
			syntaxTree(view.state).iterate({
				from,
				to,
				enter(node) {
					const name = node.name.toLowerCase();
					if (
						name.includes("code") ||
						name.includes("comment") ||
						name.includes("math") ||
						name.includes("html")
					) {
						ranges.push({ from: node.from, to: node.to });
						return false;
					}
				},
			});
		}
	} catch {
		// Syntax tree unavailable — fall back to no exclusions.
		return [];
	}
	return ranges;
}

function isInCode(from: number, to: number, ranges: CodeRange[]): boolean {
	for (const r of ranges) {
		if (from < r.to && to > r.from) {
			return true;
		}
	}
	return false;
}

function buildDecorations(
	view: EditorView,
	rules: SyntaxRule[]
): DecorationSet {
	const decos: Range<Decoration>[] = [];
	const codeRanges = collectCodeRanges(view);
	const scanRanges =
		view.visibleRanges.length > 0
			? view.visibleRanges
			: [{ from: 0, to: view.state.doc.length }];
	const sel = view.state.selection.main;

	for (const rule of rules) {
		if (!rule.enabled || !rule.delimiter) {
			continue;
		}

		const css = (rule.css ?? "").trim();
		const extraClass = (rule.className ?? "").trim();
		// A rule with neither declarations nor a class has nothing to render.
		if (!css && !extraClass) {
			continue;
		}

		const contentCls = contentClasses(rule);
		const delim = rule.delimiter;
		const re = new RegExp(
			`${escapeRegExp(delim)}([^\\n]*?)${escapeRegExp(delim)}`,
			"g"
		);
		const delimCls = ruleClassName(rule.id) + "-delim";

		for (const { from, to } of scanRanges) {
			const text = view.state.sliceDoc(from, to);
			re.lastIndex = 0;
			let m: RegExpExecArray | null;
			while ((m = re.exec(text)) !== null) {
				const content = m[1];
				// A delimiter pair with nothing inside it (e.g. "++++")
				// has no content to decorate. Skipping it avoids building a
				// zero-length mark, which throws "Mark decorations may not be
				// empty" and permanently breaks the editor view.
				if (content.length === 0) {
					continue;
				}
				const fullStart = from + m.index;
				const contentStart = fullStart + delim.length;
				const contentEnd = contentStart + content.length;
				const fullEnd = fullStart + m[0].length;

				if (isInCode(fullStart, fullEnd, codeRanges)) {
					continue;
				}

				const active = sel.from <= fullEnd && sel.to >= fullStart;

				if (active) {
					decos.push(
						Decoration.mark({
							class: delimCls,
						}).range(fullStart, contentStart)
					);
				} else {
					decos.push(
						Decoration.replace({}).range(fullStart, contentStart)
					);
				}

				decos.push(
					Decoration.mark({
						class: contentCls,
						// Declarations ride along only when the user wrote any;
						// an empty field means a CSS snippet owns the styling.
						attributes: css ? { style: css } : undefined,
					}).range(contentStart, contentEnd)
				);

				if (active) {
					decos.push(
						Decoration.mark({
							class: delimCls,
						}).range(contentEnd, fullEnd)
					);
				} else {
					decos.push(
						Decoration.replace({}).range(contentEnd, fullEnd)
					);
				}
			}
		}
	}

	return Decoration.set(decos, true);
}

export function createEditorExtension(
	getRules: () => SyntaxRule[]
): Extension {
	class CustomSyntaxView implements PluginValue {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view, getRules());
		}

		update(update: ViewUpdate): void {
			if (
				update.docChanged ||
				update.viewportChanged ||
				update.selectionSet
			) {
				this.decorations = buildDecorations(update.view, getRules());
			}
		}

		destroy(): void {}
	}

	const spec: PluginSpec<CustomSyntaxView> = {
		decorations: (value: CustomSyntaxView) => value.decorations,
	};

	return ViewPlugin.fromClass(CustomSyntaxView, spec);
}
