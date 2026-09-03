import { App, Modal, PluginSettingTab, Setting, setIcon } from "obsidian";
import type CustomSyntaxPlugin from "./main";
import { createCssEditor, type CssEditorHandle } from "./cssEditor";

export type Language = "en" | "zh" | "system";
type ResolvedLanguage = "en" | "zh";

/** The four syntax shapes a rule can render. Drives both the editor form and the renderer. */
export type RuleKind = "inline" | "fenced" | "multiline" | "callout";

export interface SyntaxRule {
	id: string;
	name: string;
	enabled: boolean;
	/**
	 * Which syntax shape this rule renders:
	 *  - `inline`    : a delimiter wraps text on the same line (`++text++`)
	 *  - `fenced`    : Pandoc-style `:::type … :::` block
	 *  - `multiline` : a marker alone on its own line opens, the same marker
	 *                  alone on a later line closes (`++` … `++`)
	 *  - `callout`   : an Obsidian callout type (`> [!type]`), styled by us
	 */
	kind: RuleKind;
	/**
	 * The opening marker. For `inline` this is the delimiter (open === close);
	 * for `fenced`/`multiline` it is the line marker (e.g. ":::", "++");
	 * for `callout` it is the Obsidian callout type name (e.g. "mynote").
	 */
	open: string;
	/** Closing marker. Equals `open` for inline/fenced; the end marker for multiline; empty for callout. */
	close: string;
	/** Fenced/callout: read the type from the opening line (e.g. `:::note`, `>[!note]`). */
	readType: boolean;
	/** Capture `{ .class #id k=v }` parameters after the match and apply them. */
	captureParams: boolean;
	/**
	 * Declarations only — the text that goes *inside* a rule's curly braces.
	 * May be left empty, in which case the rule's classes (see `className`)
	 * alone decide the look, and styling lives in the user's own CSS snippet.
	 */
	css: string;
	/**
	 * Optional extra class names applied to every match, so styles can be
	 * shared between rules and overridden from a CSS snippet or theme.
	 */
	className: string;
	conflictWithId?: string | null;
}

export interface CustomSyntaxSettings {
	language: Language;
	rules: SyntaxRule[];
	/** Whether the left-ribbon icon that opens the rule panel is shown. */
	showRibbon: boolean;
}

export const DEFAULT_SETTINGS: CustomSyntaxSettings = {
	language: "system",
	rules: [
		{
			id: "rounded-box",
			name: "圆角边框",
			enabled: true,
			kind: "inline",
			open: "++",
			close: "++",
			readType: false,
			captureParams: false,
			css: `border: 1px solid var(--interactive-accent);
border-radius: 6px;
padding: 1px 5px;`,
			className: "",
		},
		{
			id: "fenced-note",
			name: "围栏块 (:::note)",
			enabled: true,
			kind: "fenced",
			open: ":::",
			close: ":::",
			readType: true,
			captureParams: false,
			css: "",
			className: "",
		},
		{
			id: "multiline-plus",
			name: "多行块 (++)",
			enabled: true,
			kind: "multiline",
			open: "++",
			close: "++",
			readType: false,
			captureParams: false,
			css: "",
			className: "",
		},
	],
	showRibbon: true,
};

