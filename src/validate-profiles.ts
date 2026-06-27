#!/usr/bin/env node

import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadProfile } from "./io.ts";
import { PROFILES_DIR } from "./paths.ts";
import { loadManifest, validateProfile } from "./profiles.ts";

function main(): number {
	const manifest = loadManifest();

	for (const entry of manifest.profiles) {
		const path = join(PROFILES_DIR, entry.file);
		if (!existsSync(path)) {
			console.error(`Missing profile file: ${entry.file}`);
			return 1;
		}

		const profile = loadProfile(path);
		validateProfile(profile);

		if (profile.id !== entry.id) {
			console.error(
				`Profile id mismatch: manifest ${entry.id} vs ${profile.id} in ${entry.file}`,
			);
			return 1;
		}
		if (profile.flashbackCapName !== entry.flashbackCapName) {
			console.error(
				`flashbackCapName mismatch for ${entry.id}: manifest ${entry.flashbackCapName} vs profile ${profile.flashbackCapName}`,
			);
			return 1;
		}
	}

	console.log(`OK: ${manifest.profiles.length} profile(s) validated`);
	return 0;
}

process.exit(main());
