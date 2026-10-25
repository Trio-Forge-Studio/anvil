export interface Selection<T extends defined> {
	readonly marked: readonly T[];
	readonly remembered?: T;
	readonly paused: boolean;
}
export type SelectionEvent<T> =
	| { readonly kind: "Shown" }
	| { readonly kind: "Marked"; readonly object: T; readonly replaces?: T }
	| { readonly kind: "Unmarked"; readonly object: T }
	| { readonly kind: "Selected"; readonly object: T }
	| { readonly kind: "Lost"; readonly removed: boolean };
export interface PolicyContext<T extends defined> {
	readonly current?: T;
	readonly alive: (object: T) => boolean;
	readonly canSelect: boolean;
	readonly close?: T;
}
export interface Decision<T extends defined> {
	readonly selection: Selection<T>;
	readonly target?: T | "Root";
}
export function emptySelection<T extends defined>(): Selection<T> {
	return { marked: [], paused: false };
}
function fallback<T extends defined>(selection: Selection<T>, context: PolicyContext<T>): T | "Root" {
	for (let i = selection.marked.size() - 1; i >= 0; i--) {
		const object = selection.marked[i];
		if (context.alive(object)) return object;
	}
	return context.close !== undefined && context.alive(context.close) ? context.close : "Root";
}
export function decide<T extends defined>(
	selection: Selection<T>,
	event: SelectionEvent<T>,
	context: PolicyContext<T>,
): Decision<T> {
	switch (event.kind) {
		case "Shown":
			return {
				selection,
				target:
					context.canSelect && !selection.paused
						? selection.remembered !== undefined && context.alive(selection.remembered)
							? selection.remembered
							: fallback(selection, context)
						: undefined,
			};
		case "Marked": {
			if (selection.marked.includes(event.object)) return { selection };
			const changed = { ...selection, marked: [...selection.marked, event.object] };
			return {
				selection: changed,
				target:
					context.canSelect &&
					!selection.paused &&
					(context.current === undefined || context.current === event.replaces)
						? event.object
						: undefined,
			};
		}
		case "Unmarked":
			return {
				selection: { ...selection, marked: selection.marked.filter((object) => object !== event.object) },
			};
		case "Selected":
			return { selection: { ...selection, remembered: event.object, paused: false } };
		case "Lost":
			return event.removed
				? {
						selection: { ...selection, remembered: undefined },
						target: context.canSelect && !selection.paused ? fallback(selection, context) : undefined,
					}
				: { selection: { ...selection, paused: true } };
	}
}
