import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, test } from "node:test";
import { IN_DIR } from "../src/paths.ts";
import { loadProfileResolved } from "../src/profiles.ts";

describe("profile metadata", () => {
	test("z10pe-d8-ws-4301 loads with two patches", () => {
		const profile = loadProfileResolved();
		assert.equal(profile.id, "z10pe-d8-ws-4301");
		assert.ok(profile.board.includes("Z10PE-D8"));
		assert.equal(profile.biosVersion, "4301");
		assert.equal(profile.patches.length, 2);
		assert.equal(profile.stockBiosSha256.length, 64);
		assert.notEqual(
			profile.patchedSetupdataSha256,
			profile.stockSetupdataSha256,
		);
	});

	test("patch offsets are unique", () => {
		const profile = loadProfileResolved();
		const offsets = profile.patches.map((patch) => patch.offset);
		assert.equal(new Set(offsets).size, offsets.length);
	});

	test("in/ directory exists for stock CAP drop-in", () => {
		assert.ok(existsSync(IN_DIR));
	});
});
