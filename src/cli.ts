#!/usr/bin/env node

import { parseArgs } from "node:util";
import { buildFlashCap } from "./build.ts";
import { isUserError } from "./errors.ts";
import {
	decapify,
	formatHex,
	readFile,
	resolveOutputPath,
	resolveStockCap,
	sha256,
	writeFile,
} from "./io.ts";
import {
	listProfileEntries,
	type loadProfileResolved,
	resolveProfileForStock,
} from "./profiles.ts";
import { planUnlock, verifyAgainstReference } from "./unlock.ts";

const HELP = `z10pe-d8-ws-bios-unlock — ASUS Z10PE-D8 WS BIOS IntelRCSetup unlock

Usage:
  z10pe-unlock build <stock.cap> [--output out.cap] [--dry-run] [--profile id|path]
  z10pe-unlock verify [stock.cap] [--reference mod.bin] [--profile id|path] [--verbose]
  z10pe-unlock doctor [stock.cap] [--reference mod.bin] [--profile id|path]
  z10pe-unlock profiles list

Zero-install (Node ≥ 22.18):
  npx --yes github:nesvet/z10pe-d8-ws-bios-unlock build /path/to/stock.CAP
  → writes FlashBack .CAP next to stock (e.g. Z10PEWS.CAP)

Development (clone + npm install):
  Put stock .CAP in in/, run: npm run build  →  out/<flashbackCapName>

Commands:
  build            Stock .CAP → unlocked flashable .CAP
  verify           Check stock CAP/body against profile; optional AMIBCP reference
  doctor           verify with --verbose (paste-friendly diagnostics for issues)
  profiles list    Show registered BIOS profiles

Options:
  --output, -o <cap>  build: output path (default: same dir as stock, flashbackCapName)
  --force, -f         build: allow overwriting input when output equals input
  --dry-run, -n       build: show patches without writing output .CAP
  --profile <id|path> Profile id (see profiles list) or path to profile JSON
  --reference <bin>   verify/doctor: compare setupdata to AMIBCP-modified body
  --verbose, -v       verify: detailed diagnostic output

If stock is already named Z10PEWS.CAP, output defaults to Z10PEWS-unlock.CAP (input is never overwritten).

Exit codes: 0 success, 1 user/input error, 2 unexpected error

Bring your own stock BIOS from ASUS. This tool does not distribute firmware.
`;

type Command = "build" | "verify" | "doctor" | "profiles-list" | "help";

function parseCli(argv: string[]): {
	command: Command;
	input?: string;
	dryRun: boolean;
	profile?: string;
	reference?: string;
	verbose: boolean;
	output?: string;
	force: boolean;
} {
	const { values, positionals } = parseArgs({
		args: argv,
		strict: false,
		allowPositionals: true,
		options: {
			"dry-run": { type: "boolean", short: "n" },
			force: { type: "boolean", short: "f" },
			help: { type: "boolean", short: "h" },
			output: { type: "string", short: "o" },
			profile: { type: "string" },
			reference: { type: "string" },
			verbose: { type: "boolean", short: "v" },
		},
	});

	if (values.help === true) {
		return {
			command: "help",
			dryRun: false,
			verbose: false,
			force: false,
		};
	}

	const head = positionals[0] ?? "help";
	if (head === "profiles" && positionals[1] === "list") {
		return {
			command: "profiles-list",
			dryRun: false,
			verbose: false,
			force: false,
		};
	}

	const command = head as Command;
	const input = command === "profiles-list" ? undefined : positionals[1];

	return {
		command,
		input,
		dryRun: values["dry-run"] === true,
		profile: typeof values.profile === "string" ? values.profile : undefined,
		reference:
			typeof values.reference === "string" ? values.reference : undefined,
		verbose: values.verbose === true,
		output: typeof values.output === "string" ? values.output : undefined,
		force: values.force === true,
	};
}

function printPlan(
	profile: ReturnType<typeof loadProfileResolved>,
	plan: ReturnType<typeof planUnlock>,
): void {
	console.log(
		`Profile: ${profile.id} (${profile.board}, BIOS ${profile.biosVersion})`,
	);
	console.log(`FlashBack output:       ${profile.flashbackCapName}`);
	console.log(`Stock BIOS SHA256:      ${plan.stockBiosSha256}`);
	console.log(`Stock setupdata SHA256: ${plan.stockSetupdataSha256}`);
	console.log(`Patches (${plan.patches.length}):`);
	for (const patch of plan.patches) {
		const meta = profile.patches.find((item) => item.offset === patch.offset);
		console.log(
			`  ${formatHex(patch.offset)} ${patch.label}: ` +
				`0x${patch.from.toString(16).padStart(2, "0")} → 0x${patch.to.toString(16).padStart(2, "0")}` +
				(meta?.menu ? `  (${meta.menu})` : ""),
		);
	}
	console.log(`Patched setupdata SHA256: ${plan.patchedSetupdataSha256}`);
}

