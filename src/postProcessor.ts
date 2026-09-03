import {
	contentClasses,
	escapeRegExp,
	sanitizeClassName,
	SyntaxRule,
} from "./settings";

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

/** Keeps only safe identifier tokens for a fenced type class. */
function sanitizeType(raw: string): string {
	return (raw ?? "")
		.split(/[\s]+/)
		.map((t) => t.trim())
		.filter((t) => /^-?[A-Za-z_][A-Za-z0-9_-]*$/.test(t))
		.join("-");
}

/** Full class list for a generated block element. */
export function blockRuleClasses(rule: SyntaxRule, type?: string): string {
	const parts = ["cs-block", `cs-block-${rule.id}`];
	if (type) {
		parts.push(`cs-fence-${sanitizeType(type)}`);
	}
	const extra = sanitizeClassName(rule.className);
	if (extra) {
		parts.push(extra);
	}
	return parts.join(" ");
}

/**
 * Parse a `{ .class #id key=value }` parameter string into classes, an id,
 * and a CSS style record. This is the only place parameters are interpreted,
 * so a malformed string simply yields no classes/style rather than breaking
 * rendering.
 */
export interface ParsedParams {
	classes: string[];
	id?: string;
	style: Record<string, string>;
}

export function parseParams(raw: string): ParsedParams {
	const result: ParsedParams = { classes: [], style: {} };
	const inner = raw.trim().replace(/^\{|\}$/g, "").trim();
	if (!inner) {
		return result;
	}
	for (const token of inner.split(/\s+/)) {
		if (!token) continue;
		if (token.startsWith(".")) {
			const cls = sanitizeClassName(token.slice(1));
			if (cls) result.classes.push(cls);
		} else if (token.startsWith("#")) {
			const id = token.slice(1);
			if (/^-?[A-Za-z_][A-Za-z0-9_-]*$/.test(id)) {
				result.id = id;
			}
		} else {
			const eq = token.indexOf("=");
			if (eq > 0) {
				const prop = token.slice(0, eq).trim();
				const value = token.slice(eq + 1).trim();
				if (prop && value && /^[A-Za-z-]+$/.test(prop)) {
					result.style[prop] = value;
				}
			}
		}
	}
	return result;
}

/** Apply parsed parameters to an element (classes, id, inline style). */
function applyParams(el: HTMLElement, params: ParsedParams | null): void {
	if (!params) return;
	if (params.classes.length) {
		el.addClasses(params.classes);
	}
	if (params.id) {
		el.id = params.id;
	}
	if (Object.keys(params.style).length) {
		el.setCssStyles(params.style);
	}
}

/** Single entry point: dispatch to the renderer that matches the rule kind. */
export function applyRule(root: HTMLElement, rule: SyntaxRule): void {
	if (!rule.enabled) {
		return;
	}
	switch (rule.kind) {
		case "inline":
			applyInline(root, rule);
			break;
		case "fenced":
		case "multiline":
			applyBlock(root, rule);
			break;
		case "callout":
			applyCallout(root, rule);
			break;
	}
}

function applyInline(root: HTMLElement, rule: SyntaxRule): void {
	const open = rule.open;
	if (!open) {
		return;
	}

	const css = (rule.css ?? "").trim();
	if (!css && !(rule.className ?? "").trim()) {
		return;
	}

	// When parameter capture is on, the pattern is:
	//   open { .class #id k=v } content open
	// otherwise it is the plain `open content open`.
	const head = rule.captureParams
		? `${escapeRegExp(open)}\\s*(\\{[^}]*\\})?\\s*([^\\n]*?)`
		: `${escapeRegExp(open)}([^\\n]*?)`;
	const re = new RegExp(head + escapeRegExp(open), "g");
	const cssRecord = css ? cssToRecord(css) : null;
	const classes = contentClasses(rule);

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

			const paramsRaw = rule.captureParams ? m[1] : undefined;
			const content = rule.captureParams ? m[2] : m[1];

			// A delimiter pair with nothing inside (e.g. "++++") has no
			// content to style — skip it so we don't emit an empty box.
			if ((content ?? "").length === 0) {
				lastIndex = m.index + m[0].length;
				continue;
			}

			const span = createSpan();
			span.addClasses(classes.split(" "));
			if (cssRecord) {
				span.setCssStyles(cssRecord);
			}
			if (paramsRaw) {
				applyParams(span, parseParams(paramsRaw));
			}
			span.textContent = content;
			fragment.appendChild(span);

			lastIndex = m.index + m[0].length;
			if (m[0].length === 0) {
				re.lastIndex++;
			}
		}
		if (lastIndex < text.length) {
			fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
		}

		if (fragment.childNodes.length > 0) {
			node.parentNode?.replaceChild(fragment, node);
		}
	}
}

