import { contentClasses, escapeRegExp, SyntaxRule } from "./settings";

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
	if (!rule.enabled || !rule.delimiter) {
		return;
	}

	const css = (rule.css ?? "").trim();
	if (!css && !(rule.className ?? "").trim()) {
		return;
	}

	const delim = rule.delimiter;
	const re = new RegExp(
		`${escapeRegExp(delim)}([^\\n]*?)${escapeRegExp(delim)}`,
		"g"
	);
	const cssRecord = css ? cssToRecord(css) : null;
	const classes = contentClasses(rule);

	// Resolve the document from the node itself so this also works inside a
	// popped-out window.
	const doc = root.ownerDocument;
	const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
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
				fragment.appendChild(
					doc.createTextNode(text.slice(lastIndex, m.index))
				);
			}

			// A delimiter pair with nothing inside (e.g. "++++") has no
			// content to style — skip it so we don't emit an empty box.
			if (m[1].length === 0) {
				lastIndex = m.index + m[0].length;
				continue;
			}

			const span = createSpan();
			span.addClasses(classes.split(" "));
			if (cssRecord) {
				span.setCssStyles(cssRecord);
			}
			span.textContent = m[1];
			fragment.appendChild(span);

			lastIndex = m.index + m[0].length;
			if (m[0].length === 0) {
				re.lastIndex++;
			}
		}
		if (lastIndex < text.length) {
			fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
		}

		// If every match was an empty-content pair (e.g. "++++"), the
		// fragment may have no child nodes at all. Replacing the original
		// text node with an empty fragment would silently delete the text,
		// so we skip replacement and leave the raw delimiter visible.
		if (fragment.childNodes.length > 0) {
			node.parentNode?.replaceChild(fragment, node);
		}
	}
}