function printVerboseDiagnostics(
	stockCapPath: string,
	profile: ReturnType<typeof loadProfileResolved>,
	plan: ReturnType<typeof planUnlock>,
): void {
	console.log("--- z10pe-unlock doctor ---");
	console.log(`Stock CAP:              ${stockCapPath}`);
	console.log(`Profile id:             ${profile.id}`);
	console.log(`Board:                  ${profile.board}`);
	console.log(`BIOS version:           ${profile.biosVersion}`);
	console.log(`FlashBack output:       ${profile.flashbackCapName}`);
	console.log(`Stock BIOS SHA256:      ${plan.stockBiosSha256}`);
	console.log(`Expected stock BIOS:    ${profile.stockBiosSha256}`);
	console.log(`Stock setupdata SHA256: ${plan.stockSetupdataSha256}`);
	console.log(`Expected setupdata:     ${profile.stockSetupdataSha256}`);
	console.log(
		`AMITSE slot:            ${plan.patches.length} patches, compressed ${profile.amitse.compressedSize} B @ ${formatHex(profile.amitse.bodyOffset)}`,
	);
	for (const patch of plan.patches) {
		const meta = profile.patches.find((item) => item.offset === patch.offset);
		console.log(
			`  patch ${formatHex(patch.offset)} ${patch.label}: ` +
				`0x${patch.from.toString(16).padStart(2, "0")} → 0x${patch.to.toString(16).padStart(2, "0")}` +
				(meta?.menu ? `  (${meta.menu})` : ""),
		);
	}
	console.log(`Patched setupdata SHA256: ${plan.patchedSetupdataSha256}`);
	console.log(`Expected patched:       ${profile.patchedSetupdataSha256}`);
}

async function commandBuild(
	input: string | undefined,
	dryRun: boolean,
	profileRef: string | undefined,
	output: string | undefined,
	force: boolean,
): Promise<number> {
	const stockCapPath = resolveStockCap(input);
	const stockCap = readFile(stockCapPath);
	const stockBody = decapify(stockCap);
	const profile = resolveProfileForStock(
		profileRef,
		stockBody,
		sha256(stockBody),
	);
	const outPath = resolveOutputPath(stockCapPath, profile, {
		explicitOutput: output,
		force,
	});
	const plan = planUnlock(stockBody, profile);

	console.log(`Input:  ${stockCapPath}`);
	console.log(`Output: ${outPath}`);
	printPlan(profile, plan);

	if (dryRun) {
		console.log("Dry run — no file written.");
		return 0;
	}

	const flashCap = buildFlashCap(stockCap, profile);
	await writeFile(outPath, flashCap);
	console.log(`Wrote ${outPath} (${flashCap.length} bytes)`);
	console.log(`SHA256: ${sha256(flashCap)}`);
	return 0;
}

async function commandVerify(
	input: string | undefined,
	reference: string | undefined,
	profileRef: string | undefined,
	verbose: boolean,
): Promise<number> {
	const stockCapPath = resolveStockCap(input);
	const stockCap = readFile(stockCapPath);
	const stockBody = decapify(stockCap);

	let profile: ReturnType<typeof loadProfileResolved>;
	let plan: ReturnType<typeof planUnlock>;

	try {
		profile = resolveProfileForStock(profileRef, stockBody, sha256(stockBody));
		plan = planUnlock(stockBody, profile);
	} catch (error) {
		if (verbose) {
			console.log("--- z10pe-unlock doctor ---");
			console.log(`Stock CAP:         ${stockCapPath}`);
			console.log(`Stock BIOS SHA256: ${sha256(stockBody)}`);
		}
		console.error(`FAIL: ${error instanceof Error ? error.message : error}`);
		return 1;
	}

	if (verbose) {
		printVerboseDiagnostics(stockCapPath, profile, plan);
	}

	console.log(`OK: ${stockCapPath} matches profile ${profile.id}.`);

	if (reference) {
		const refBody = readFile(reference);
		const result = verifyAgainstReference(stockBody, refBody, profile);
		for (const message of result.messages) {
			console.log(result.ok ? `OK: ${message}` : `FAIL: ${message}`);
		}
		if (!result.ok) {
			return 1;
		}
	}

	if (verbose) {
		console.log("RESULT: OK");
	}

	return 0;
}

function commandProfilesList(): number {
	const entries = listProfileEntries();
	console.log("id\tboard\tbios\tflashback");
	for (const entry of entries) {
		console.log(
			`${entry.id}\t${entry.board}\t${entry.biosVersion}\t${entry.flashbackCapName}`,
		);
	}
	return 0;
}

async function main(): Promise<number> {
	const cli = parseCli(process.argv.slice(2));

	try {
		switch (cli.command) {
			case "build":
				return await commandBuild(
					cli.input,
					cli.dryRun,
					cli.profile,
					cli.output,
					cli.force,
				);
			case "verify":
				return await commandVerify(
					cli.input,
					cli.reference,
					cli.profile,
					cli.verbose,
				);
			case "doctor":
				return await commandVerify(cli.input, cli.reference, cli.profile, true);
			case "profiles-list":
				return commandProfilesList();
			case "help":
				console.log(HELP);
				return 0;
			default:
				console.error(`Unknown command: ${cli.command}\n`);
				console.log(HELP);
				return 1;
		}
	} catch (error) {
		if (isUserError(error)) {
			console.error(error.message);
			return error.exitCode;
		}
		console.error(error instanceof Error ? error.message : error);
		return 2;
	}
}

const exitCode = await main();
process.exit(exitCode);
