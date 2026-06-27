import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { applyPatches, patchSetupdataInPlace } from "../src/patch.ts";
import { loadProfileResolved } from "../src/profiles.ts";

describe("applyPatches", () => {
	test("applies two bytes and leaves the rest intact", async () => {
		const profile = loadProfileResolved();
		const maxOffset = Math.max(...profile.patches.map((patch) => patch.offset));
		const setupdata = new Uint8Array(maxOffset + 1);
		for (const patch of profile.patches) {
			setupdata[patch.offset] = patch.from;
		}
		const before = setupdata.slice();

		const results = applyPatches(setupdata, profile);
		assert.equal(results.length, profile.patches.length);
		for (const patch of profile.patches) {
			assert.equal(setupdata[patch.offset], patch.to);
		}
		for (let i = 0; i < before.length; i++) {
			const touched = profile.patches.some((patch) => patch.offset === i);
			if (!touched) {
				assert.equal(setupdata[i], before[i]);
			}
		}
	});

	test("rejects wrong stock byte at patch offset", async () => {
		const profile = loadProfileResolved();
		const [patch] = profile.patches;
		assert.ok(patch, "profile must define patches");
		const setupdata = new Uint8Array(patch.offset + 1);
		setupdata[patch.offset] = patch.from + 1;

		assert.throws(() => applyPatches(setupdata, profile), /Patch mismatch/);
	});

	test("rejects already-patched setupdata", async () => {
		const profile = loadProfileResolved();
		const maxOffset = Math.max(...profile.patches.map((item) => item.offset));
		const setupdata = new Uint8Array(maxOffset + 1);
		for (const patch of profile.patches) {
			setupdata[patch.offset] = patch.to;
		}

		assert.throws(() => applyPatches(setupdata, profile), /Patch mismatch/);
	});
});

describe("patchSetupdataInPlace", () => {
	test("does not mutate bytes outside setupdata", async () => {
		const profile = loadProfileResolved();
		const { offsetInDecompressed, size } = profile.setupdata;
		const decompressed = new Uint8Array(offsetInDecompressed + size + 16);
		decompressed.fill(0xaa);
		for (const patch of profile.patches) {
			decompressed[offsetInDecompressed + patch.offset] = patch.from;
		}
		const before = decompressed.slice();

		patchSetupdataInPlace(decompressed, profile);

		for (let i = 0; i < before.length; i++) {
			const inSetupdata =
				i >= offsetInDecompressed && i < offsetInDecompressed + size;
			const touched = profile.patches.some(
				(patch) => offsetInDecompressed + patch.offset === i,
			);
			if (!inSetupdata || !touched) {
				assert.equal(decompressed[i], before[i]);
			}
		}
	});
});
