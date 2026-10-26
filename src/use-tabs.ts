import { effect, read } from "@rbxts/vide";
import { Attribute } from "./attributes";
import type { Value } from "./props";
import { useControllable } from "./use-controllable";
import { usePress, type PressBinding } from "./use-press";

export interface TabsOptions<T> {
	value?: Value<T>;
	defaultValue?: T;
	onValueChange?: (value: T) => void;
	disabled?: Value<boolean>;
}
export interface TabsTriggerOptions {
	disabled?: Value<boolean>;
	selectFirst?: Value<boolean>;
}
export interface TabsTriggerBinding extends PressBinding {
	selected: () => boolean;
}
export interface TabsBinding<T> {
	value: () => T | undefined;
	trigger: (value: T, options?: TabsTriggerOptions) => TabsTriggerBinding;
}
export function useTabs<T>(options: TabsOptions<T> = {}): TabsBinding<T> {
	const [value, setValue] = useControllable<T | undefined>({
		value: options.value,
		defaultValue: options.defaultValue,
		onChange: (selected) => {
			if (selected !== undefined) options.onValueChange?.(selected);
		},
	});
	return {
		value,
		trigger: (key, trigger = {}) => {
			const selected = () => value() === key;
			const press = usePress({
				disabled: () => read(options.disabled ?? false) || read(trigger.disabled ?? false),
				selectFirst: trigger.selectFirst,
				onPress: () => setValue(key),
			});
			return {
				...press,
				selected,
				action: (instance) => {
					press.action(instance);
					effect(() => instance.SetAttribute(Attribute.Selected, selected()));
				},
			};
		},
	};
}
