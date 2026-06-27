import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { UserError } from "../src/errors.ts";
import { pathsEqual, resolveOutputPath, resolveStockCap } from "../src/io.ts";
import { IN_DIR, OUT_DIR } from "../src/paths.ts";
import { loadProfileResolved } from "../src/profiles.ts";
import { hasInCapFixture } from "./helpers/fixtures.ts";

const profile = loadProfileResolved();

describe("pathsEqual", () => {
	test("matches absolute and relative paths to the same file", () => {
		const dir = mkdtempSync(join(tmpdir(), "z10pe-paths-"));
		const file = join(dir, "test.CAP");
		writeFileSync(file, "x");
		assert.equal(pathsEqual(file, join(dir, "./test.CAP")), true);
	});
});

describe("resolveOutputPath", () => {
	test("ASUS stock name → flashbackCapName beside input", () => {
		const dir = "/tmp/downloads";
		const input = join(dir, "Z10PE-D8-WS-ASUS-4301.CAP");
		const output = resolveOutputPath(input, profile);
		assert.equal(output, join(dir, "Z10PEWS.CAP"));
	});

	test("stock already Z10PEWS.CAP → Z10PEWS-unlock.CAP", () => {
		const dir = "/tmp/downloads";
		const input = join(dir, "Z10PEWS.CAP");
		const output = resolveOutputPath(input, profile);
		assert.equal(output, join(dir, "Z10PEWS-unlock.CAP"));
	});

	test("explicit -o collision throws without force", () => {
		const input = "/tmp/Z10PEWS.CAP";
		assert.throws(
			() =>
				resolveOutputPath(input, profile, {
					explicitOutput: input,
				}),
			(error: unknown) => error instanceof UserError,
		);
	});

	test("explicit -o collision allowed with force", () => {
		const input = "/tmp/Z10PEWS.CAP";
		const output = resolveOutputPath(input, profile, {
			explicitOutput: input,
			force: true,
		});
		assert.equal(output, input);
	});

	test("dev input in in/ → out/flashbackCapName", () => {
		mkdirSync(IN_DIR, { recursive: true });
		mkdirSync(OUT_DIR, { recursive: true });
		const input = join(IN_DIR, "Z10PE-D8-WS-ASUS-4301.CAP");
		const output = resolveOutputPath(input, profile);
		assert.equal(output, join(OUT_DIR, "Z10PEWS.CAP"));
		assert.equal(pathsEqual(input, output), false);
	});
});

describe("resolveStockCap", () => {
	test("explicit path is returned as-is", () => {
		assert.equal(resolveStockCap("/path/to/stock.CAP"), "/path/to/stock.CAP");
	});

	test("empty in/ throws with golden-path hint", {
		skip: hasInCapFixture(),
	}, () => {
		assert.throws(
			() => resolveStockCap(),
			(error: unknown) =>
				error instanceof UserError &&
				error.message.includes("github:nesvet/z10pe-d8-ws-bios-unlock"),
		);
	});
});
