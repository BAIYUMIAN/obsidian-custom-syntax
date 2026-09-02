import { Extension } from "@codemirror/state";
import { Plugin } from "obsidian";
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
	}
}
