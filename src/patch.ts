import { UserError } from "./errors.ts";
import type { BiosProfile, PatchResult } from "./types.ts";

export function applyPatches(
	setupdata: Uint8Array,
	profile: BiosProfile,
): PatchResult[] {
	const results: PatchResult[] = [];

	for (const patch of profile.patches) {
		const current = setupdata[patch.offset];
		if (current === undefined || current !== patch.from) {
			throw new UserError(
				`Patch mismatch at ${formatOffset(patch.offset)} for "${patch.label}": ` +
					`expected ${hexByte(patch.from)}, found ${current === undefined ? "out of range" : hexByte(current)}. ` +
					`Wrong BIOS version or already patched.`,
			);
		}
		setupdata[patch.offset] = patch.to;
		results.push({
			offset: patch.offset,
			label: patch.label,
			from: patch.from,
			to: patch.to,
			applied: true,
		});
	}

	return results;
}

export function patchSetupdataInPlace(
	decompressed: Uint8Array,
	profile: BiosProfile,
): { setupdata: Uint8Array; results: PatchResult[] } {
	const { offsetInDecompressed, size } = profile.setupdata;
	const setupdata = new Uint8Array(
		decompressed.slice(offsetInDecompressed, offsetInDecompressed + size),
	);
	const results = applyPatches(setupdata, profile);
	const out = new Uint8Array(decompressed);
	out.set(setupdata, offsetInDecompressed);
	return { setupdata, results };
}

function formatOffset(offset: number): string {
	return `0x${offset.toString(16).toUpperCase()}`;
}

function hexByte(value: number): string {
	return `0x${value.toString(16).padStart(2, "0").toUpperCase()}`;
}
