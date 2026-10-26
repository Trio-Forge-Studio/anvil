import type Vide from "@rbxts/vide";

export type HostProps<T extends Instance> = Vide.InstanceAttributes<T>;
export function chain<T>(first: (instance: T) => void, second?: (instance: T) => void): (instance: T) => void {
	if (!second) return first;
	return (instance) => {
		first(instance);
		second(instance);
	};
}

// roblox-ts has no object rest, so parts copy their props without the keys they own before spreading them on the host.
export function hostProps<P extends object, K extends keyof P>(
	props: P,
	own: readonly K[],
): Pick<P, Exclude<keyof P, K | "children" | "action" | "asChild">> {
	const skip = new Set<unknown>(["children", "action", "asChild", ...own]);
	const result: Record<string, unknown> = {};
	for (const [key, value] of pairs(props as Record<string, unknown>)) if (!skip.has(key)) result[key] = value;
	return result as never;
}
