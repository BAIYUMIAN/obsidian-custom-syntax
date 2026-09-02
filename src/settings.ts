import { App, Modal, PluginSettingTab, Setting, setIcon } from "obsidian";
import type CustomSyntaxPlugin from "./main";

export type Language = "en" | "zh" | "system";
type ResolvedLanguage = "en" | "zh";

export interface SyntaxRule {
	id: string;
	name: string;
	delimiter: string;
	css: string;
	enabled: boolean;
	conflictWithId?: string | null;
}

export interface CustomSyntaxSettings {
	language: Language;
	rules: SyntaxRule[];
}

export const DEFAULT_SETTINGS: CustomSyntaxSettings = {
	language: "system",
	rules: [
		{
			id: "rounded-box",
			name: "圆角边框",
			delimiter: "++",
			css: "border: 1px solid var(--interactive-accent); border-radius: 6px; padding: 1px 5px;",
			enabled: true,
		},
	],
};

export function newRuleId(): string {
	return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizeRule(r: Partial<SyntaxRule>): SyntaxRule {
	return {
		id: typeof r.id === "string" && r.id ? r.id : newRuleId(),
		name: typeof r.name === "string" ? r.name : "",
		delimiter: r.delimiter ?? "",
		css: r.css ?? "",
		enabled: r.enabled ?? true,
		conflictWithId: r.conflictWithId ?? null,
	};
}

export function ruleClassName(id: string): string {
	return `custom-syntax-${id}`;
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
		if (delimitersConflict(delim, r.delimiter)) {
			return r;
		}
	}
	return null;
}

interface UIStrings {
	pluginName: string;
	addRule: string;
	followSystem: string;
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
	cancel: string;
	create: string;
	save: string;
	delimiterRequired: string;
	conflictBuiltin: string;
	conflictCustomCreate: string;
	conflictCustomSave: string;
	conflictAnnotation: string;
	untitled: string;
}

