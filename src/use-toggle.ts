import { effect, read } from "@rbxts/vide";
import { Attribute } from "./attributes";
import type { Value } from "./props";
import { usePress, type PressBinding } from "./use-press";

export interface ToggleOptions {
	on: Value<boolean>;
	onToggle: (on: boolean) => void;
	disabled?: Value<boolean>;
	selectFirst?: Value<boolean>;
	silent?: boolean;
}
export interface ToggleBinding extends PressBinding {
	on: () => boolean;
}
export function useToggle(options: ToggleOptions): ToggleBinding {
	const on = () => read(options.on);
	const press = usePress({ ...options, onPress: () => options.onToggle(!on()) });
	return {
		...press,
		on,
		action: (instance) => {
			press.action(instance);
			effect(() => instance.SetAttribute(Attribute.Selected, on()));
		},
	};
}
