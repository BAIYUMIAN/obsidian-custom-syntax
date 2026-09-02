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
import { escapeRegExp, ruleClassName, SyntaxRule } from "./settings";

let settingsVersion = 0;
export function bumpSettingsVersion(): void {
	settingsVersion++;
}

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
		if (!rule.enabled || !rule.delimiter || !rule.css) {
			continue;
		}

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
						attributes: { style: rule.css },
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
		private version = -1;

		constructor(view: EditorView) {
			this.version = settingsVersion;
			this.decorations = buildDecorations(view, getRules());
		}

		update(update: ViewUpdate): void {
			if (
				update.docChanged ||
				update.viewportChanged ||
				update.selectionSet ||
				this.version !== settingsVersion
			) {
				this.version = settingsVersion;
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
