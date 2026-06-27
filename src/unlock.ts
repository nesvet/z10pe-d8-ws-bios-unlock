import { UserError } from "./errors.ts";
import { sha256 } from "./io.ts";
import {
	decompressAmitseFromBios,
	extractSetupdata,
	replaceAmitseSection,
} from "./lzma.ts";
import { applyPatches, patchSetupdataInPlace } from "./patch.ts";
import type { BiosProfile, PatchResult } from "./types.ts";

export type UnlockOptions = {
	profile: BiosProfile;
	dryRun?: boolean;
};

export type UnlockPlan = {
	stockBiosSha256: string;
	stockSetupdataSha256: string;
	patchedSetupdataSha256: string;
	patches: PatchResult[];
};

export function planUnlock(
	stockBios: Uint8Array,
	profile: BiosProfile,
): UnlockPlan {
	assertStockBios(stockBios, profile);
	const decompressed = decompressAmitseFromBios(
		stockBios,
		profile.amitse.bodyOffset,
		profile.amitse.compressedSize,
	);
	const stockSetupdata = extractSetupdata(
		decompressed,
		profile.setupdata.offsetInDecompressed,
		profile.setupdata.size,
	);
	assertStockSetupdata(stockSetupdata, profile);

	const setupdataCopy = new Uint8Array(stockSetupdata);
	applyPatches(setupdataCopy, profile);

	return {
		stockBiosSha256: sha256(stockBios),
		stockSetupdataSha256: sha256(stockSetupdata),
		patchedSetupdataSha256: sha256(setupdataCopy),
		patches: profile.patches.map((patch) => ({
			offset: patch.offset,
			label: patch.label,
			from: patch.from,
			to: patch.to,
			applied: true,
		})),
	};
}

export function unlockBios(
	stockBios: Uint8Array,
	options: UnlockOptions,
): Uint8Array {
	const { profile, dryRun = false } = options;
	const plan = planUnlock(stockBios, profile);

	if (plan.patchedSetupdataSha256 !== profile.patchedSetupdataSha256) {
		throw new UserError(
			`Patched setupdata SHA256 mismatch.\n` +
				`  expected: ${profile.patchedSetupdataSha256}\n` +
				`  actual:   ${plan.patchedSetupdataSha256}`,
		);
	}

	if (dryRun) {
		return stockBios;
	}

	const decompressed = decompressAmitseFromBios(
		stockBios,
		profile.amitse.bodyOffset,
		profile.amitse.compressedSize,
	);
	const { setupdata } = patchSetupdataInPlace(decompressed, profile);
	const patchedDecompressed = new Uint8Array(decompressed);
	patchedDecompressed.set(setupdata, profile.setupdata.offsetInDecompressed);

	return replaceAmitseSection(
		stockBios,
		profile.amitse.bodyOffset,
		profile.amitse.compressedSize,
		patchedDecompressed,
	);
}

export function verifyAgainstReference(
	stockBios: Uint8Array,
	referenceModBios: Uint8Array,
	profile: BiosProfile,
): { ok: boolean; messages: string[] } {
	const messages: string[] = [];
	planUnlock(stockBios, profile);
	messages.push("Stock BIOS and setupdata match profile.");

	const stockDec = decompressAmitseFromBios(
		stockBios,
		profile.amitse.bodyOffset,
		profile.amitse.compressedSize,
	);
	const refDec = decompressAmitseFromBios(
		referenceModBios,
		profile.amitse.bodyOffset,
		profile.amitse.compressedSize,
	);

	const stockSd = extractSetupdata(
		stockDec,
		profile.setupdata.offsetInDecompressed,
		profile.setupdata.size,
	);
	const refSd = extractSetupdata(
		refDec,
		profile.setupdata.offsetInDecompressed,
		profile.setupdata.size,
	);

	const patched = new Uint8Array(stockSd);
	applyPatches(patched, profile);
	const patchedHash = sha256(patched);
	const refHash = sha256(refSd);

	if (patchedHash !== refHash) {
		messages.push(
			`Reference setupdata differs from profile patches (${refHash}).`,
		);
		let diffCount = 0;
		for (let i = 0; i < patched.length; i++) {
			if (patched[i] !== refSd[i]) {
				diffCount++;
			}
		}
		messages.push(`  Byte differences in setupdata: ${diffCount}`);
		return { ok: false, messages };
	}

	messages.push(
		`Reference setupdata matches profile unlock (${profile.patches.length}-byte access patch).`,
	);
	return { ok: true, messages };
}

function assertStockBios(stockBios: Uint8Array, profile: BiosProfile): void {
	const hash = sha256(stockBios);
	if (hash !== profile.stockBiosSha256) {
		throw new UserError(
			`Stock BIOS SHA256 mismatch for profile ${profile.id}.\n` +
				`  expected: ${profile.stockBiosSha256}\n` +
				`  actual:   ${hash}\n` +
				`Download BIOS ${profile.biosVersion} from ASUS and decapify the official .CAP.`,
		);
	}
}

function assertStockSetupdata(
	setupdata: Uint8Array,
	profile: BiosProfile,
): void {
	const hash = sha256(setupdata);
	if (hash !== profile.stockSetupdataSha256) {
		throw new UserError(
			`Stock setupdata SHA256 mismatch.\n` +
				`  expected: ${profile.stockSetupdataSha256}\n` +
				`  actual:   ${hash}`,
		);
	}
}
