import { MarkdownView, Plugin } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { bumpSettingsVersion, createEditorExtension } from "./editorExtension";
import { applyRule } from "./postProcessor";
import {
	CustomSyntaxSettings,
	CustomSyntaxSettingTab,
	DEFAULT_SETTINGS,
	normalizeRule,
	ruleClassName,
} from "./settings";

export default class CustomSyntaxPlugin extends Plugin {
	settings: CustomSyntaxSettings;
	private styleEl: HTMLStyleElement | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addSettingTab(new CustomSyntaxSettingTab(this.app, this));

		this.registerEditorExtension(
			createEditorExtension(() => this.settings.rules)
		);

		this.registerMarkdownPostProcessor((el) => {
			for (const rule of this.settings.rules) {
				applyRule(el, rule);
			}
		});

		this.refreshStylesheet();
	}

	onunload(): void {
		this.styleEl?.detach();
		this.styleEl = null;
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<CustomSyntaxSettings> | null;
		this.settings = { language: "system", rules: [] };

		const lang = data?.language;
		this.settings.language =
			lang === "en" || lang === "zh" || lang === "system"
				? lang
				: "system";

		const rules = data?.rules;
		if (
			Array.isArray(rules) &&
			rules.length > 0 &&
			typeof rules[0].css === "string"
		) {
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
		this.refreshStylesheet();
		bumpSettingsVersion();

		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) {
				continue;
			}

			// Live Preview / Source mode: force the editor to rebuild decorations.
			const editor = view.editor as unknown as {
				cm?: EditorView;
			} | null;
			editor?.cm?.dispatch({});

			// Reading view: force a full re-render.
			view.previewMode?.rerender(true);
		}
	}

	refreshStylesheet(): void {
		if (!this.styleEl) {
			this.styleEl = document.createElement("style");
			this.styleEl.setAttribute("data-custom-syntax", "");
			document.head.appendChild(this.styleEl);
		}

		const rules = this.settings.rules.filter(
			(r) => r.enabled && r.delimiter && r.css
		);
		this.styleEl.textContent = rules
			.map((r) => `.${ruleClassName(r.id)} { ${r.css} }`)
			.join("\n");
	}
}
