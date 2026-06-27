import { capify, decapify } from "./io.ts";
import type { BiosProfile } from "./types.ts";
import { unlockBios } from "./unlock.ts";

export function buildFlashCap(
	stockCap: Uint8Array,
	profile: BiosProfile,
): Uint8Array {
	const biosBody = decapify(stockCap);
	const modBody = unlockBios(biosBody, { profile });
	return capify(stockCap, modBody);
}
