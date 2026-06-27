import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, test } from "node:test";
import { buildFlashCap } from "../src/build.ts";
import {
	decapify,
	findStockCapInInDir,
	resolveOutputPath,
	sha256,
} from "../src/io.ts";
import { OUT_DIR } from "../src/paths.ts";
import { loadProfileResolved } from "../src/profiles.ts";
import { planUnlock, unlockBios } from "../src/unlock.ts";
import { countBytesChangedOutsideRegion } from "./helpers/assertions.ts";
import {
	getInCapPath,
	hasInCapFixture,
	requireInCapFixture,
} from "./helpers/fixtures.ts";
import { SLOW_TEST_TIMEOUT_MS } from "./helpers/timeouts.ts";

describe("in/ workflow", () => {
	test("findStockCapInInDir resolves the single in/*.cap", {
		skip: !hasInCapFixture(),
	}, () => {
		const capPath = findStockCapInInDir();
		assert.equal(capPath, getInCapPath());
	});

	test("full unlock pipeline on in/*.cap", {
		skip: !hasInCapFixture(),
		timeout: SLOW_TEST_TIMEOUT_MS,
	}, async () => {
		const profile = loadProfileResolved();
		const { capPath, cap } = requireInCapFixture();
		const stockBody = decapify(cap);
		const plan = planUnlock(stockBody, profile);

		assert.equal(plan.stockBiosSha256, profile.stockBiosSha256);
		assert.equal(plan.patchedSetupdataSha256, profile.patchedSetupdataSha256);
		assert.equal(plan.patches.length, 2);

		const flashCap = buildFlashCap(cap, profile);
		const modBody = unlockBios(stockBody, { profile });
		const { bodyOffset, compressedSize } = profile.amitse;

		assert.equal(capPath, findStockCapInInDir());
		assert.deepEqual(flashCap.slice(0, 2048), cap.slice(0, 2048));
		assert.deepEqual(decapify(flashCap), modBody);
		assert.equal(
			countBytesChangedOutsideRegion(
				stockBody,
				modBody,
				bodyOffset,
				compressedSize,
			),
			0,
		);
		assert.equal(flashCap.length, cap.length);
		assert.equal(sha256(stockBody), profile.stockBiosSha256);
	});

	test("FlashBack output name comes from profile", {
		skip: !hasInCapFixture(),
	}, () => {
		const profile = loadProfileResolved();
		const capPath = findStockCapInInDir();
		assert.equal(profile.flashbackCapName, "Z10PEWS.CAP");
		assert.equal(
			resolveOutputPath(capPath, profile),
			join(OUT_DIR, "Z10PEWS.CAP"),
		);
		assert.ok(OUT_DIR.includes("out"));
	});
});
