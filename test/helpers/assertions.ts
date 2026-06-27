export function countBytesChangedOutsideRegion(
	before: Uint8Array,
	after: Uint8Array,
	regionStart: number,
	regionSize: number,
): number {
	let count = 0;
	const regionEnd = regionStart + regionSize;
	const limit = Math.min(before.length, after.length);
	for (let i = 0; i < limit; i++) {
		if (i < regionStart || i >= regionEnd) {
			if (before[i] !== after[i]) {
				count++;
			}
		}
	}
	return count;
}
