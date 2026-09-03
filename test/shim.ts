// Minimal stubs so postProcessor.ts / settings.ts can be bundled and unit-
// tested in Node without the real Obsidian runtime or CodeMirror stack.
export class App {}
export class Modal {
	contentEl: any = {};
	onOpen(): void {}
	onClose(): void {}
	close(): void {}
}
export class PluginSettingTab {
	containerEl: any = {};
	plugin: any;
	app: any;
	display(): void {}
}
export class Setting {
	setName(): this { return this; }
	setDesc(): this { return this; }
	setHeading(): this { return this; }
	addText(): this { return this; }
	addToggle(): this { return this; }
	addButton(): this { return this; }
	addDropdown(): this { return this; }
}
export function setIcon(): void {}
export function createDiv(): any {
	return {
		addClass() {},
		createEl() { return createDiv(); },
		createDiv() { return createDiv(); },
		createSpan() { return createDiv(); },
		empty() {},
	};
}
export function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
