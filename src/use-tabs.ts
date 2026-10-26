import { effect, read } from "@rbxts/vide";
import { Attribute } from "./attributes";
import type { Value } from "./props";
import { usePress, type PressBinding } from "./use-press";

export interface TabsOptions {
	selected: Value<number>;
	onSelect: (index: number) => void;
}
export interface TabOptions {
	selectFirst?: Value<boolean>;
	disabled?: Value<boolean>;
}
export interface TabBinding extends PressBinding {
	selected: () => boolean;
}
export interface TabsBinding {
	tab: (index: number, options?: TabOptions) => TabBinding;
}
export function useTabs(options: TabsOptions): TabsBinding {
	return {
		tab: (index, tabOptions = {}) => {
			const selected = () => read(options.selected) === index;
			const press = usePress({
				...tabOptions,
				onPress: () => {
					if (!selected()) options.onSelect(index);
				},
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
