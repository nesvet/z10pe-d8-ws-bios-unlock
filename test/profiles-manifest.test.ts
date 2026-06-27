import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { UserError } from "../src/errors.ts";
import {
	listProfileEntries,
	loadManifest,
	loadProfileResolved,
	resolveProfilePath,
} from "../src/profiles.ts";

describe("profiles manifest", () => {
	test("manifest loads with default profile", () => {
		const manifest = loadManifest();
		assert.equal(manifest.defaultProfileId, "z10pe-d8-ws-4301");
		assert.equal(manifest.profiles.length, 1);
	});

	test("listProfileEntries returns registry rows", () => {
		const entries = listProfileEntries();
		assert.equal(entries[0]?.id, "z10pe-d8-ws-4301");
		assert.equal(entries[0]?.flashbackCapName, "Z10PEWS.CAP");
	});

	test("resolveProfilePath by id and default", () => {
		const byId = resolveProfilePath("z10pe-d8-ws-4301");
		assert.ok(byId.endsWith("z10pe-d8-ws-4301.json"));

		const byDefault = resolveProfilePath();
		assert.equal(byId, byDefault);
	});

	test("resolveProfilePath rejects unknown id", () => {
		assert.throws(
			() => resolveProfilePath("no-such-profile"),
			(error: unknown) => error instanceof UserError,
		);
	});

	test("loadProfileResolved includes flashbackCapName", () => {
		const profile = loadProfileResolved();
		assert.equal(profile.flashbackCapName, "Z10PEWS.CAP");
		assert.equal(profile.id, "z10pe-d8-ws-4301");
	});
});
