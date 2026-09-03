import { Extension } from "@codemirror/state";
import { MarkdownView, Plugin } from "obsidian";
import { createEditorExtension } from "./editorExtension";
import { applyRule } from "./postProcessor";
import {
	CustomSyntaxSettings,
	CustomSyntaxSettingTab,
	DEFAULT_SETTINGS,
	normalizeRule,
	stringsFor,
} from "./settings";
import { RulePanelView, VIEW_TYPE_RULE_PANEL } from "./rulePanel";

export default class CustomSyntaxPlugin extends Plugin {
	settings: CustomSyntaxSettings;
	private editorExtension: Extension[] = [];
	private ribbonEl: HTMLElement | null = null;
	private settingTab: CustomSyntaxSettingTab | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.settingTab = new CustomSyntaxSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);

		this.registerView(
			VIEW_TYPE_RULE_PANEL,
			(leaf) => new RulePanelView(leaf, this)
		);

		this.ribbonEl = this.addRibbonIcon(
			"braces",
			stringsFor(this.settings.language).pluginName,
			() => this.activateRulePanel()
		);
		this.updateRibbonVisibility();

		this.editorExtension.push(createEditorExtension(() => this.settings.rules));
		this.registerEditorExtension(this.editorExtension);

		this.registerMarkdownPostProcessor((el) => {
			for (const rule of this.settings.rules) {
				applyRule(el, rule);
			}
		});
	}

	onunload(): void {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_RULE_PANEL);
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as
			| Partial<CustomSyntaxSettings>
			| null;
		this.settings = { language: "system", rules: [], showRibbon: true };

		const lang = data?.language;
		this.settings.language =
			lang === "en" || lang === "zh" || lang === "system"
				? lang
				: "system";

		const rules = data?.rules;
		if (Array.isArray(rules)) {
			this.settings.rules = rules.map((r) => normalizeRule(r));
		} else {
			this.settings.rules = DEFAULT_SETTINGS.rules.map((r) => ({ ...r }));
		}

		this.settings.showRibbon = data?.showRibbon ?? true;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.refresh();
	}

	refresh(): void {
		this.editorExtension.length = 0;
		this.editorExtension.push(createEditorExtension(() => this.settings.rules));
		this.app.workspace.updateOptions();
		this.rerenderPreviews();
		this.notifyRulePanel();
		// A language change from anywhere should refresh every visible surface.
		const appSetting = (this.app as unknown as {
			setting?: { activeTab?: unknown };
		}).setting;
		if (appSetting?.activeTab === this.settingTab) {
			this.settingTab?.display();
		}
		this.updateRibbon();
	}

	/** Open this plugin's page in Obsidian's native settings. */
	async openPluginSettings(): Promise<void> {
		const appSetting = (this.app as unknown as {
			setting?: {
				open: () => void | Promise<void>;
				openTabById: (id: string) => void;
			};
		}).setting;
		if (!appSetting) return;
		// The settings modal must be open before we can navigate to a tab.
		// A tick of delay lets Obsidian finish rendering the modal first.
		appSetting.open();
		await new Promise((r) => setTimeout(r, 0));
		appSetting.openTabById(this.manifest.id);
	}

	/** Keep the ribbon icon's tooltip in sync with the active language. */
	private updateRibbon(): void {
		if (this.ribbonEl) {
			const name = stringsFor(this.settings.language).pluginName;
			this.ribbonEl.setAttribute("aria-label", name);
			this.ribbonEl.title = name;
		}
	}

	/**
	 * `updateOptions()` only refreshes editors. Reading view content is
	 * produced once by the post-processor, so it has to be re-rendered
	 * explicitly for a rule change to show up there.
	 */
	private rerenderPreviews(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.previewMode) {
				view.previewMode.rerender(true);
			}
		});
	}

	/** Rebuild the rule-manager panel if it is currently open. */
	private notifyRulePanel(): void {
		this.app.workspace.getLeavesOfType(VIEW_TYPE_RULE_PANEL).forEach((leaf) => {
			if (leaf.view instanceof RulePanelView) {
				leaf.view.rebuild();
			}
		});
	}

	/** Open (or reveal) the rule-manager panel in the right sidebar. */
	activateRulePanel(): void {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_RULE_PANEL);
		let leaf = existing[0];
		if (!leaf) {
			const right = workspace.getRightLeaf(false);
			if (right) {
				leaf = right;
				leaf.setViewState({
					type: VIEW_TYPE_RULE_PANEL,
					active: true,
				});
			}
		}
		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	/** Show or hide the left-ribbon icon based on `settings.showRibbon`. */
	private updateRibbonVisibility(): void {
		if (this.ribbonEl) {
			this.ribbonEl.toggleClass(
				"custom-syntax-ribbon-hidden",
				!this.settings.showRibbon
			);
		}
	}
}
