import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildFlashCap } from "../src/build.ts";
import { decapify, readFile } from "../src/io.ts";
import { loadProfileResolved } from "../src/profiles.ts";
import {
	planUnlock,
	unlockBios,
	verifyAgainstReference,
} from "../src/unlock.ts";
import { countBytesChangedOutsideRegion } from "./helpers/assertions.ts";
import {
	AMIBCP_MOD_PATH,
	hasAmibcpReferenceMatchingProfile,
	hasStockBodyFixture,
	hasStockCapFixture,
	requireStockBodyFixture,
	requireStockCapFixture,
} from "./helpers/fixtures.ts";
import { SLOW_TEST_TIMEOUT_MS } from "./helpers/timeouts.ts";

describe("unlock integration", () => {
	test("stock body matches profile hashes", {
		skip: !hasStockBodyFixture(),
	}, async () => {
		const profile = loadProfileResolved();
		const { body } = requireStockBodyFixture();
		const plan = planUnlock(body, profile);
		assert.equal(plan.stockBiosSha256, profile.stockBiosSha256);
		assert.equal(plan.patchedSetupdataSha256, profile.patchedSetupdataSha256);
	});

	test("unlock changes only the AMITSE region", {
		skip: !hasStockBodyFixture(),
		timeout: SLOW_TEST_TIMEOUT_MS,
	}, async () => {
		const profile = loadProfileResolved();
		const { body } = requireStockBodyFixture();
		const mod = unlockBios(body, { profile });
		const { bodyOffset, compressedSize } = profile.amitse;

		assert.equal(
			countBytesChangedOutsideRegion(body, mod, bodyOffset, compressedSize),
			0,
		);
	});

	test("patched setupdata matches AMIBCP reference", {
		skip: !hasStockBodyFixture() || !hasAmibcpReferenceMatchingProfile(),
	}, async () => {
		const profile = loadProfileResolved();
		const { body } = requireStockBodyFixture();
		const reference = readFile(AMIBCP_MOD_PATH);
		const result = verifyAgainstReference(body, reference, profile);
		assert.equal(result.ok, true);
	});

	test("buildFlashCap preserves the capsule header", {
		skip: !hasStockCapFixture(),
		timeout: SLOW_TEST_TIMEOUT_MS,
	}, async () => {
		const profile = loadProfileResolved();
		const { cap } = requireStockCapFixture();
		const out = buildFlashCap(cap, profile);

		assert.deepEqual(out.slice(0, 2048), cap.slice(0, 2048));
		assert.deepEqual(decapify(out), unlockBios(decapify(cap), { profile }));
	});
});
