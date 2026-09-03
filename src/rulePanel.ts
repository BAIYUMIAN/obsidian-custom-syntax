import { ItemView, setIcon, WorkspaceLeaf } from "obsidian";
import type CustomSyntaxPlugin from "./main";
import {
	newRuleId,
	renderRuleCard,
	RuleForm,
	stringsFor,
	LanguageModal,
	type SyntaxRule,
} from "./settings";

export const VIEW_TYPE_RULE_PANEL = "custom-syntax-rule-panel";

/**
 * The rule manager that lives in the right sidebar. It has two internal
 * "pages" selected by `mode`:
 *  - `list`   : navbar with a "new rule" button + the existing rule cards.
 *  - `editor` : navbar with a back button + the create/edit form in a
 *               scrollable body and a fixed footer (disabled "Visual editor"
 *               on the left, cancel/confirm on the right).
 */
export class RulePanelView extends ItemView {
	plugin: CustomSyntaxPlugin;
	private mode: "list" | "editor" = "list";
	private editing: SyntaxRule | null = null;
	private form: RuleForm | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: CustomSyntaxPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_RULE_PANEL;
	}

	getDisplayText(): string {
		return stringsFor(this.plugin.settings.language).pluginName;
	}

	getIcon(): string {
		return "braces";
	}

	async onOpen(): Promise<void> {
		this.rebuild();
	}

	async onClose(): Promise<void> {
		this.form?.destroy();
		this.form = null;
	}

	/** Rebuild the visible page from the current `mode`. */
	rebuild(): void {
		// Never clobber an open editor when an external update (e.g. a
		// language change in settings) asks us to rebuild.
		if (this.mode === "editor" && this.form) {
			return;
		}
		const root = this.contentEl;
		root.empty();
		root.addClass("custom-syntax-panel");
		const t = stringsFor(this.plugin.settings.language);
		if (this.mode === "list") {
			this.renderList(root, t);
		} else {
			this.renderEditor(root, t);
		}
	}

	private renderList(
		root: HTMLElement,
		t: ReturnType<typeof stringsFor>
	): void {
		const nav = root.createDiv({ cls: "custom-syntax-panel-nav" });
		const title = nav.createDiv({ cls: "custom-syntax-panel-nav-title" });
		title.createSpan({ text: t.pluginName });
		title.createSpan({
			cls: "custom-syntax-nav-version",
			text: `v${this.plugin.manifest.version}`,
		});
		const newBtn = nav.createEl("button", {
			text: t.addRule,
			cls: "mod-cta",
		});
		newBtn.addEventListener("click", () => this.openEditor(null));

		const body = root.createDiv({
			cls: "custom-syntax-panel-body custom-syntax-rules",
		});
		if (this.plugin.settings.rules.length === 0) {
			body.createDiv({ cls: "custom-syntax-empty", text: t.noRules });
		} else {
			this.plugin.settings.rules.forEach((rule) => {
				renderRuleCard(
					body,
					this.plugin,
					rule,
					() => this.rebuild(),
					(r) => this.openEditor(r)
				);
			});
		}

		// Bottom bar (main page only): language + settings icons on the right.
		const footer = root.createDiv({
			cls: "custom-syntax-panel-footer custom-syntax-panel-footer--main",
		});
		const langBtn = footer.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": t.languageSwitch },
		});
		setIcon(langBtn, "languages");
		langBtn.addEventListener("click", () => {
			new LanguageModal(this.app, this.plugin).open();
		});
		const settingsBtn = footer.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": t.openSettings },
		});
		setIcon(settingsBtn, "settings");
		settingsBtn.addEventListener("click", () => {
			void this.plugin.openPluginSettings();
		});
	}

	private renderEditor(
		root: HTMLElement,
		t: ReturnType<typeof stringsFor>
	): void {
		const nav = root.createDiv({
			cls: "custom-syntax-panel-nav is-editor",
		});
		const back = nav.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": t.back },
		});
		setIcon(back, "chevron-left");
		back.addEventListener("click", () => this.closeEditor());
		nav.createDiv({
			cls: "custom-syntax-panel-nav-title",
			text: this.editing ? t.editTitle : t.createTitle,
		});

		const body = root.createDiv({ cls: "custom-syntax-panel-body" });
		this.form = new RuleForm(body, this.plugin, this.editing, () =>
			this.submit()
		);

		// Fixed footer: disabled "Visual editor" on the left, actions on right.
		const footer = root.createDiv({ cls: "custom-syntax-panel-footer" });
		const visBtn = footer.createEl("button", {
			text: t.visualEdit,
			cls: "custom-syntax-visual-edit",
		});
		visBtn.disabled = true;
		visBtn.title = t.visualEditHint;

		const actions = footer.createDiv({
			cls: "custom-syntax-panel-footer-right",
		});
		const cancel = actions.createEl("button", { text: t.cancel });
		cancel.addEventListener("click", () => this.closeEditor());
		const submit = actions.createEl("button", {
			text: this.editing ? t.save : t.create,
			cls: "mod-cta",
		});
		submit.addEventListener("click", () => this.submit());
	}

	private openEditor(rule: SyntaxRule | null): void {
		this.editing = rule;
		this.mode = "editor";
		this.rebuild();
	}

	private closeEditor(): void {
		this.mode = "list";
		this.editing = null;
		this.form?.destroy();
		this.form = null;
		this.rebuild();
	}

	private async submit(): Promise<void> {
		const res = this.form?.validate();
		if (!res || !res.ok) {
			return;
		}
		const v = res.value;
		if (this.editing) {
			this.editing.name = v.name;
			this.editing.kind = v.kind;
			this.editing.open = v.open;
			this.editing.close = v.close;
			this.editing.readType = v.readType;
			this.editing.captureParams = v.captureParams;
			this.editing.css = v.css;
			this.editing.className = v.className;
			this.editing.enabled = v.enabled;
			this.editing.conflictWithId = null;
		} else {
			this.plugin.settings.rules.push({
				id: newRuleId(),
				name: v.name,
				kind: v.kind,
				open: v.open,
				close: v.close,
				readType: v.readType,
				captureParams: v.captureParams,
				css: v.css,
				className: v.className,
				enabled: v.enabled,
				conflictWithId: null,
			});
		}
		this.mode = "list";
		this.editing = null;
		this.form?.destroy();
		this.form = null;
		await this.plugin.saveSettings();
		this.rebuild();
	}
}
