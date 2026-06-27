import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { UserError } from "./errors.ts";
import { loadProfile } from "./io.ts";
import { PROFILES_DIR, REPO_ROOT } from "./paths.ts";
import type { BiosProfile } from "./types.ts";

export type ManifestEntry = {
	id: string;
	file: string;
	board: string;
	biosVersion: string;
	flashbackCapName: string;
};

export type ProfilesManifest = {
	defaultProfileId: string;
	profiles: ManifestEntry[];
};

const MANIFEST_PATH = join(PROFILES_DIR, "manifest.json");

export function loadManifest(): ProfilesManifest {
	if (!existsSync(MANIFEST_PATH)) {
		throw new UserError(`Missing profiles manifest: ${MANIFEST_PATH}`);
	}

	const manifest = JSON.parse(
		readFileSync(MANIFEST_PATH, "utf8"),
	) as ProfilesManifest;

	if (!manifest.defaultProfileId) {
		throw new UserError("profiles/manifest.json: defaultProfileId is required");
	}
	if (!Array.isArray(manifest.profiles) || manifest.profiles.length === 0) {
		throw new UserError(
			"profiles/manifest.json: profiles must be a non-empty array",
		);
	}

	const ids = new Set<string>();
	for (const entry of manifest.profiles) {
		if (!entry.id || !entry.file) {
			throw new UserError(
				"profiles/manifest.json: each profile needs id and file",
			);
		}
		if (ids.has(entry.id)) {
			throw new UserError(
				`profiles/manifest.json: duplicate profile id ${entry.id}`,
			);
		}
		ids.add(entry.id);

		const profilePath = join(PROFILES_DIR, entry.file);
		if (!existsSync(profilePath)) {
			throw new UserError(`profiles/manifest.json: missing file ${entry.file}`);
		}
	}

	if (!ids.has(manifest.defaultProfileId)) {
		throw new UserError(
			`profiles/manifest.json: defaultProfileId ${manifest.defaultProfileId} not found`,
		);
	}

	return manifest;
}

export function listProfileEntries(): ManifestEntry[] {
	return loadManifest().profiles;
}

export function resolveProfilePath(ref?: string): string {
	if (!ref) {
		const manifest = loadManifest();
		const entry = manifest.profiles.find(
			(item) => item.id === manifest.defaultProfileId,
		);
		if (!entry) {
			throw new UserError(
				`Default profile ${manifest.defaultProfileId} is not in manifest`,
			);
		}
		return join(PROFILES_DIR, entry.file);
	}

	if (ref.endsWith(".json") || ref.includes("/") || ref.includes("\\")) {
		return isAbsolute(ref) ? ref : join(REPO_ROOT, ref);
	}

	const entry = loadManifest().profiles.find((item) => item.id === ref);
	if (!entry) {
		throw new UserError(
			`Unknown profile id: ${ref}. Run: z10pe-unlock profiles list`,
		);
	}
	return join(PROFILES_DIR, entry.file);
}

export function validateProfile(profile: BiosProfile): void {
	const required: (keyof BiosProfile)[] = [
		"id",
		"board",
		"biosVersion",
		"flashbackCapName",
		"stockBiosSha256",
		"stockSetupdataSha256",
		"patchedSetupdataSha256",
		"amitse",
		"setupdata",
		"patches",
	];

	for (const key of required) {
		if (profile[key] === undefined || profile[key] === null) {
			throw new UserError(
				`Profile ${profile.id ?? "(unknown)"}: missing ${key}`,
			);
		}
	}

	if (profile.patches.length === 0) {
		throw new UserError(`Profile ${profile.id}: patches must not be empty`);
	}
}

export function loadProfileResolved(ref?: string): BiosProfile {
	const profile = loadProfile(resolveProfilePath(ref));
	validateProfile(profile);
	return profile;
}

export function matchProfileByStockSha256(hash: string): BiosProfile | null {
	const manifest = loadManifest();
	const matches: BiosProfile[] = [];

	for (const entry of manifest.profiles) {
		const profile = loadProfile(join(PROFILES_DIR, entry.file));
		validateProfile(profile);
		if (profile.stockBiosSha256 === hash) {
			matches.push(profile);
		}
	}

	if (matches.length === 0) {
		return null;
	}
	if (matches.length > 1) {
		throw new UserError(
			`Ambiguous stock BIOS SHA256 matches profiles: ${matches.map((item) => item.id).join(", ")}. Use --profile.`,
		);
	}

	return matches[0] ?? null;
}

export function resolveProfileForStock(
	ref: string | undefined,
	_stockBody: Uint8Array,
	stockSha256: string,
): BiosProfile {
	if (ref) {
		return loadProfileResolved(ref);
	}

	const matched = matchProfileByStockSha256(stockSha256);
	if (matched) {
		console.log(`Auto-selected profile: ${matched.id}`);
		return matched;
	}

	return loadProfileResolved();
}
