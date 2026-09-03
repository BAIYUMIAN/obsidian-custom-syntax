export interface CssEditorHandle {
	getValue(): string;
	setValue(value: string): void;
	focus(): void;
	destroy(): void;
}
export function createCssEditor(): CssEditorHandle {
	return { getValue: () => "", setValue: () => {}, focus: () => {}, destroy: () => {} };
}