/* ── Block-level (fenced / multiline) renderer ──
 *
 * Obsidian renders `:::note\nbody\n:::` as EITHER several separate `<p>`
 * blocks (when blank lines separate them) OR a single `<p>` whose lines are
 * joined by `<br>` (when they are not). Both shapes must be handled, so we
 * first split any `<br>`-joined opener into its own block, then collect the
 * region between the opener and the matching closer.
 */

interface BlockMatch {
	type?: string;
	params: ParsedParams | null;
}

/** Does `el`'s first line look like this rule's opening marker? */
function matchOpener(el: HTMLElement, rule: SyntaxRule): BlockMatch | null {
	const first = firstLineText(el);
	if (first === null) return null;
	const open = rule.open;

	if (rule.kind === "fenced") {
		if (!first.startsWith(open)) return null;
		const tail = first.slice(open.length);
		let type: string | undefined;
		let params: ParsedParams | null = null;
		if (rule.captureParams) {
			const bs = tail.indexOf("{");
			if (bs >= 0) {
				const be = tail.indexOf("}", bs);
				if (be >= 0) {
					params = parseParams(tail.slice(bs, be + 1));
					type = rule.readType ? tail.slice(0, bs).trim() || undefined : undefined;
				} else {
					type = rule.readType ? tail.trim() : undefined;
				}
			} else {
				type = rule.readType ? tail.trim() : undefined;
			}
		} else {
			type = rule.readType ? tail.trim() : undefined;
		}
		return { type, params };
	}
	// multiline: the marker sits alone on its line; params may follow it.
	if (first === open) {
		return { params: null };
	}
	if (rule.captureParams && first.startsWith(open) && /\{/.test(first.slice(open.length))) {
		return { params: parseTrailingParams(first.slice(open.length)) };
	}
	return null;
}

/** A trailing `{ ... }` at the start of `tail` becomes parsed params. */
function parseTrailingParams(tail: string): ParsedParams | null {
	const m = tail.trim().match(/^\{(\{[^}]*\}|[^}]*)\}/);
	if (!m) return null;
	return parseParams(m[0]);
}

/** Text of the first visual line of `el` (splitting on <br> and newlines). */
function firstLineText(el: HTMLElement): string | null {
	let buf = "";
	for (const node of Array.from(el.childNodes)) {
		if (node.nodeName === "BR") {
			if (buf) return buf;
			buf = "";
			continue;
		}
		if (node.nodeType === Node.TEXT_NODE) {
			const parts = (node.nodeValue ?? "").split("\n");
			for (let i = 0; i < parts.length; i++) {
				if (i > 0 && (buf || i > 1 || true)) {
					if (buf) return buf;
					buf = "";
				}
				buf += parts[i];
			}
		} else {
			buf += (node.textContent ?? "");
		}
	}
	return buf === "" && el.childNodes.length === 0 ? null : buf;
}

/** The trimmed text of a single-line block element. */
function lineText(el: HTMLElement): string {
	return (el.textContent ?? "").replace(/\n/g, " ").trim();
}

/**
 * Split `el` (which may join several lines with `<br>` or raw newlines) into
 * separate block elements, inserted in `el`'s place. Returns the created
 * elements in document order. `el` itself is removed.
 */
