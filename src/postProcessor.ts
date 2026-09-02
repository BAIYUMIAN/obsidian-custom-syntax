import { escapeRegExp, SyntaxRule } from "./settings";

function shouldSkip(node: Node): boolean {
	let el = node.parentElement;
	while (el) {
		const tag = el.tagName;
		if (
			tag === "CODE" ||
			tag === "PRE" ||
			tag === "A" ||
			tag === "MATH" ||
			tag === "SCRIPT" ||
			tag === "STYLE"
		) {
			return true;
		}
		el = el.parentElement;
	}
	return false;
}

function cssToRecord(css: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const decl of css.split(";")) {
		const trimmed = decl.trim();
		if (!trimmed) continue;
		const idx = trimmed.indexOf(":");
		if (idx === -1) continue;
		const prop = trimmed.slice(0, idx).trim();
		const value = trimmed.slice(idx + 1).trim();
		if (prop && value) {
			result[prop] = value;
		}
	}
	return result;
}

export function applyRule(root: HTMLElement, rule: SyntaxRule): void {
	if (!rule.enabled || !rule.delimiter || !rule.css) {
		return;
	}

	const delim = rule.delimiter;
	const re = new RegExp(
		`${escapeRegExp(delim)}([^\\n]*?)${escapeRegExp(delim)}`,
		"g"
	);
	const cssRecord = cssToRecord(rule.css);

	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const textNodes: Text[] = [];
	while (walker.nextNode()) {
		const node = walker.currentNode as Text;
		if (shouldSkip(node)) {
			continue;
		}
		if ((node.nodeValue ?? "").length === 0) {
			continue;
		}
		textNodes.push(node);
	}

	for (const node of textNodes) {
		const text = node.nodeValue ?? "";
		if (!re.test(text)) {
			re.lastIndex = 0;
			continue;
		}
		re.lastIndex = 0;

		const fragment = createFragment();
		let lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text)) !== null) {
			if (m.index > lastIndex) {
				fragment.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
			}

			const span = createSpan();
			span.setCssStyles(cssRecord);
			span.textContent = m[1];
			fragment.appendChild(span);

			lastIndex = m.index + m[0].length;
			if (m[0].length === 0) {
				re.lastIndex++;
			}
		}
		if (lastIndex < text.length) {
			fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
		}

		node.parentNode?.replaceChild(fragment, node);
	}
}
