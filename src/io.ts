import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { UserError } from "./errors.ts";
import { CAPSULE_HEADER_SIZE, IN_DIR, OUT_DIR } from "./paths.ts";
import type { BiosProfile } from "./types.ts";

export { IN_DIR, OUT_DIR };

const GOLDEN_PATH_BUILD =
	"npx --yes github:nesvet/z10pe-d8-ws-bios-unlock build /path/to/stock.CAP";

export function sha256(data: Uint8Array): string {
	return createHash("sha256").update(data).digest("hex");
}

export function readFile(path: string): Uint8Array {
	return new Uint8Array(readFileSync(path));
}

export async function writeFile(path: string, data: Uint8Array): Promise<void> {
	writeFileSync(path, data);
}

export function loadProfile(path: string): BiosProfile {
	return JSON.parse(readFileSync(path, "utf8")) as BiosProfile;
}

export function decapify(cap: Uint8Array): Uint8Array {
	if (cap.length <= CAPSULE_HEADER_SIZE) {
		throw new UserError(`CAP file too small (${cap.length} bytes)`);
	}
	return cap.slice(CAPSULE_HEADER_SIZE);
}

export function capify(stockCap: Uint8Array, biosBody: Uint8Array): Uint8Array {
	if (stockCap.length <= CAPSULE_HEADER_SIZE) {
		throw new UserError(`Stock CAP too small (${stockCap.length} bytes)`);
	}
	const out = new Uint8Array(CAPSULE_HEADER_SIZE + biosBody.length);
	out.set(stockCap.slice(0, CAPSULE_HEADER_SIZE));
	out.set(biosBody, CAPSULE_HEADER_SIZE);
	return out;
}

export function formatHex(value: number): string {
	return `0x${value.toString(16).toUpperCase()}`;
}

export function pathsEqual(a: string, b: string): boolean {
	const resolvedA = resolve(a);
	const resolvedB = resolve(b);

	try {
		if (existsSync(resolvedA) && existsSync(resolvedB)) {
			return realpathSync(resolvedA) === realpathSync(resolvedB);
		}
	} catch {
		// fall through to string compare
	}

	return resolvedA === resolvedB;
}

function isInputInInDir(inputPath: string): boolean {
	mkdirSync(IN_DIR, { recursive: true });
	const inputDir = dirname(resolve(inputPath));

	try {
		return realpathSync(inputDir) === realpathSync(IN_DIR);
	} catch {
		return resolve(inputDir) === resolve(IN_DIR);
	}
}

export type ResolveOutputOptions = {
	explicitOutput?: string;
	force?: boolean;
};

export function resolveOutputPath(
	inputPath: string,
	profile: BiosProfile,
	options: ResolveOutputOptions = {},
): string {
	const { explicitOutput, force = false } = options;
	const inputResolved = resolve(inputPath);

	let candidate: string;
	if (explicitOutput !== undefined) {
		candidate = isAbsolute(explicitOutput)
			? explicitOutput
			: resolve(process.cwd(), explicitOutput);
	} else if (isInputInInDir(inputPath)) {
		mkdirSync(OUT_DIR, { recursive: true });
		candidate = join(OUT_DIR, profile.flashbackCapName);
	} else {
		candidate = join(dirname(inputResolved), profile.flashbackCapName);
	}

	if (!pathsEqual(candidate, inputPath)) {
		return candidate;
	}

	if (force) {
		console.warn("WARNING: Overwriting input file (--force).");
		return candidate;
	}

	if (explicitOutput !== undefined) {
		throw new UserError(
			"Output path equals input. Pass a different -o or use --force.",
		);
	}

	const stem = profile.flashbackCapName.replace(/\.CAP$/i, "");
	const suffixed = join(dirname(inputResolved), `${stem}-unlock.CAP`);
	console.warn(
		`Input is already named ${profile.flashbackCapName}. ` +
			`Writing to ${stem}-unlock.CAP instead. ` +
			`Rename to ${profile.flashbackCapName} on the FlashBack USB stick.`,
	);
	return suffixed;
}

export function findStockCapInInDir(): string {
	mkdirSync(IN_DIR, { recursive: true });
	const entries = readdirSync(IN_DIR, { withFileTypes: true });
	const caps = entries
		.filter(
			(entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".cap"),
		)
		.map((entry) => entry.name)
		.sort();

	if (caps.length === 0) {
		throw new UserError(
			`No .CAP file in ${IN_DIR}/. Download the official stock BIOS from ASUS and place it there.`,
		);
	}
	if (caps.length > 1) {
		throw new UserError(
			`Multiple .CAP files in ${IN_DIR}/: ${caps.join(", ")}. Keep one stock CAP or pass a path.`,
		);
	}
	const [cap] = caps;
	if (cap === undefined) {
		throw new UserError(`No .CAP file in ${IN_DIR}/.`);
	}
	return join(IN_DIR, cap);
}

export function resolveStockCap(explicit?: string): string {
	if (explicit) {
		return explicit;
	}

	try {
		return findStockCapInInDir();
	} catch (error) {
		if (
			error instanceof UserError &&
			error.message.includes(`No .CAP file in ${IN_DIR}/`)
		) {
			throw new UserError(
				`No stock .CAP specified.\n\n  ${GOLDEN_PATH_BUILD}\n\n` +
					"Download the official stock BIOS from ASUS.",
			);
		}
		throw error;
	}
}

/** @deprecated Use resolveOutputPath — kept for dev workflow tests */
export function outputCapPath(
	profile: BiosProfile,
	inputPath?: string,
): string {
	const input = inputPath ?? join(IN_DIR, "stock.CAP");
	return resolveOutputPath(input, profile);
}
