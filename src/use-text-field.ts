import { cleanup, effect, read, source } from "@rbxts/vide";
import { Attribute } from "./attributes";
import { useModalActive } from "./modal";
import type { Value } from "./props";
import { completionText, limitText, validateMaxLength } from "./text-field-state";
import { usePress } from "./use-press";

export interface TextFieldOptions {
	text: Value<string>;
	onChange: (text: string) => void;
	onSubmit?: (text: string) => void;
	onCommit?: (text: string) => void;
	completion?: Value<string | undefined>;
	maxLength?: number;
	autoFocus?: boolean;
	disabled?: Value<boolean>;
	invalid?: Value<boolean>;
	selectFirst?: Value<boolean>;
}
export interface TextFieldBinding {
	editing: () => boolean;
	highlighted: () => boolean;
	pressed: () => boolean;
	completionText: () => string | undefined;
	field: (instance: GuiButton) => void;
	box: (instance: TextBox) => void;
}
export function useTextField(options: TextFieldOptions): TextFieldBinding {
	validateMaxLength(options.maxLength);
	const editing = source(false);
	const active = useModalActive();
	const disabled = () => read(options.disabled ?? false);
	let box: TextBox | undefined;
	let alive = true;
	cleanup(() => {
		alive = false;
	});
	const capture = () => {
		if (box && active() && !disabled() && !box.IsFocused()) box.CaptureFocus();
	};
	const press = usePress({ onPress: capture, disabled, selectFirst: options.selectFirst });
	return {
		editing,
		highlighted: press.highlighted,
		pressed: press.pressed,
		completionText: () => completionText(read(options.text), read(options.completion)),
		field: (instance) => {
			press.action(instance);
			effect(() => instance.SetAttribute(Attribute.Editing, editing()));
			effect(() => instance.SetAttribute(Attribute.Invalid, read(options.invalid ?? false)));
		},
		box: (instance) => {
			box = instance;
			let attached = true;
			let currentText = read(options.text);
			const write = (text: string) => {
				currentText = text;
				instance.Text = text;
			};
			instance.ClearTextOnFocus = false;
			instance.Selectable = false;
			effect(() => {
				instance.TextEditable = !disabled();
			});
			effect(() => write(read(options.text)));
			cleanup(
				instance.GetPropertyChangedSignal("Text").Connect(() => {
					if (!attached || instance.Text === currentText) return;
					if (disabled()) {
						write(read(options.text));
						return;
					}
					const previous = currentText;
					const text = limitText(instance.Text, options.maxLength);
					currentText = text;
					if (text !== instance.Text) write(text);
					if (text !== previous) options.onChange(text);
				}),
			);
			cleanup(instance.Focused.Connect(() => editing(true)));
			cleanup(
				instance.FocusLost.Connect((enterPressed) => {
					if (!attached) return;
					editing(false);
					const completion = read(options.completion);
					const previous = currentText;
					const text = limitText(
						enterPressed && completion !== undefined ? completion : instance.Text,
						options.maxLength,
					);
					write(text);
					if (text !== previous) options.onChange(text);
					if (enterPressed) options.onSubmit?.(text);
					options.onCommit?.(text);
				}),
			);
			cleanup(() => {
				attached = false;
				if (box === instance) box = undefined;
				editing(false);
				if (instance.IsFocused()) instance.ReleaseFocus();
			});
			if (options.autoFocus)
				task.defer(() => {
					if (alive && attached && box === instance) capture();
				});
		},
	};
}
