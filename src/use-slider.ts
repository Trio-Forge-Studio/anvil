import { effect, read } from "@rbxts/vide";
import { Attribute } from "./attributes";
import type { Value } from "./props";
import { SliderCommit, snapValue, validateRange } from "./slider-state";
import { usePress, type PressBinding } from "./use-press";

export interface SliderOptions {
	value: Value<number>;
	min?: number;
	max: number;
	step?: number;
	onChange: (value: number) => void;
	onCommit?: (value: number) => void;
	disabled?: Value<boolean>;
	selectFirst?: Value<boolean>;
	silent?: boolean;
}
export interface SliderBinding {
	value: () => number;
	fraction: () => number;
	atMin: () => boolean;
	atMax: () => boolean;
	decrement: PressBinding;
	increment: PressBinding;
	set: (value: number) => void;
	segment: (value: number) => PressBinding;
}
export function useSlider(options: SliderOptions): SliderBinding {
	const range = { min: options.min ?? 0, max: options.max, step: options.step ?? 1 };
	validateRange(range);
	const value = () => snapValue(read(options.value), range);
	const atMin = () => value() === range.min;
	const atMax = () => value() === range.max;
	const disabled = () => read(options.disabled ?? false);
	const change = (requested: number, hold?: SliderCommit) => {
		if (disabled()) return;
		const snapped = snapValue(requested, range);
		if (snapped === value()) return;
		hold?.change(snapped);
		options.onChange(snapped);
		return snapped;
	};
	const set = (requested: number) => {
		const changed = change(requested);
		if (changed !== undefined) options.onCommit?.(changed);
	};
	const stepButton = (direction: number): PressBinding => {
		const hold = new SliderCommit();
		return usePress({
			repeating: true,
			silent: options.silent,
			selectFirst: direction < 0 ? options.selectFirst : undefined,
			disabled: () => disabled() || (direction < 0 ? atMin() : atMax()),
			onPress: () => {
				change(value() + direction * range.step, hold);
			},
			onPressedChange: (down) => {
				if (down) hold.begin();
			},
			onRelease: () => {
				const committed = hold.release();
				if (committed !== undefined) options.onCommit?.(committed);
			},
		});
	};
	return {
		value,
		fraction: () => (range.max === range.min ? 0 : (value() - range.min) / (range.max - range.min)),
		atMin,
		atMax,
		decrement: stepButton(-1),
		increment: stepButton(1),
		set,
		segment: (requested) => {
			const snapped = snapValue(requested, range);
			const press = usePress({ onPress: () => set(snapped), disabled, silent: options.silent });
			return {
				...press,
				action: (instance) => {
					press.action(instance);
					effect(() => instance.SetAttribute(Attribute.Selected, snapped <= value()));
				},
			};
		},
	};
}
