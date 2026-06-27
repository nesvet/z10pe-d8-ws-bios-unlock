import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	compressLzmaAloneToSlot,
	decompressAmitseFromBios,
	decompressLzmaAlone,
} from "../src/lzma.ts";
import { patchSetupdataInPlace } from "../src/patch.ts";
import { loadProfileResolved } from "../src/profiles.ts";
import {
	hasStockBodyFixture,
	requireStockBodyFixture,
} from "./helpers/fixtures.ts";
import { SLOW_TEST_TIMEOUT_MS } from "./helpers/timeouts.ts";

describe("LZMA alone (AMITSE)", () => {
	test("decompresses stock AMITSE to stable size", {
		skip: !hasStockBodyFixture(),
	}, async () => {
		const profile = loadProfileResolved();
		const { body } = requireStockBodyFixture();
		const decompressed = decompressAmitseFromBios(
			body,
			profile.amitse.bodyOffset,
			profile.amitse.compressedSize,
		);
		assert.ok(
			decompressed.length >=
				profile.setupdata.offsetInDecompressed + profile.setupdata.size,
		);
	});

	test("roundtrips patched AMITSE within stock slot", {
		skip: !hasStockBodyFixture(),
		timeout: SLOW_TEST_TIMEOUT_MS,
	}, async () => {
		const profile = loadProfileResolved();
		const { body } = requireStockBodyFixture();
		const { bodyOffset, compressedSize } = profile.amitse;
		const decompressed = decompressAmitseFromBios(
			body,
			bodyOffset,
			compressedSize,
		);
		const { setupdata } = patchSetupdataInPlace(decompressed, profile);
		const patched = decompressed.slice();
		patched.set(setupdata, profile.setupdata.offsetInDecompressed);

		const recompressed = compressLzmaAloneToSlot(patched, compressedSize);
		assert.ok(recompressed.length <= compressedSize);

		const roundtrip = decompressLzmaAlone(recompressed);
		assert.deepEqual(roundtrip, patched);
	});
});