const STRINGS: Record<ResolvedLanguage, UIStrings> = {
	zh: {
		pluginName: "自定义语法",
		addRule: "添加规则",
		followSystem: "跟随系统",
		edit: "编辑",
		delete: "删除",
		deleteConfirm: "确定要删除规则「{name}」吗？",
		createTitle: "新建规则",
		editTitle: "编辑规则",
		ruleName: "规则名",
		ruleNamePlaceholder: "给规则起个名字",
		delimiter: "分隔符",
		delimiterDesc: "包裹文字的标记，例如 ++",
		css: "CSS 样式",
		cssDesc: "应用到匹配文字的原始 CSS 声明，例如 border: 1px solid red;",
		cssPlaceholder:
			"border: 1px solid var(--interactive-accent); border-radius: 6px;",
		cancel: "取消",
		create: "创建",
		save: "保存",
		delimiterRequired: "分隔符不能为空",
		conflictBuiltin: "与 Markdown 内置语法「{name}」冲突",
		conflictCustomCreate: "与自定义语法「{name}」冲突，再次确认将创建并禁用",
		conflictCustomSave: "与自定义语法「{name}」冲突，再次确认将保存并禁用",
		conflictAnnotation: "与「{name}」冲突",
		untitled: "未命名",
	},
	en: {
		pluginName: "Custom Syntax",
		addRule: "Add rule",
		followSystem: "Follow system",
		edit: "Edit",
		delete: "Delete",
		deleteConfirm: "Delete rule \"{name}\"?",
		createTitle: "New rule",
		editTitle: "Edit rule",
		ruleName: "Rule name",
		ruleNamePlaceholder: "Name this rule",
		delimiter: "Delimiter",
		delimiterDesc: "The marker that wraps the text, e.g. ++",
		css: "CSS",
		cssDesc: "Raw CSS declarations applied to the matched text, e.g. border: 1px solid red;",
		cssPlaceholder:
			"border: 1px solid var(--interactive-accent); border-radius: 6px;",
		cancel: "Cancel",
		create: "Create",
		save: "Save",
		delimiterRequired: "Delimiter is required",
		conflictBuiltin: "Conflicts with built-in Markdown syntax \"{name}\"",
		conflictCustomCreate:
			"Conflicts with custom syntax \"{name}\" — confirm again to create (disabled)",
		conflictCustomSave:
			"Conflicts with custom syntax \"{name}\" — confirm again to save (disabled)",
		conflictAnnotation: "Conflicts with \"{name}\"",
		untitled: "Untitled",
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

class RuleModal extends Modal {
	plugin: CustomSyntaxPlugin;
	rule: SyntaxRule | null;
	onDone: () => void;

	private nameInput!: HTMLInputElement;
	private delimInput!: HTMLInputElement;
	private cssInput!: HTMLTextAreaElement;
	private errorEl!: HTMLElement;
	private pendingCustomConflict: SyntaxRule | null = null;

	constructor(
		app: App,
		plugin: CustomSyntaxPlugin,
		rule: SyntaxRule | null,
		onDone: () => void
	) {
		super(app);
		this.plugin = plugin;
		this.rule = rule;
		this.onDone = onDone;
	}

	onOpen(): void {
		const t = stringsFor(this.plugin.settings.language);
		this.titleEl.setText(this.rule ? t.editTitle : t.createTitle);
		const { contentEl } = this;

		new Setting(contentEl).setName(t.ruleName).addText((text) => {
			this.nameInput = text.inputEl;
			text.setValue(this.rule?.name ?? "").setPlaceholder(t.ruleNamePlaceholder);
		});

		new Setting(contentEl)
			.setName(t.delimiter)
			.setDesc(t.delimiterDesc)
			.addText((text) => {
				this.delimInput = text.inputEl;
				text.setValue(this.rule?.delimiter ?? "++").setPlaceholder("++");
				this.delimInput.addEventListener("input", () => {
					this.pendingCustomConflict = null;
					this.clearError();
				});
			});

		new Setting(contentEl)
			.setName(t.css)
			.setDesc(t.cssDesc)
			.addTextArea((ta) => {
				this.cssInput = ta.inputEl;
				ta
					.setValue(this.rule?.css ?? DEFAULT_SETTINGS.rules[0].css)
					.setPlaceholder(t.cssPlaceholder);
				this.cssInput.rows = 3;
				this.cssInput.addClass("custom-syntax-css-input");
			});

		this.errorEl = contentEl.createDiv({ cls: "custom-syntax-error" });
		this.errorEl.style.display = "none";

		const btnRow = contentEl.createDiv({ cls: "custom-syntax-modal-actions" });
		const cancelBtn = btnRow.createEl("button", { text: t.cancel });
		cancelBtn.addEventListener("click", () => this.close());

		const submitBtn = btnRow.createEl("button", {
			text: this.rule ? t.save : t.create,
			cls: "mod-cta",
		});
		submitBtn.addEventListener("click", () => this.onSubmit());
	}

	private clearError(): void {
		this.errorEl.empty();
		this.errorEl.style.display = "none";
	}

	private showError(msg: string): void {
		this.errorEl.empty();
		this.errorEl.createEl("span", { text: msg });
		this.errorEl.style.display = "block";
	}

	private onSubmit(): void {
		const t = stringsFor(this.plugin.settings.language);
		const lang = resolveLanguage(this.plugin.settings.language);
		const name = this.nameInput.value.trim();
		const delimiter = this.delimInput.value;
		const css = this.cssInput.value;

		if (!delimiter) {
			this.showError(t.delimiterRequired);
			return;
		}

		const builtin = findBuiltinConflict(delimiter);
		if (builtin) {
			const nm = lang === "zh" ? builtin.zh : builtin.en;
			this.showError(t.conflictBuiltin.replace("{name}", nm));
			this.pendingCustomConflict = null;
			return;
		}

		const custom = findCustomConflict(
			delimiter,
			this.plugin.settings.rules,
			this.rule?.id
		);
		if (custom) {
			const nm = custom.name || t.untitled;
			if (this.pendingCustomConflict && this.pendingCustomConflict.id === custom.id) {
				this.finish(name, delimiter, css, false);
				return;
			}
			this.pendingCustomConflict = custom;
			const msg = this.rule ? t.conflictCustomSave : t.conflictCustomCreate;
			this.showError(msg.replace("{name}", nm));
			return;
		}

		this.finish(name, delimiter, css, this.rule ? this.rule.enabled : true);
	}

	private finish(
		name: string,
		delimiter: string,
		css: string,
		enabled: boolean
	): void {
		const t = stringsFor(this.plugin.settings.language);
		const finalName = name || t.untitled;

		if (this.rule) {
			this.rule.name = finalName;
			this.rule.delimiter = delimiter;
			this.rule.css = css;
			this.rule.enabled = enabled;
			this.rule.conflictWithId = null;
		} else {
			this.plugin.settings.rules.push({
				id: newRuleId(),
				name: finalName,
				delimiter,
				css,
				enabled,
				conflictWithId: null,
			});
		}

		this.plugin.saveSettings();
		this.close();
		this.onDone();
	}
}

class ConfirmModal extends Modal {
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
		title.createEl("span", { text: t.pluginName });
		title.createEl("span", {
			cls: "custom-syntax-nav-version",
			text: `v${this.plugin.manifest.version}`,
		});

		const actions = nav.createDiv({ cls: "custom-syntax-nav-actions" });

		const langSelect = actions.createEl("select") as HTMLSelectElement;
		langSelect.addClass("dropdown");
		const options: Array<[Language, string]> = [
			["system", t.followSystem],
			["zh", "中文"],
			["en", "English"],
		];
		for (const [value, label] of options) {
			const opt = document.createElement("option");
			opt.value = value;
			opt.textContent = label;
			langSelect.appendChild(opt);
		}
		langSelect.value = this.plugin.settings.language;
		langSelect.addEventListener("change", async () => {
			this.plugin.settings.language = langSelect.value as Language;
			await this.plugin.saveSettings();
			this.display();
		});

		const addBtn = actions.createEl("button", {
			text: t.addRule,
			cls: "mod-cta",
		});
		addBtn.addEventListener("click", () => {
			new RuleModal(this.app, this.plugin, null, () => this.display()).open();
		});

		const list = containerEl.createDiv({ cls: "custom-syntax-rules" });
		this.plugin.settings.rules.forEach((rule) => {
			this.renderRuleCard(list, rule);
		});
	}

	private renderRuleCard(containerEl: HTMLElement, rule: SyntaxRule): void {
		const t = stringsFor(this.plugin.settings.language);
		const card = containerEl.createDiv({ cls: "custom-syntax-rule-card" });

		const row = card.createDiv({ cls: "custom-syntax-rule-row" });

		const nameEl = row.createDiv({
			cls: "custom-syntax-rule-name",
			text: rule.name || t.untitled,
		});
		nameEl.title = rule.delimiter;

		const controls = row.createDiv({ cls: "custom-syntax-rule-controls" });

		const editBtn = controls.createEl("button", { cls: "clickable-icon" });
		editBtn.setAttribute("aria-label", t.edit);
		setIcon(editBtn, "pencil");
		editBtn.addEventListener("click", () => {
			new RuleModal(this.app, this.plugin, rule, () => this.display()).open();
		});

		const delBtn = controls.createEl("button", { cls: "clickable-icon" });
		delBtn.setAttribute("aria-label", t.delete);
		setIcon(delBtn, "trash");
		delBtn.addEventListener("click", () => {
			const name = rule.name || t.untitled;
			new ConfirmModal(
				this.app,
				t.deleteConfirm.replace("{name}", name),
				t.delete,
				t.cancel,
				() => this.deleteRule(rule)
			).open();
		});

		// Native Obsidian toggle: the is-enabled class drives the look.
		const toggle = controls.createDiv({
			cls: rule.enabled ? "checkbox-container is-enabled" : "checkbox-container",
		});
		toggle.createEl("input", { attr: { type: "checkbox", tabindex: "0" } });
		toggle.addEventListener("click", async () => {
			const newVal = !rule.enabled;
			toggle.toggleClass("is-enabled", newVal);
			await this.toggleRule(rule, newVal);
			window.setTimeout(() => this.display(), 180);
		});

		if (rule.conflictWithId) {
			const other = this.plugin.settings.rules.find(
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

	private async toggleRule(rule: SyntaxRule, enabled: boolean): Promise<void> {
		rule.enabled = enabled;
		rule.conflictWithId = null;

		if (enabled) {
			for (const other of this.plugin.settings.rules) {
				if (
					other !== rule &&
					other.enabled &&
					delimitersConflict(rule.delimiter, other.delimiter)
				) {
					other.enabled = false;
					other.conflictWithId = rule.id;
				}
			}
		}

		await this.plugin.saveSettings();
	}

	private async deleteRule(rule: SyntaxRule): Promise<void> {
		this.plugin.settings.rules = this.plugin.settings.rules.filter(
			(r) => r !== rule
		);
		for (const r of this.plugin.settings.rules) {
			if (r.conflictWithId === rule.id) {
				r.conflictWithId = null;
			}
		}
		await this.plugin.saveSettings();
		this.display();
	}
}