function splitElementByBr(el: HTMLElement): HTMLElement[] {
	const doc = el.ownerDocument;
	const lines: Node[][] = [[]];
	for (const node of Array.from(el.childNodes)) {
		if (node.nodeName === "BR") {
			lines.push([]);
			continue;
		}
		if (node.nodeType === Node.TEXT_NODE) {
			const parts = (node.nodeValue ?? "").split("\n");
			for (let i = 0; i < parts.length; i++) {
				if (i > 0) lines.push([]);
				if (parts[i]) lines[lines.length - 1].push(doc.createTextNode(parts[i]));
			}
		} else {
			lines[lines.length - 1].push(node);
		}
	}

	const created: HTMLElement[] = [];
	for (const lineNodes of lines) {
		const p = doc.createElement("p");
		for (const n of lineNodes) p.appendChild(n);
		created.push(p);
	}

	const parent = el.parentElement;
	if (!parent) return created;
	let ref: Node | null = el;
	for (const p of created) {
		parent.insertBefore(p, ref);
		ref = p;
	}
	parent.removeChild(el);
	return created;
}

function applyBlock(root: HTMLElement, rule: SyntaxRule): void {
	const open = rule.open;
	if (!open) return;
	const close = rule.close || open;

	// Already processed (e.g. a later callback firing on a moved element).
	if (root.dataset.csBlock) return;
	const parent = root.parentElement;
	if (!parent) return;

	const opener = matchOpener(root, rule);
	if (!opener) return;

	// Split a <br>-joined opener so the marker sits on its own block.
	const openerLines =
		root.querySelector("br") || /\n/.test(root.textContent ?? "")
			? splitElementByBr(root)
			: [root];
	const openerEl = openerLines[0];

	// Region to scan for the closer: the rest of the opener's split lines,
	// then the following sibling blocks.
	const siblings = Array.from(parent.children) as HTMLElement[];
	const lastIdx = siblings.indexOf(openerLines[openerLines.length - 1]);
	const restEls = [
		...openerLines.slice(1),
		...siblings.slice(lastIdx + 1),
	];

	let closerIdx = -1;
	for (let i = 0; i < restEls.length; i++) {
		if (restEls[i].dataset.csBlock) break;
		if (lineText(restEls[i]) === close) {
			closerIdx = i;
			break;
		}
	}
	if (closerIdx === -1) {
		// No matching closer — leave the raw markers untouched.
		return;
	}

	const contentEls = restEls.slice(0, closerIdx);
	const closerEl = restEls[closerIdx];
	if (contentEls.length === 0) {
		// Empty block (opener immediately followed by closer) — still wrap so
		// it renders as a (possibly empty) styled block.
	}

	const doc = root.ownerDocument;
	const wrapper = doc.createElement("div");
	wrapper.className = blockRuleClasses(rule, opener.type);
	wrapper.dataset.csBlock = rule.id;
	openerEl.dataset.csBlock = "x";
	closerEl.dataset.csBlock = "x";
	for (const c of contentEls) c.dataset.csBlock = "x";

	const css = (rule.css ?? "").trim();
	if (css) {
		wrapper.setCssStyles(cssToRecord(css));
	}
	applyParams(wrapper, opener.params);

	// Move the inner content out of the now-detached paragraphs.
	for (const c of contentEls) {
		while (c.firstChild) {
			wrapper.appendChild(c.firstChild);
		}
	}

	parent.insertBefore(wrapper, openerEl);
	parent.removeChild(openerEl);
	for (const c of contentEls) {
		parent.removeChild(c);
	}
	parent.removeChild(closerEl);
}

/**
 * Custom callout: reuse Obsidian's native `> [!type]` callout box and just
 * apply our class / inline style. This avoids re-implementing callout layout
 * and stays fully on documented APIs.
 */
function applyCallout(root: HTMLElement, rule: SyntaxRule): void {
	const type = rule.open;
	if (!type) {
		return;
	}
	const targets: HTMLElement[] = [];
	if (root.matches(".callout")) {
		targets.push(root as HTMLElement);
	}
	root.querySelectorAll(".callout").forEach((n) =>
		targets.push(n as HTMLElement)
	);
	for (const el of targets) {
		if (el.getAttribute("data-callout") !== type) {
			continue;
		}
		const css = (rule.css ?? "").trim();
		if (css) {
			el.setCssStyles(cssToRecord(css));
		}
		const extra = sanitizeClassName(rule.className);
		if (extra) {
			el.addClasses(extra.split(" "));
		}
	}
}
