import { mkdirSync } from "node:fs";
import { join } from "node:path";

export const REPO_ROOT = join(import.meta.dirname, "..");
export const IN_DIR = join(REPO_ROOT, "in");
export const OUT_DIR = join(REPO_ROOT, "out");
export const PROFILES_DIR = join(REPO_ROOT, "profiles");
export const CAPSULE_HEADER_SIZE = 2048;

export function ensureWorkdirs(): void {
	mkdirSync(IN_DIR, { recursive: true });
	mkdirSync(OUT_DIR, { recursive: true });
}