export function newRuleId(): string {
	return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizeRule(r: Partial<SyntaxRule>): SyntaxRule {
	const kind: RuleKind =
		r.kind === "fenced" || r.kind === "multiline" || r.kind === "callout"
			? r.kind
			: "inline";
	// Migrate the legacy single `delimiter` field into the unified open/close.
	const legacy = r as Partial<SyntaxRule> & { delimiter?: string };
	const open = r.open ?? legacy.delimiter ?? "";
	const close =
		r.close ?? (kind === "inline" ? open : kind === "fenced" ? open : "");
	return {
		id: typeof r.id === "string" && r.id ? r.id : newRuleId(),
		name: typeof r.name === "string" ? r.name : "",
		enabled: r.enabled ?? true,
		kind,
		open,
		close,
		readType: r.readType ?? (kind === "callout" ? true : kind === "fenced"),
		captureParams: r.captureParams ?? false,
		css: r.css ?? "",
		className: sanitizeClassName(r.className ?? ""),
		conflictWithId: r.conflictWithId ?? null,
	};
}

export function ruleClassName(id: string): string {
	return `custom-syntax-${id}`;
}

/**
 * Keeps only tokens that are valid, safe CSS identifiers, so a malformed or
 * malicious value can never break out of the class attribute.
 */
export function sanitizeClassName(raw: string): string {
	return (raw ?? "")
		.split(/\s+/)
		.map((token) => token.trim())
		.filter((token) => /^-?[A-Za-z_][A-Za-z0-9_-]*$/.test(token))
		.join(" ");
}

/** Stable per-rule class, so a CSS snippet can target one rule exactly. */
export function ruleContentClass(id: string): string {
	return `${ruleClassName(id)}-content`;
}

/**
 * The full class list applied to matched text: a shared base class, the
 * rule's own stable class, then any user-supplied extra classes.
 */
export function contentClasses(rule: SyntaxRule): string {
	const parts = ["custom-syntax-content", ruleContentClass(rule.id)];
	const extra = sanitizeClassName(rule.className);
	if (extra) {
		parts.push(extra);
	}
	return parts.join(" ");
}

/**
 * Renders every rule's declarations as a plain CSS snippet the user can paste
 * into their own snippet file, after which the rule's `css` field can be
 * cleared so the snippet (and themes) fully control the look.
 */
export function exportRulesAsCss(rules: SyntaxRule[]): string {
	const blocks: string[] = [];
	for (const rule of rules) {
		const css = (rule.css ?? "").trim();
		if (!css) {
			continue;
		}
		const extra = sanitizeClassName(rule.className);
		const selector = extra
			? `.${extra.split(" ").join(".")}`
			: rule.kind === "inline"
				? `.${ruleContentClass(rule.id)}`
				: `.cs-block-${rule.id}`;
		const label = rule.name || rule.open || rule.id;
		const declarations = css
			.split(";")
			.map((decl) => decl.trim())
			.filter(Boolean)
			.map((decl) => `\t${decl};`)
			.join("\n");
		blocks.push(
			`/* ${label} — ${rule.open} */\n${selector} {\n${declarations}\n}`
		);
	}
	if (blocks.length === 0) {
		return "";
	}
	return [
		"/* Generated by the Custom Syntax plugin. */",
		"/* Paste into a CSS snippet, then clear the rule's declarations so the snippet takes over. */",
		"",
		...blocks,
	].join("\n");
}

export function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function delimitersConflict(a: string, b: string): boolean {
	if (!a || !b) {
		return false;
	}
	return a === b || a.includes(b) || b.includes(a);
}

interface BuiltinSyntax {
	delim: string;
	zh: string;
	en: string;
}

const BUILTIN: BuiltinSyntax[] = [
	{ delim: "**", zh: "粗体", en: "Bold" },
	{ delim: "__", zh: "粗体", en: "Bold" },
	{ delim: "*", zh: "斜体", en: "Italic" },
	{ delim: "_", zh: "斜体", en: "Italic" },
	{ delim: "~~", zh: "删除线", en: "Strikethrough" },
	{ delim: "==", zh: "高亮", en: "Highlight" },
	{ delim: "`", zh: "行内代码", en: "Inline code" },
	{ delim: "```", zh: "代码块", en: "Code block" },
	{ delim: "%%", zh: "注释", en: "Comment" },
	{ delim: "$", zh: "数学公式", en: "Math" },
	{ delim: "#", zh: "标题", en: "Heading" },
	{ delim: ">", zh: "引用", en: "Blockquote" },
	{ delim: "|", zh: "表格", en: "Table" },
	{ delim: "[[", zh: "内部链接", en: "Wikilink" },
	{ delim: "![[", zh: "嵌入", en: "Embed" },
	{ delim: "[", zh: "链接", en: "Link" },
	{ delim: "]", zh: "链接", en: "Link" },
	{ delim: "(", zh: "链接", en: "Link" },
	{ delim: ")", zh: "链接", en: "Link" },
	{ delim: "!", zh: "图片", en: "Image" },
	{ delim: "^", zh: "上标/脚注", en: "Superscript/Footnote" },
	{ delim: "~", zh: "下标", en: "Subscript" },
];

export function findBuiltinConflict(delim: string): BuiltinSyntax | null {
	for (const b of BUILTIN) {
		if (delimitersConflict(delim, b.delim)) {
			return b;
		}
	}
	return null;
}

export function findCustomConflict(
	delim: string,
	rules: SyntaxRule[],
	excludeId?: string
): SyntaxRule | null {
	for (const r of rules) {
		if (excludeId && r.id === excludeId) {
			continue;
		}
		if (delimitersConflict(delim, r.open)) {
			return r;
		}
	}
	return null;
}

interface UIStrings {
	pluginName: string;
	language: string;
	addRule: string;
	followSystem: string;
	toggle: string;
	edit: string;
	delete: string;
	deleteConfirm: string;
	createTitle: string;
	editTitle: string;
	ruleName: string;
	ruleNamePlaceholder: string;
	delimiter: string;
	delimiterDesc: string;
	css: string;
	cssDesc: string;
	cssPlaceholder: string;
	cssAria: string;
	visualEdit: string;
	visualEditHint: string;
	className: string;
	classNameDesc: string;
	classNamePlaceholder: string;
	exportName: string;
	exportDesc: string;
	exportBtn: string;
	exportTitle: string;
	exportEmpty: string;
	copy: string;
	copied: string;
	copyFailed: string;
	cancel: string;
	create: string;
	save: string;
	delimiterRequired: string;
	conflictBuiltin: string;
	conflictCustomCreate: string;
	conflictCustomSave: string;
	conflictAnnotation: string;
	untitled: string;
	back: string;
	noRules: string;
	other: string;
	exportGroup: string;
	toolbarIcon: string;
	toolbarIconDesc: string;
	invokePanel: string;
	invokePanelDesc: string;
	openPanel: string;
	docs: string;
	docsTitle: string;
	docsRepo: string;
	docsOpen: string;
	close: string;
	languageSwitch: string;
	openSettings: string;
	category: string;
	enabledLabel: string;
	catInline: string;
	catFenced: string;
	catMultiline: string;
	catCallout: string;
	openMarker: string;
	openMarkerDesc: string;
	closeMarker: string;
	closeMarkerDesc: string;
	typeName: string;
	typeNameDesc: string;
	readType: string;
	readTypeDesc: string;
	captureParams: string;
	captureParamsDesc: string;
	markerPlaceholder: string;
	typePlaceholder: string;
}

const STRINGS: Record<ResolvedLanguage, UIStrings> = {
	zh: {
		pluginName: "自定义语法",
		language: "语言",
		addRule: "添加规则",
		followSystem: "跟随系统",
		toggle: "启用或禁用",
		edit: "编辑",
		delete: "删除",
		deleteConfirm: "确定要删除规则「{name}」吗？",
		createTitle: "新建规则",
		editTitle: "编辑规则",
		ruleName: "规则名",
		ruleNamePlaceholder: "给规则起个名字",
		delimiter: "分隔符",
		delimiterDesc: "包裹文字的标记，例如 ++",
		css: "样式声明",
		cssDesc:
			"只写 CSS 花括号 { } 里的内容，例如 color: red;。留空则完全由下方类名在你自己的 CSS 片段中决定样式。",
		cssPlaceholder: `border: 1px solid var(--interactive-accent);
border-radius: 6px;
padding: 1px 5px;`,
		cssAria: "CSS 样式声明",
		visualEdit: "可视化编辑",
		visualEditHint: "即将推出：用图形界面调整样式，无需手写 CSS",
		className: "类名（可选）",
		classNameDesc:
			"附加到匹配文字上的 CSS 类名，多个用空格分隔。样式声明留空时，样式完全由你在 CSS 片段中为这个类写的规则决定。",
		classNamePlaceholder: "my-highlight",
		exportName: "导出为 CSS 片段",
		exportDesc:
			"把规则的样式声明导出成 CSS 片段。粘到你的 CSS 片段文件并启用后，清空规则的样式声明即可改由片段控制，样式也就能被主题复用和覆盖。",
		exportBtn: "导出",
		exportTitle: "导出 CSS 片段",
		exportEmpty: "还没有规则填写样式声明，没有可导出的内容。",
		copy: "复制到剪贴板",
		copied: "已复制",
		copyFailed: "复制失败，请手动选中复制",
		cancel: "取消",
		create: "创建",
		save: "保存",
		delimiterRequired: "标记不能为空",
		conflictBuiltin: "与 Markdown 内置语法「{name}」冲突",
		conflictCustomCreate: "与自定义语法「{name}」冲突，再次确认将创建并禁用",
		conflictCustomSave: "与自定义语法「{name}」冲突，再次确认将保存并禁用",
		conflictAnnotation: "与「{name}」冲突",
		untitled: "未命名",
		back: "返回",
		noRules: "还没有规则，点击右上角「添加规则」新建一条。",
		other: "其他",
		exportGroup: "导出",
		toolbarIcon: "工具栏图标",
		toolbarIconDesc: "在左侧功能栏显示一个图标，点击即可打开规则管理器面板。",
		invokePanel: "唤起面板",
		invokePanelDesc: "在右侧边栏打开规则管理器。",
		openPanel: "打开面板",
		docs: "说明文档",
		docsTitle: "自定义语法 - 说明",
		docsRepo: "在 GitHub 上查看",
		docsOpen: "打开",
		close: "关闭",
		languageSwitch: "切换语言",
		openSettings: "设置",
		category: "语法类别",
		enabledLabel: "启用",
		catInline: "行内配对",
		catFenced: "围栏块",
		catMultiline: "多行块",
		catCallout: "自定义 Callout",
		openMarker: "起始标记",
		openMarkerDesc: "块起始行的标记，例如 ::: 或 ++",
		closeMarker: "结束标记",
		closeMarkerDesc: "块结束行的标记，例如 ::: 或 ++",
		typeName: "类型名",
		typeNameDesc: "Obsidian callout 类型名，例如 mynote；在笔记里用 > [!mynote] 触发",
		readType: "读取类型",
		readTypeDesc: "从起始行读取类型（如 :::note 的类型为 note），作为类名钩子",
		captureParams: "捕获参数",
		captureParamsDesc: "在标记后解析 { .class #id k=v } 并动态套用",
		markerPlaceholder: ":::",
		typePlaceholder: "mynote",
	},
	en: {
		pluginName: "Custom Syntax",
		language: "Language",
		addRule: "Add rule",
		followSystem: "Follow system",
		toggle: "Enable or disable",
		edit: "Edit",
		delete: "Delete",
		deleteConfirm: 'Delete rule "{name}"?',
		createTitle: "New rule",
		editTitle: "Edit rule",
		ruleName: "Rule name",
		ruleNamePlaceholder: "Name this rule",
		delimiter: "Delimiter",
		delimiterDesc: "The marker that wraps the text, e.g. ++",
		css: "Style declarations",
		cssDesc:
			"Write only what goes inside the CSS curly braces { }, e.g. color: red;. Leave empty and the class below decides the styling from your own CSS snippet.",
		cssPlaceholder: `border: 1px solid var(--interactive-accent);
border-radius: 6px;
padding: 1px 5px;`,
		cssAria: "CSS style declarations",
		visualEdit: "Visual editor",
		visualEditHint:
			"Coming soon: tweak styles in a GUI instead of writing CSS by hand",
		className: "Class name (optional)",
		classNameDesc:
			"CSS class names added to the matched text, separated by spaces. With the declarations left empty, styling comes entirely from the rule you write for this class in a CSS snippet.",
		classNamePlaceholder: "my-highlight",
		exportName: "Export as CSS snippet",
		exportDesc:
			"Export rule declarations as a CSS snippet. Paste it into a CSS snippet file and enable it, then clear the rule's declarations so the snippet takes over — that way styles can be reused and overridden by themes.",
		exportBtn: "Export",
		exportTitle: "Export CSS snippet",
		exportEmpty: "No rule has declarations yet, so there is nothing to export.",
		copy: "Copy to clipboard",
		copied: "Copied",
		copyFailed: "Copy failed — select and copy manually",
		cancel: "Cancel",
		create: "Create",
		save: "Save",
		delimiterRequired: "Marker is required",
		conflictBuiltin: 'Conflicts with built-in Markdown syntax "{name}"',
		conflictCustomCreate:
			'Conflicts with custom syntax "{name}" — confirm again to create (disabled)',
		conflictCustomSave:
			'Conflicts with custom syntax "{name}" — confirm again to save (disabled)',
		conflictAnnotation: 'Conflicts with "{name}"',
		untitled: "Untitled",
		back: "Back",
		noRules:
			'No rules yet — click "Add rule" in the top right to create one.',
		other: "Other",
		exportGroup: "Export",
		toolbarIcon: "Toolbar icon",
		toolbarIconDesc:
			"Show an icon in the left ribbon that opens the rule manager panel.",
		invokePanel: "Open panel",
		invokePanelDesc: "Open the rule manager in the right sidebar.",
		openPanel: "Open panel",
		docs: "Documentation",
		docsTitle: "Custom Syntax - Guide",
		docsRepo: "View on GitHub",
		docsOpen: "Open",
		close: "Close",
		languageSwitch: "Switch language",
		openSettings: "Settings",
		category: "Syntax category",
		enabledLabel: "Enabled",
		catInline: "Inline pair",
		catFenced: "Fenced block",
		catMultiline: "Multiline block",
		catCallout: "Custom callout",
		openMarker: "Opening marker",
		openMarkerDesc: "The marker on the block's opening line, e.g. ::: or ++",
		closeMarker: "Closing marker",
		closeMarkerDesc: "The marker on the block's closing line, e.g. ::: or ++",
		typeName: "Type name",
		typeNameDesc: "The Obsidian callout type name, e.g. mynote; trigger with > [!mynote]",
		readType: "Read type",
		readTypeDesc: "Read the type from the opening line (e.g. :::note -> note) as a class hook",
		captureParams: "Capture parameters",
		captureParamsDesc: "Parse { .class #id k=v } after the match and apply it dynamically",
		markerPlaceholder: ":::",
		typePlaceholder: "mynote",
	},
};

export function resolveLanguage(lang: Language): ResolvedLanguage {
	if (lang === "system") {
		const nav =
			typeof navigator !== "undefined" ? navigator.language || "" : "";
		return nav.toLowerCase().startsWith("zh") ? "zh" : "en";
	}
	return lang;
}

function getStrings(lang: ResolvedLanguage): UIStrings {
	return STRINGS[lang] ?? STRINGS.zh;
}

export function stringsFor(lang: Language): UIStrings {
	return getStrings(resolveLanguage(lang));
}

export class ConfirmModal extends Modal {
	private message: string;
	private confirmLabel: string;
	private cancelLabel: string;
	private onConfirm: () => void;

	constructor(
		app: App,
		message: string,
		confirmLabel: string,
		cancelLabel: string,
		onConfirm: () => void
	) {
		super(app);
		this.message = message;
		this.confirmLabel = confirmLabel;
		this.cancelLabel = cancelLabel;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("p", {
			cls: "custom-syntax-confirm-message",
			text: this.message,
		});

		const btnRow = contentEl.createDiv({ cls: "custom-syntax-modal-actions" });
		const cancelBtn = btnRow.createEl("button", { text: this.cancelLabel });
		cancelBtn.addEventListener("click", () => this.close());

		const confirmBtn = btnRow.createEl("button", {
			text: this.confirmLabel,
			cls: "mod-warning",
		});
		confirmBtn.addEventListener("click", () => {
			this.close();
			this.onConfirm();
		});
	}
}

/** Result of {@link RuleForm.validate}; `ok` is false when there is an error. */
export interface RuleFormValue {
	name: string;
	kind: RuleKind;
	open: string;
	close: string;
	readType: boolean;
	captureParams: boolean;
	css: string;
	className: string;
	enabled: boolean;
}

/**
 * The create/edit form, shared by the rule manager panel. It only builds the
 * fields and validates input; applying the result to the settings is left to
 * the caller (so the same form works inline in the panel).
 */
export class RuleForm {
	private plugin: CustomSyntaxPlugin;
	private rule: SyntaxRule | null;
	private onSubmit: () => void;

	private kind: RuleKind = "inline";
	private nameInput!: HTMLInputElement;
	private classInput!: HTMLInputElement;
	private cssEditor!: CssEditorHandle;
	private conditionalEl!: HTMLElement;
	private errorEl!: HTMLElement;
	private pendingCustomConflict: SyntaxRule | null = null;

	// Conditional field state (rebuilt when the category changes).
	private openInput?: HTMLInputElement;
	private closeInput?: HTMLInputElement;
	private enabled = true;
	private readType = false;
	private captureParams = false;

	constructor(
		container: HTMLElement,
		plugin: CustomSyntaxPlugin,
		rule: SyntaxRule | null,
		onSubmit: () => void
	) {
		this.plugin = plugin;
		this.rule = rule;
		this.onSubmit = onSubmit;
		this.build(container);
	}

	private build(container: HTMLElement): void {
		const t = stringsFor(this.plugin.settings.language);
		this.kind = this.rule?.kind ?? "inline";
		this.enabled = this.rule?.enabled ?? true;
		this.readType =
			this.rule?.readType ??
			(this.kind === "fenced" || this.kind === "callout");
		this.captureParams = this.rule?.captureParams ?? false;

		// Category selector — a segmented control at the top of the form.
		const cat = new Setting(container).setName(t.category);
		const seg = cat.controlEl.createDiv({ cls: "custom-syntax-cat-seg" });
		const kinds: RuleKind[] = ["inline", "fenced", "multiline", "callout"];
		const labelOf: Record<RuleKind, string> = {
			inline: t.catInline,
			fenced: t.catFenced,
			multiline: t.catMultiline,
			callout: t.catCallout,
		};
		const buttons = {} as Record<RuleKind, HTMLElement>;
		for (const k of kinds) {
			const b = seg.createEl("button", {
				text: labelOf[k],
				cls: "custom-syntax-cat-btn",
			});
			if (k === this.kind) b.addClass("is-active");
			b.addEventListener("click", () => {
				if (this.kind === k) return;
				this.kind = k;
				for (const kk of kinds) {
					buttons[kk].toggleClass("is-active", kk === k);
				}
				this.renderConditional();
			});
			buttons[k] = b;
		}

		new Setting(container).setName(t.ruleName).addText((text) => {
			this.nameInput = text.inputEl;
			text
				.setValue(this.rule?.name ?? "")
				.setPlaceholder(t.ruleNamePlaceholder);
		});

		new Setting(container)
			.setName(t.enabledLabel)
			.addToggle((tg) => {
				tg.setValue(this.enabled);
				tg.onChange((v) => {
					this.enabled = v;
				});
			});

		// Conditional section — rebuilt whenever the category changes.
		this.conditionalEl = container.createDiv({
			cls: "custom-syntax-conditional",
		});
		this.renderConditional();

		new Setting(container)
			.setName(t.className)
			.addText((text) => {
				this.classInput = text.inputEl;
				text
					.setValue(this.rule?.className ?? "")
					.setPlaceholder(t.classNamePlaceholder);
			});

		// The declarations editor gets its own row, full width, under its
		// label — a side-by-side layout leaves far too little room for it.
		const cssSetting = new Setting(container).setName(t.css);
		cssSetting.settingEl.addClass("custom-syntax-stacked");
		// Inside the panel the (disabled) "Visual editor" button lives in the
		// fixed footer, so the row only hosts the editor itself.
		const cssRow = cssSetting.controlEl.createDiv({
			cls: "custom-syntax-css-row",
		});
		const cssHost = cssRow.createDiv({
			cls: "custom-syntax-css-editor",
		});
		this.cssEditor = createCssEditor(
			cssHost,
			this.rule?.css ?? DEFAULT_SETTINGS.rules[0].css,
			{
				placeholderText: t.cssPlaceholder,
				ariaLabel: t.cssAria,
				onSubmit: () => this.onSubmit(),
			}
		);

		this.errorEl = container.createDiv({ cls: "custom-syntax-error" });
	}

	/** (Re)build the category-dependent fields without touching common ones. */
	private renderConditional(): void {
		const t = stringsFor(this.plugin.settings.language);
		this.conditionalEl.empty();
		this.openInput = undefined;
		this.closeInput = undefined;

		if (this.kind === "inline") {
			new Setting(this.conditionalEl)
				.setName(t.delimiter)
				.addText((text) => {
					this.openInput = text.inputEl;
					text
						.setValue(this.rule?.open ?? "++")
						.setPlaceholder("++");
					this.openInput.addEventListener("input", () => {
						this.pendingCustomConflict = null;
						this.clearError();
					});
				});
		} else if (this.kind === "fenced") {
			new Setting(this.conditionalEl)
				.setName(t.openMarker)
								.addText((text) => {
					this.openInput = text.inputEl;
					text
						.setValue(this.rule?.open ?? ":::")
						.setPlaceholder(t.markerPlaceholder);
				});
			new Setting(this.conditionalEl)
				.setName(t.readType)
								.addToggle((tg) => {
					tg.setValue(this.readType);
					tg.onChange((v) => {
						this.readType = v;
					});
				});
			this.addCaptureToggle();
		} else if (this.kind === "multiline") {
			new Setting(this.conditionalEl)
				.setName(t.openMarker)
								.addText((text) => {
					this.openInput = text.inputEl;
					text
						.setValue(this.rule?.open ?? "++")
						.setPlaceholder(t.markerPlaceholder);
				});
			new Setting(this.conditionalEl)
				.setName(t.closeMarker)
								.addText((text) => {
					this.closeInput = text.inputEl;
					text
						.setValue(this.rule?.close ?? "++")
						.setPlaceholder(t.markerPlaceholder);
				});
			this.addCaptureToggle();
		} else {
			// callout
			new Setting(this.conditionalEl)
				.setName(t.typeName)
								.addText((text) => {
					this.openInput = text.inputEl;
					text
						.setValue(this.rule?.open ?? "")
						.setPlaceholder(t.typePlaceholder);
				});
		}
	}

	private addCaptureToggle(): void {
		const t = stringsFor(this.plugin.settings.language);
		new Setting(this.conditionalEl)
			.setName(t.captureParams)
						.addToggle((tg) => {
				tg.setValue(this.captureParams);
				tg.onChange((v) => {
					this.captureParams = v;
				});
			});
	}

	private clearError(): void {
		this.errorEl.empty();
		this.errorEl.removeClass("is-visible");
	}

	private showError(msg: string): void {
		this.errorEl.empty();
		this.errorEl.createSpan({ text: msg });
		this.errorEl.addClass("is-visible");
	}

	/**
	 * Validates the current input. On success returns the resolved values; on
	 * failure shows the error in-place and returns `{ ok: false }`.
	 */
	validate(): { ok: true; value: RuleFormValue } | { ok: false } {
		const t = stringsFor(this.plugin.settings.language);
		const lang = resolveLanguage(this.plugin.settings.language);
		const name = this.nameInput.value.trim();
		const css = this.cssEditor.getValue();
		const className = sanitizeClassName(this.classInput.value);
		const open = (this.openInput?.value ?? "").trim();
		const close = (this.closeInput?.value ?? "").trim();

		if (this.kind === "inline") {
			if (!open) {
				this.showError(t.delimiterRequired);
				return { ok: false };
			}
			const builtin = findBuiltinConflict(open);
			if (builtin) {
				const nm = lang === "zh" ? builtin.zh : builtin.en;
				this.showError(t.conflictBuiltin.replace("{name}", nm));
				this.pendingCustomConflict = null;
				return { ok: false };
			}
			const custom = findCustomConflict(
				open,
				this.plugin.settings.rules,
				this.rule?.id
			);
			if (custom) {
				const nm = custom.name || t.untitled;
				if (
					this.pendingCustomConflict &&
					this.pendingCustomConflict.id === custom.id
				) {
					return {
						ok: true,
						value: this.buildValue(name, "inline", open, open, false, false, css, className),
					};
				}
				this.pendingCustomConflict = custom;
				const msg = this.rule ? t.conflictCustomSave : t.conflictCustomCreate;
				this.showError(msg.replace("{name}", nm));
				return { ok: false };
			}
		} else if (this.kind === "fenced") {
			if (!open) {
				this.showError(t.delimiterRequired);
				return { ok: false };
			}
		} else if (this.kind === "multiline") {
			if (!open || !close) {
				this.showError(t.delimiterRequired);
				return { ok: false };
			}
		} else {
			// callout
			if (!open) {
				this.showError(t.delimiterRequired);
				return { ok: false };
			}
		}

		const isBlock = this.kind === "fenced" || this.kind === "multiline";
		return {
			ok: true,
			value: this.buildValue(
				name,
				this.kind,
				open,
				this.kind === "inline"
					? open
					: this.kind === "multiline"
						? close
						: "",
				this.kind === "callout"
					? true
					: this.kind === "fenced"
						? this.readType
						: false,
				isBlock ? this.captureParams : false,
				css,
				className
			),
		};
	}

	private buildValue(
		name: string,
		kind: RuleKind,
		open: string,
		close: string,
		readType: boolean,
		captureParams: boolean,
		css: string,
		className: string
	): RuleFormValue {
		return {
			name: name || stringsFor(this.plugin.settings.language).untitled,
			kind,
			open,
			close,
			readType,
			captureParams,
			css,
			className,
			enabled: this.enabled,
		};
	}

	destroy(): void {
		this.cssEditor?.destroy();
	}
}

export class ExportModal extends Modal {
	private content: string;
	private emptyMessage: string;
	private copyLabel: string;
	private copiedLabel: string;
	private failedLabel: string;

	constructor(
		app: App,
		content: string,
		emptyMessage: string,
		copyLabel: string,
		copiedLabel: string,
		failedLabel: string
	) {
		super(app);
		this.content = content;
		this.emptyMessage = emptyMessage;
		this.copyLabel = copyLabel;
		this.copiedLabel = copiedLabel;
		this.failedLabel = failedLabel;
	}

	onOpen(): void {
		const { contentEl } = this;

		if (!this.content) {
			contentEl.createEl("p", { text: this.emptyMessage });
			return;
		}

		const area = contentEl.createEl("textarea", {
			cls: "custom-syntax-export-area",
		});
		area.rows = 16;
		area.readOnly = true;
		area.spellcheck = false;
		area.value = this.content;
		area.setAttribute("aria-label", this.copyLabel);

		const actions = contentEl.createDiv({
			cls: "custom-syntax-modal-actions",
		});
		const copyBtn = actions.createEl("button", {
			text: this.copyLabel,
			cls: "mod-cta",
		});
		copyBtn.addEventListener("click", () => {
			area.select();
			void navigator.clipboard.writeText(this.content).then(
				() => copyBtn.setText(this.copiedLabel),
				() => copyBtn.setText(this.failedLabel)
			);
		});
	}
}

/**
 * Enable or disable a rule and resolve any delimiter conflicts by disabling
 * the rules it would clash with.
 */
export async function toggleRuleEnabled(
	plugin: CustomSyntaxPlugin,
	rule: SyntaxRule,
	enabled: boolean
): Promise<void> {
	rule.enabled = enabled;
	rule.conflictWithId = null;

	if (enabled) {
		for (const other of plugin.settings.rules) {
			if (
				other !== rule &&
				other.enabled &&
				delimitersConflict(rule.open, other.open)
			) {
				other.enabled = false;
				other.conflictWithId = rule.id;
			}
		}
	}

	await plugin.saveSettings();
}

/** Remove a rule and clear any dangling conflict pointers that referenced it. */
export async function deleteRule(
	plugin: CustomSyntaxPlugin,
	rule: SyntaxRule
): Promise<void> {
	plugin.settings.rules = plugin.settings.rules.filter((r) => r !== rule);
	for (const r of plugin.settings.rules) {
		if (r.conflictWithId === rule.id) {
			r.conflictWithId = null;
		}
	}
	await plugin.saveSettings();
}

/**
 * One rule card. `onChanged` re-renders the host after a toggle/delete;
 * `onEdit` opens the rule in the panel's editor view.
 */
export function renderRuleCard(
	containerEl: HTMLElement,
	plugin: CustomSyntaxPlugin,
	rule: SyntaxRule,
	onChanged: () => void,
	onEdit: (rule: SyntaxRule) => void
): void {
	const t = stringsFor(plugin.settings.language);
	const card = containerEl.createDiv({ cls: "custom-syntax-rule-card" });

	const row = card.createDiv({ cls: "custom-syntax-rule-row" });

	const badgeLabel: Record<RuleKind, string> = {
		inline: t.catInline,
		fenced: t.catFenced,
		multiline: t.catMultiline,
		callout: t.catCallout,
	};
	const badge = row.createDiv({
		cls: `custom-syntax-rule-badge is-${rule.kind}`,
		text: badgeLabel[rule.kind] ?? t.catInline,
	});

	const nameEl = row.createDiv({
		cls: "custom-syntax-rule-name",
		text: rule.name || t.untitled,
	});
	nameEl.title =
		rule.kind === "inline"
			? rule.open
			: `${badgeLabel[rule.kind]} · ${rule.open}`;

	const controls = row.createDiv({ cls: "custom-syntax-rule-controls" });

	const editBtn = controls.createEl("button", { cls: "clickable-icon" });
	editBtn.setAttribute("aria-label", t.edit);
	setIcon(editBtn, "pencil");
	editBtn.addEventListener("click", () => onEdit(rule));

	const delBtn = controls.createEl("button", { cls: "clickable-icon" });
	delBtn.setAttribute("aria-label", t.delete);
	setIcon(delBtn, "trash");
	delBtn.addEventListener("click", () => {
		const name = rule.name || t.untitled;
		new ConfirmModal(
			plugin.app,
			t.deleteConfirm.replace("{name}", name),
			t.delete,
			t.cancel,
			() => {
				void deleteRule(plugin, rule).then(onChanged);
			}
		).open();
	});

	// Native Obsidian toggle: the is-enabled class drives the look.
	const toggle = controls.createDiv({
		cls: rule.enabled ? "checkbox-container is-enabled" : "checkbox-container",
	});
	toggle.setAttribute("role", "switch");
	toggle.setAttribute("aria-checked", String(rule.enabled));
	toggle.setAttribute("aria-label", t.toggle);
	toggle.setAttribute("tabindex", "0");
	toggle.addEventListener("click", () => {
		const newVal = !rule.enabled;
		toggle.toggleClass("is-enabled", newVal);
		toggle.setAttribute("aria-checked", String(newVal));
		void toggleRuleEnabled(plugin, rule, newVal).then(onChanged);
	});
	toggle.addEventListener("keydown", (ev: KeyboardEvent) => {
		if (ev.key === " " || ev.key === "Enter") {
			ev.preventDefault();
			toggle.click();
		}
	});

	const extraClass = sanitizeClassName(rule.className);
	if (extraClass) {
		card.createDiv({
			cls: "custom-syntax-rule-class",
			text: `.${extraClass.split(" ").join(" .")}`,
		});
	}

	if (rule.conflictWithId) {
		const other = plugin.settings.rules.find(
			(r) => r.id === rule.conflictWithId
		);
		if (other) {
			card.createDiv({
				cls: "custom-syntax-rule-conflict",
				text: t.conflictAnnotation.replace(
					"{name}",
					other.name || t.untitled
				),
			});
		}
	}
}

export class CustomSyntaxSettingTab extends PluginSettingTab {
	plugin: CustomSyntaxPlugin;

	constructor(app: App, plugin: CustomSyntaxPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const t = stringsFor(this.plugin.settings.language);

		const nav = containerEl.createDiv({ cls: "custom-syntax-nav" });
		const title = nav.createDiv({ cls: "custom-syntax-nav-title" });
		title.createSpan({ text: t.pluginName });
		title.createSpan({
			cls: "custom-syntax-nav-version",
			text: `v${this.plugin.manifest.version}`,
		});

		// Group: Other — each group is a card that nests its setting rows.
		const groupOther = containerEl.createDiv({
			cls: "custom-syntax-settings-group",
		});
		new Setting(groupOther).setName(t.other).setHeading();

		new Setting(groupOther)
			.setName(t.language)
			.addDropdown((dd) => {
				dd.addOption("system", t.followSystem);
				dd.addOption("zh", "简体中文");
				dd.addOption("en", "English");
				dd.setValue(this.plugin.settings.language);
				dd.onChange(async (value) => {
					this.plugin.settings.language = value as Language;
					await this.plugin.saveSettings();
					this.display();
				});
			});

		new Setting(groupOther)
			.setName(t.toolbarIcon)
			.setDesc(t.toolbarIconDesc)
			.addToggle((tg) => {
				tg.setValue(this.plugin.settings.showRibbon);
				tg.onChange(async (value) => {
					this.plugin.settings.showRibbon = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(groupOther)
			.setName(t.invokePanel)
			.setDesc(t.invokePanelDesc)
			.addButton((btn) =>
				btn
					.setButtonText(t.openPanel)
					.setCta()
					.onClick(() => this.plugin.activateRulePanel())
			);

		// Group: Export
		const groupExport = containerEl.createDiv({
			cls: "custom-syntax-settings-group",
		});
		new Setting(groupExport).setName(t.exportGroup).setHeading();

		new Setting(groupExport)
			.setName(t.exportName)
			.setDesc(t.exportDesc)
			.addButton((btn) =>
				btn.setButtonText(t.exportBtn).setCta().onClick(() => {
					new ExportModal(
						this.app,
						exportRulesAsCss(this.plugin.settings.rules),
						t.exportEmpty,
						t.copy,
						t.copied,
						t.copyFailed
					).open();
				})
			);

		new Setting(groupExport)
			.setName(t.docs)
			.addButton((btn) =>
				btn.setButtonText(t.docsOpen).onClick(() => {
					new DocumentationModal(this.app, this.plugin).open();
				})
			);
	}
}

/** Where the project's README lives — opened from the documentation modal. */
export const REPO_URL = "https://github.com/BAIYUMIAN/obsidian-custom-syntax";

interface DocSection {
	h: string;
	p: string[];
	code?: string;
}

/**
 * Built-in usage guide. Launched from the "Documentation" entry in settings.
 * The navbar centers the title with an external-link icon (opens the project
 * README in the browser); a close icon sits on the right.
 */
export class DocumentationModal extends Modal {
	private plugin: CustomSyntaxPlugin;

	constructor(app: App, plugin: CustomSyntaxPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("custom-syntax-doc");
		const t = stringsFor(this.plugin.settings.language);
		const lang = resolveLanguage(this.plugin.settings.language);

		const nav = contentEl.createDiv({ cls: "custom-syntax-doc-nav" });
		const center = nav.createDiv({ cls: "custom-syntax-doc-nav-center" });
		center.createDiv({
			cls: "custom-syntax-doc-nav-title",
			text: t.docsTitle,
		});
		const repoBtn = center.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": t.docsRepo },
		});
		setIcon(repoBtn, "external-link");
		repoBtn.addEventListener("click", () => {
			window.open(REPO_URL, "_blank");
		});
		const closeBtn = nav.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": t.close },
		});
		setIcon(closeBtn, "x");
		closeBtn.addEventListener("click", () => this.close());

		const body = contentEl.createDiv({ cls: "custom-syntax-doc-body" });

		const sections: DocSection[] =
			lang === "zh"
				? [
						{
							h: "概述",
							p: [
								"自定义语法让你定义自己的 Markdown 标记，并用自有 CSS 渲染。它只在编辑器与阅读视图做视觉装饰，永不改写你的源文件。",
								"编辑器（实时预览/源码模式）通过 CodeMirror 装饰实现，阅读视图通过 Markdown 后处理器实现——两条都是官方稳定扩展点。",
							],
						},
						{
							h: "添加规则",
							p: [
								"在右侧边栏规则管理器点「添加规则」，或在设置里点「打开面板」。",
								"先选「语法类别」，再填对应标记，然后在「样式声明」里只写 CSS 花括号里的内容：",
							],
							code: "border: 1px solid var(--interactive-accent);\nborder-radius: 6px;\npadding: 1px 5px;",
						},
						{
							h: "四类语法",
							p: [
								"行内配对：用成对分隔符包裹同一行文字，例如 ++文字++。",
								"围栏块：Pandoc 式 :::类型 … ::: 容器块，独占成行。",
								"多行块：起始标记独占一行，结束标记也独占一行，例如用 ++ 包住多行内容。",
								"自定义 Callout：用 > [!类型] 触发，盒子由 Obsidian 原生渲染，我们仅加样式。",
							],
							code: "++行内文字++\n\n:::note\n这是围栏块\n:::\n\n++\n这是多行块\n跨两行\n++\n\n> [!mynote]\n这是自定义 callout",
						},
						{
							h: "读取类型",
							p: [
								"围栏块与 Callout 可开启「读取类型」：起始行的类型（如 note / mynote）会作为类名钩子，让 CSS 片段按类型精确定制。",
								"例如 :::note 会获得 .cs-fence-note 类，> [!mynote] 对应原生 data-callout=\"mynote\"。",
							],
						},
						{
							h: "捕获参数",
							p: [
								"开启「捕获参数」后，可在标记后写 { .类名 #id 键=值 }，动态套用样式。",
								".类名 加 class，#id 设元素 id，键=值 转为内联 CSS（如 color=red）。",
							],
							code: ":::note { .box #main color=red }\n带参数的围栏块\n:::",
						},
						{
							h: "类样式复用（可选）",
							p: [
								"在「类名」里填一个或多个 CSS 类名（空格分隔）。当「样式声明」留空时，样式完全由你自己的 CSS 片段中为该类写的规则决定，从而能被主题复用与覆盖。",
								"每条规则还自带稳定类名 .cs-block-<id>（块级）或 .custom-syntax-<id>-content（行内），便于精确定位。",
							],
						},
						{
							h: "导出 CSS 片段",
							p: [
								"在设置「导出」组点「导出 CSS 片段」，把现有规则样式导出为 .css 文件，放入片段文件夹即可长期复用。",
							],
						},
						{
							h: "阅读模式行为",
							p: [
								"分隔符内为空（例如 ++++）时，当作普通文本，不做任何渲染——这和原生 == 处理 ==== 的方式一致。",
								"代码块、行内代码、公式与链接内部不会渲染，保护原有语义。",
							],
						},
						{
							h: "语义索引与伴生文件（实验性）",
							p: [
								"插件在「打开/编辑」笔记时懒加载建立自有索引，记录每条规则在何处匹配，可通过插件实例的 syntaxIndex API 被其他插件读取——不修改 Obsidian 元数据缓存。",
								"命令面板中的「Generate syntax metadata companion」会为当前笔记生成 <笔记名>.cs-meta.md 伴生文件，内含 Dataview 可读的内联字段，使自定义标记可被 Dataview 查询。该文件为额外生成，可按需删除。",
							],
						},
						{
							h: "已知限制",
							p: [
								"本插件只做视觉装饰，不新增真正的 Markdown AST 节点；复制到 Typora、Pandoc 导出时分隔符原样保留。",
								"嵌套块级语法为有限支持；代码块/公式内部不渲染。",
								"「可视化编辑」按钮为占位，尚未开放。",
							],
						},
				  ]
				: [
						{
							h: "Overview",
							p: [
								"Custom Syntax lets you define your own Markdown markers and style them with your own CSS. It only decorates the editor and reading view — it never rewrites your source.",
								"Live Preview / Source mode uses CodeMirror decorations; reading view uses a Markdown post-processor. Both are official, stable extension points.",
							],
						},
						{
							h: "Add a rule",
							p: [
								'Click "Add rule" in the right-sidebar rule manager, or "Open panel" in the settings.',
								"Pick a syntax category, fill in the marker, then write only what goes inside the CSS curly braces:",
							],
							code: "border: 1px solid var(--interactive-accent);\nborder-radius: 6px;\npadding: 1px 5px;",
						},
						{
							h: "The four syntax shapes",
							p: [
								"Inline pair: a delimiter wrapping text on the same line, e.g. ++text++.",
								"Fenced block: a Pandoc-style :::type … ::: container, on its own lines.",
								"Multiline block: a marker alone on its line opens, the same marker alone on a later line closes, e.g. ++ around several lines.",
								"Custom callout: > [!type] triggers a box rendered natively by Obsidian; we only add styling.",
							],
							code: "++inline text++\n\n:::note\nThis is a fenced block\n:::\n\n++\nThis is a multiline block\nspanning two lines\n++\n\n> [!mynote]\nThis is a custom callout",
						},
						{
							h: "Read type",
							p: [
								"Fenced blocks and callouts can read the type from the opening line (e.g. note / mynote) and expose it as a class hook, so a CSS snippet can target a type precisely.",
								"For example :::note gets the .cs-fence-note class; > [!mynote] maps to the native data-callout=\"mynote\".",
							],
						},
						{
							h: "Capture parameters",
							p: [
								'With "Capture parameters" on, write { .class #id key=value } after the marker to apply styles dynamically.',
								".class adds a class, #id sets the element id, key=value becomes inline CSS (e.g. color=red).",
							],
							code: ":::note { .box #main color=red }\nA fenced block with parameters\n:::",
						},
						{
							h: "Class-based styling (optional)",
							p: [
								'Fill in one or more CSS class names (space-separated) under "Class name". When declarations are left empty, styling comes entirely from your own CSS snippet for that class, so it can be reused and overridden by themes.',
								"Every rule also carries a stable class — .cs-block-<id> (blocks) or .custom-syntax-<id>-content (inline) — for precise targeting.",
							],
						},
						{
							h: "Export as CSS snippet",
							p: [
								'Under the settings "Export" group, click "Export CSS snippet" to export your rules\' styles as a .css file you can drop into your snippets folder.',
							],
						},
						{
							h: "Reading view",
							p: [
								"A delimiter with nothing inside (e.g. ++++) is left as plain text and not rendered — like how native == leaves ==== alone.",
								"Code blocks, inline code, math and links are never decorated, preserving their meaning.",
							],
						},
						{
							h: "Semantic index & companion (experimental)",
							p: [
								"As you open or edit a note, the plugin lazily builds its own index of where each rule matched. Other plugins can read it through the plugin instance's syntaxIndex API — the Obsidian metadata cache is never patched.",
								'The command palette command "Generate syntax metadata companion" writes a <note>.cs-meta.md companion next to the current note, with Dataview-readable inline fields so custom markers become queryable. The companion is an extra file you can delete at any time.',
							],
						},
						{
							h: "Known limitations",
							p: [
								"This plugin only decorates — it does not add real Markdown AST nodes, and when you copy to Typora or export via Pandoc the delimiters are kept as-is.",
								"Nested block syntax has limited support; code blocks and math are never rendered.",
								'The "Visual editor" button is a placeholder and is not yet available.',
							],
						},
				  ];

		for (const s of sections) {
			body.createEl("h3", { cls: "custom-syntax-doc-h", text: s.h });
			for (const para of s.p) {
				body.createEl("p", { cls: "custom-syntax-doc-p", text: para });
			}
			if (s.code !== undefined) {
				body.createEl("pre", {
					cls: "custom-syntax-doc-code",
					text: s.code,
				});
			}
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/**
 * Language switcher launched from the panel's bottom bar. Three rounded
 * options; tapping a row selects and applies it immediately, syncing back to
 * the global setting so every surface updates.
 */
export class LanguageModal extends Modal {
	private plugin: CustomSyntaxPlugin;

	constructor(app: App, plugin: CustomSyntaxPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("custom-syntax-lang");
		const t = stringsFor(this.plugin.settings.language);

		const nav = contentEl.createDiv({ cls: "custom-syntax-lang-nav" });
		nav.createDiv({
			cls: "custom-syntax-lang-nav-title",
			text: t.languageSwitch,
		});

		const body = contentEl.createDiv({ cls: "custom-syntax-lang-body" });
		const options: { value: Language; label: string }[] = [
			{ value: "system", label: t.followSystem },
			{ value: "zh", label: "简体中文" },
			{ value: "en", label: "English" },
		];
		for (const opt of options) {
			const row = body.createDiv({ cls: "custom-syntax-lang-row" });
			row.createSpan({ text: opt.label });
			const radio = row.createSpan({ cls: "custom-syntax-lang-radio" });
			if (this.plugin.settings.language === opt.value) {
				radio.addClass("is-selected");
			}
			row.addEventListener("click", () => this.select(opt.value));
		}
	}

	private select(value: Language): void {
		this.plugin.settings.language = value;
		void this.plugin.saveSettings().then(() => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
