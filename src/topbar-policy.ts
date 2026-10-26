export interface TopbarCandidate<T> {
	readonly object: T;
	readonly x: number;
	readonly available: boolean;
}
export function pickTopbarIcon<T extends defined>(
	candidates: readonly TopbarCandidate<T>[],
	remembered?: T,
): T | undefined {
	let first: TopbarCandidate<T> | undefined;
	for (const candidate of candidates) {
		if (!candidate.available) continue;
		if (candidate.object === remembered) return remembered;
		if (first === undefined || candidate.x < first.x) first = candidate;
	}
	return first?.object;
}
