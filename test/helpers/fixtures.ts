import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { decapify, readFile } from "../../src/io.ts";
import { CAPSULE_HEADER_SIZE, IN_DIR, REPO_ROOT } from "../../src/paths.ts";
import { loadProfileResolved } from "../../src/profiles.ts";
import { verifyAgainstReference } from "../../src/unlock.ts";

const MAINTAINER_DIR = join(REPO_ROOT, "..");
const STOCK_BIN = join(MAINTAINER_DIR, "stock-4301.bin");
const AMIBCP_MOD = join(MAINTAINER_DIR, "amibcp-mod-4301.bin");

export const AMIBCP_MOD_PATH = AMIBCP_MOD;

export function listCapFilesInInDir(): string[] {
	if (!existsSync(IN_DIR)) {
		return [];
	}
	return readdirSync(IN_DIR, { withFileTypes: true })
		.filter(
			(entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".cap"),
		)
		.map((entry) => join(IN_DIR, entry.name))
		.sort();
}

export function getInCapPath(): string | null {
	const caps = listCapFilesInInDir();
	if (caps.length !== 1) {
		return null;
	}
	return caps[0] ?? null;
}

export function getStockBodyFixture(): {
	body: Uint8Array;
	source: string;
} | null {
	const inCap = getInCapPath();
	if (inCap) {
		return { body: decapify(readFile(inCap)), source: inCap };
	}
	if (existsSync(STOCK_BIN)) {
		return { body: readFile(STOCK_BIN), source: STOCK_BIN };
	}
	return null;
}

export function wrapBodyAsCap(
	body: Uint8Array,
	headerSeed = "ASUS_CAP_TEST",
): Uint8Array {
	const cap = new Uint8Array(CAPSULE_HEADER_SIZE + body.length);
	cap.set(
		new TextEncoder().encode(headerSeed.padEnd(CAPSULE_HEADER_SIZE, "\0")),
	);
	cap.set(body, CAPSULE_HEADER_SIZE);
	return cap;
}

export function getStockCapFixture(): {
	cap: Uint8Array;
	source: string;
} | null {
	const inCap = getInCapPath();
	if (inCap) {
		return { cap: readFile(inCap), source: inCap };
	}
	if (existsSync(STOCK_BIN)) {
		return { cap: wrapBodyAsCap(readFile(STOCK_BIN)), source: STOCK_BIN };
	}
	return null;
}

export function hasStockBodyFixture(): boolean {
	return getStockBodyFixture() !== null;
}

export function hasInCapFixture(): boolean {
	return getInCapPath() !== null;
}

export function hasAmibcpReference(): boolean {
	return existsSync(AMIBCP_MOD);
}

export function hasAmibcpReferenceMatchingProfile(): boolean {
	if (!hasStockBodyFixture() || !hasAmibcpReference()) {
		return false;
	}
	const profile = loadProfileResolved();
	const { body } = getStockBodyFixture() as NonNullable<
		ReturnType<typeof getStockBodyFixture>
	>;
	const reference = readFile(AMIBCP_MOD);
	return verifyAgainstReference(body, reference, profile).ok;
}

export function hasStockCapFixture(): boolean {
	return getStockCapFixture() !== null;
}

export function requireStockBodyFixture(): {
	body: Uint8Array;
	source: string;
} {
	const fixture = getStockBodyFixture();
	if (!fixture) {
		throw new Error("stock body fixture required");
	}
	return fixture;
}

export function requireStockCapFixture(): {
	cap: Uint8Array;
	source: string;
} {
	const fixture = getStockCapFixture();
	if (!fixture) {
		throw new Error("stock cap fixture required");
	}
	return fixture;
}

export function requireInCapFixture(): {
	capPath: string;
	cap: Uint8Array;
} {
	const capPath = getInCapPath();
	if (!capPath) {
		throw new Error("exactly one in/*.cap required");
	}
	return { capPath, cap: readFile(capPath) };
}
