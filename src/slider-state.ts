export interface SliderRange {
	min: number;
	max: number;
	step: number;
}
function finite(value: number): boolean {
	return value === value && math.abs(value) < math.huge;
}
export function validateRange(range: SliderRange): void {
	assert(
		finite(range.min) && finite(range.max) && range.min <= range.max,
		"Slider bounds must be finite and ordered",
	);
	assert(finite(range.step) && range.step > 0, "Slider step must be finite and positive");
}
export function snapValue(value: number, range: SliderRange): number {
	assert(finite(value), "Slider value must be finite");
	const clamped = math.clamp(value, range.min, range.max);
	if (clamped === range.max) return range.max;
	return math.clamp(range.min + math.round((clamped - range.min) / range.step) * range.step, range.min, range.max);
}
export class SliderCommit {
	private changed?: number;
	begin(): void {
		this.changed = undefined;
	}
	change(value: number): void {
		this.changed = value;
	}
	release(): number | undefined {
		const value = this.changed;
		this.changed = undefined;
		return value;
	}
}
