import {
	StreamLanguage,
	StringStream,
	type StreamParser,
} from "@codemirror/language";
import type {
	Completion,
	CompletionContext,
	CompletionResult,
} from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";

/**
 * A CodeMirror language for a bare CSS declaration list — the text that goes
 * *inside* a rule's curly braces, with no selector and no wrapping braces.
 *
 * Why not `@codemirror/lang-css`: its Lezer grammar is a full stylesheet
 * grammar. A bare `color: red;` parses as a *selector* (`PseudoClassSelector`)
 * with error nodes, which makes highlighting and completion wrong. This
 * stream parser models exactly the grammar we accept.
 */

interface DeclState {
	inValue: boolean;
	inComment: boolean;
}

const UNITS = new Set([
	"px",
	"em",
	"rem",
	"ex",
	"ch",
	"cap",
	"ic",
	"lh",
	"rlh",
	"vh",
	"vw",
	"vmin",
	"vmax",
	"vi",
	"vb",
	"pt",
	"pc",
	"cm",
	"mm",
	"q",
	"in",
	"fr",
	"deg",
	"rad",
	"grad",
	"turn",
	"s",
	"ms",
	"hz",
	"khz",
	"dpi",
	"dpcm",
	"dppx",
	"x",
]);

const parser: StreamParser<DeclState> = {
	name: "css-declarations",

	startState: () => ({ inValue: false, inComment: false }),

	token(stream: StringStream, state: DeclState): string | null {
		// Block comments can span lines, so their state is carried over.
		if (state.inComment) {
			if (stream.match(/.*?\*\//)) {
				state.inComment = false;
			} else {
				stream.skipToEnd();
			}
			return "comment";
		}

		// A line that starts at column 0 begins a new declaration; an indented
		// line continues the previous value.
		if (stream.sol() && !stream.match(/^[ \t]/)) {
			state.inValue = false;
		}

		if (stream.eatSpace()) {
			return null;
		}

		if (stream.match(/\/\*/)) {
			if (!stream.match(/.*?\*\//)) {
				state.inComment = true;
				stream.skipToEnd();
			}
			return "comment";
		}

		if (stream.peek() === '"' || stream.peek() === "'") {
			return readString(stream);
		}

		if (state.inValue) {
			if (stream.match(/^;/)) {
				state.inValue = false;
				return "punct";
			}
			if (stream.match(/^!important/i)) {
				return "important";
			}
			if (stream.match(/^#[0-9a-fA-F]{3,8}\b/)) {
				return "number";
			}
			if (stream.match(/^--[A-Za-z0-9_-]+/)) {
				return "variable";
			}
			if (stream.match(/^-?(?:\d+\.?\d*|\.\d+)/)) {
				return "number";
			}
			if (stream.match(/^[A-Za-z][A-Za-z0-9_-]*(?=\s*\()/)) {
				return "fn";
			}
			if (stream.match(/^[A-Za-z-][A-Za-z0-9_-]*/)) {
				return UNITS.has(stream.current().toLowerCase())
					? "unit"
					: "value";
			}
			if (stream.match(/^%/)) {
				return "unit";
			}
			stream.next();
			return "punct";
		}

		// Property position.
		if (stream.match(/^[:;{}]/)) {
			state.inValue = stream.current() === ":";
			return "punct";
		}
		if (stream.match(/^--[A-Za-z0-9_-]+/)) {
			return "prop";
		}
		if (stream.match(/^[A-Za-z*-][A-Za-z0-9_-]*/)) {
			return "prop";
		}
		stream.next();
		return "punct";
	},

	languageData: {
		commentTokens: { block: { open: "/*", close: "*/" } },
		closeBrackets: { brackets: ["(", "'", '"'] },
		autocomplete: cssDeclarationsCompletion,
	},

	tokenTable: {
		comment: tags.comment,
		prop: tags.propertyName,
		variable: tags.variableName,
		fn: tags.function(tags.variableName),
		number: tags.number,
		unit: tags.unit,
		value: tags.atom,
		string: tags.string,
		important: tags.keyword,
		punct: tags.punctuation,
	},
};

function readString(stream: StringStream): string {
	const quote = stream.next();
	while (!stream.eol()) {
		const ch = stream.next();
		if (ch === "\\") {
			stream.next();
			continue;
		}
		if (ch === quote) {
			break;
		}
	}
	return "string";
}

export const cssDeclarations = StreamLanguage.define(parser);

/* ------------------------------------------------------------------ */
/* Completion data                                                     */
/* ------------------------------------------------------------------ */

const PROPERTIES: string[] = [
	"align-content",
	"align-items",
	"align-self",
	"all",
	"animation",
	"animation-delay",
	"animation-duration",
	"animation-iteration-count",
	"animation-name",
	"animation-timing-function",
	"aspect-ratio",
	"backdrop-filter",
	"background",
	"background-attachment",
	"background-blend-mode",
	"background-clip",
	"background-color",
	"background-image",
	"background-position",
	"background-repeat",
	"background-size",
	"block-size",
	"border",
	"border-block",
	"border-bottom",
	"border-bottom-color",
	"border-bottom-left-radius",
	"border-bottom-right-radius",
	"border-bottom-style",
	"border-bottom-width",
	"border-collapse",
	"border-color",
	"border-inline",
	"border-left",
	"border-left-color",
	"border-left-style",
	"border-left-width",
	"border-radius",
	"border-right",
	"border-right-color",
	"border-right-style",
	"border-right-width",
	"border-spacing",
	"border-style",
	"border-top",
	"border-top-color",
	"border-top-left-radius",
	"border-top-right-radius",
	"border-top-style",
	"border-top-width",
	"border-width",
	"bottom",
	"box-shadow",
	"box-sizing",
	"caption-side",
	"caret-color",
	"clear",
	"clip-path",
	"color",
	"color-scheme",
	"column-gap",
	"column-rule",
	"column-span",
	"columns",
	"content",
	"counter-increment",
	"cursor",
	"direction",
	"display",
	"empty-cells",
	"filter",
	"flex",
	"flex-basis",
	"flex-direction",
	"flex-flow",
	"flex-grow",
	"flex-shrink",
	"flex-wrap",
	"float",
	"font",
	"font-family",
	"font-feature-settings",
	"font-kerning",
	"font-size",
	"font-size-adjust",
	"font-stretch",
	"font-style",
	"font-variant",
	"font-variant-numeric",
	"font-weight",
	"gap",
	"grid",
	"grid-area",
	"grid-auto-columns",
	"grid-auto-flow",
	"grid-auto-rows",
	"grid-column",
	"grid-column-end",
	"grid-column-start",
	"grid-gap",
	"grid-row",
	"grid-row-end",
	"grid-row-start",
	"grid-template",
	"grid-template-areas",
	"grid-template-columns",
	"grid-template-rows",
	"height",
	"hyphens",
	"inline-size",
	"inset",
	"isolation",
	"justify-content",
	"justify-items",
	"justify-self",
	"left",
	"letter-spacing",
	"line-break",
	"line-height",
	"list-style",
	"list-style-image",
	"list-style-position",
	"list-style-type",
	"margin",
	"margin-block",
	"margin-block-end",
	"margin-block-start",
	"margin-bottom",
	"margin-inline",
	"margin-inline-end",
	"margin-inline-start",
	"margin-left",
	"margin-right",
	"margin-top",
	"mask",
	"max-block-size",
	"max-height",
	"max-inline-size",
	"max-width",
	"min-block-size",
	"min-height",
	"min-inline-size",
	"min-width",
	"mix-blend-mode",
	"object-fit",
	"object-position",
	"opacity",
	"order",
	"outline",
	"outline-color",
	"outline-offset",
	"outline-style",
	"outline-width",
	"overflow",
	"overflow-wrap",
	"overflow-x",
	"overflow-y",
	"overscroll-behavior",
	"padding",
	"padding-block",
	"padding-block-end",
	"padding-block-start",
	"padding-bottom",
	"padding-inline",
	"padding-inline-end",
	"padding-inline-start",
	"padding-left",
	"padding-right",
	"padding-top",
	"page-break-after",
	"page-break-before",
	"page-break-inside",
	"perspective",
	"place-content",
	"place-items",
	"place-self",
	"pointer-events",
	"position",
	"quotes",
	"resize",
	"right",
	"rotate",
	"row-gap",
	"scale",
	"scroll-behavior",
	"scroll-margin",
	"scroll-padding",
	"tab-size",
	"table-layout",
	"text-align",
	"text-align-last",
	"text-decoration",
	"text-decoration-color",
	"text-decoration-line",
	"text-decoration-style",
	"text-decoration-thickness",
	"text-emphasis",
	"text-indent",
	"text-justify",
	"text-overflow",
	"text-rendering",
	"text-shadow",
	"text-transform",
	"text-underline-offset",
	"top",
	"touch-action",
	"transform",
	"transform-origin",
	"transition",
	"transition-delay",
	"transition-duration",
	"transition-property",
	"transition-timing-function",
	"translate",
	"unicode-bidi",
	"user-select",
	"vertical-align",
	"visibility",
	"white-space",
	"widows",
	"width",
	"will-change",
	"word-break",
	"word-spacing",
	"word-wrap",
	"writing-mode",
	"z-index",
	"zoom",
];

const VALUE_KEYWORDS: string[] = [
	"auto",
	"none",
	"normal",
	"inherit",
	"initial",
	"unset",
	"revert",
	"bold",
	"bolder",
	"lighter",
	"italic",
	"oblique",
	"underline",
	"overline",
	"line-through",
	"solid",
	"dashed",
	"dotted",
	"double",
	"groove",
	"ridge",
	"inset",
	"outset",
	"hidden",
	"visible",
	"block",
	"inline",
	"inline-block",
	"inline-flex",
	"inline-grid",
	"flex",
	"grid",
	"contents",
	"table",
	"absolute",
	"relative",
	"fixed",
	"sticky",
	"static",
	"left",
	"right",
	"center",
	"justify",
	"top",
	"bottom",
	"start",
	"end",
	"nowrap",
	"pre",
	"pre-wrap",
	"ellipsis",
	"uppercase",
	"lowercase",
	"capitalize",
	"small-caps",
	"pointer",
	"default",
	"ease",
	"ease-in",
	"ease-out",
	"ease-in-out",
	"linear",
	"cover",
	"contain",
	"repeat",
	"no-repeat",
];

const COLOR_KEYWORDS: string[] = [
	"transparent",
	"currentColor",
	"red",
	"orange",
	"yellow",
	"green",
	"cyan",
	"blue",
	"purple",
	"pink",
	"white",
	"black",
	"gray",
	"grey",
	"silver",
	"gold",
];

/** Obsidian's own CSS variables — the ones users most often want here. */
const OBSIDIAN_VARIABLES: string[] = [
	"--text-normal",
	"--text-muted",
	"--text-faint",
	"--text-accent",
	"--text-accent-hover",
	"--text-error",
	"--text-warning",
	"--text-success",
	"--text-highlight-bg",
	"--text-selection",
	"--background-primary",
	"--background-primary-alt",
	"--background-secondary",
	"--background-secondary-alt",
	"--background-modifier-border",
	"--background-modifier-hover",
	"--background-modifier-active-hover",
	"--background-modifier-form-field",
	"--interactive-normal",
	"--interactive-hover",
	"--interactive-accent",
	"--interactive-accent-hover",
	"--color-red",
	"--color-orange",
	"--color-yellow",
	"--color-green",
	"--color-cyan",
	"--color-blue",
	"--color-purple",
	"--color-pink",
	"--font-ui-smaller",
	"--font-ui-small",
	"--font-ui-medium",
	"--font-ui-large",
	"--font-monospace",
	"--radius-s",
	"--radius-m",
	"--radius-l",
	"--size-4-1",
	"--size-4-2",
	"--size-4-3",
	"--size-4-4",
	"--size-4-6",
	"--size-4-8",
];

const COLOR_PROPERTIES = new Set([
	"color",
	"background",
	"background-color",
	"border-color",
	"border-top-color",
	"border-right-color",
	"border-bottom-color",
	"border-left-color",
	"caret-color",
	"outline-color",
	"text-decoration-color",
	"text-emphasis-color",
	"column-rule-color",
	"fill",
	"stroke",
]);

function toOptions(values: string[], type: string): Completion[] {
	return values.map((label) => ({ label, type }));
}

const PROPERTY_OPTIONS: Completion[] = toOptions(PROPERTIES, "property");
const KEYWORD_OPTIONS: Completion[] = toOptions(VALUE_KEYWORDS, "keyword");
const COLOR_OPTIONS: Completion[] = toOptions(COLOR_KEYWORDS, "constant");
const VARIABLE_OPTIONS: Completion[] = OBSIDIAN_VARIABLES.map((label) => ({
	label,
	type: "variable",
	detail: "Obsidian",
}));

function currentProperty(before: string): string {
	const match = before.match(/([A-Za-z-][A-Za-z0-9_-]*)\s*:[^:;]*$/);
	return match ? match[1].toLowerCase() : "";
}

/**
 * Declared as a function (not a const) because `parser`'s `languageData`
 * references it at module-initialisation time, before the const would be
 * initialised.
 */
export function cssDeclarationsCompletion(
	context: CompletionContext
): CompletionResult | null {
	const line = context.state.doc.lineAt(context.pos);
	const before = line.text.slice(0, context.pos - line.from);
	const colon = before.lastIndexOf(":");
	const semicolon = before.lastIndexOf(";");

	if (colon > semicolon) {
		// Inside a value.
		const word = context.matchBefore(/[\w-]*/);
		if (!word && !context.explicit) {
			return null;
		}
		const prop = currentProperty(before);
		const options = COLOR_PROPERTIES.has(prop)
			? [...COLOR_OPTIONS, ...VARIABLE_OPTIONS, ...KEYWORD_OPTIONS]
			: [...KEYWORD_OPTIONS, ...VARIABLE_OPTIONS, ...COLOR_OPTIONS];
		return {
			from: word ? word.from : context.pos,
			options,
			validFor: /^[\w-]*$/,
		};
	}

	const word = context.matchBefore(/[-*\w]*/);
	if (!word && !context.explicit) {
		return null;
	}
	return {
		from: word ? word.from : context.pos,
		options: PROPERTY_OPTIONS,
		validFor: /^[-*\w]*$/,
	};
}
