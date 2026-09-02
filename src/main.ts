import { Extension } from "@codemirror/state";
import { MarkdownView, Plugin } from "obsidian";
import { createEditorExtension } from "./editorExtension";
import { applyRule } from "./postProcessor";
import {
	CustomSyntaxSettings,
	CustomSyntaxSettingTab,
	DEFAULT_SETTINGS,
	normalizeRule,
} from "./settings";

export default class CustomSyntaxPlugin extends Plugin {
	settings: CustomSyntaxSettings;
	private editorExtension: Extension[] = [];

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addSettingTab(new CustomSyntaxSettingTab(this.app, this));

		this.editorExtension.push(createEditorExtension(() => this.settings.rules));
		this.registerEditorExtension(this.editorExtension);

		this.registerMarkdownPostProcessor((el) => {
			for (const rule of this.settings.rules) {
				applyRule(el, rule);
			}
		});
	}

	onunload(): void {}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<CustomSyntaxSettings> | null;
		this.settings = { language: "system", rules: [] };

		const lang = data?.language;
		this.settings.language =
			lang === "en" || lang === "zh" || lang === "system" ? lang : "system";

		const rules = data?.rules;
		if (Array.isArray(rules)) {
			this.settings.rules = rules.map((r) => normalizeRule(r));
		} else {
			this.settings.rules = DEFAULT_SETTINGS.rules.map((r) => ({ ...r }));
		}
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
}
