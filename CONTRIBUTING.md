# Contributing

Thanks for helping improve this tool.

## Setup

```bash
git clone https://github.com/nesvet/z10pe-d8-ws-bios-unlock.git
cd z10pe-d8-ws-bios-unlock
npm install   # or: bun install
```

Requires [Node.js](https://nodejs.org) ≥ 22.18 or [Bun](https://bun.com) ≥ 1.3.

## Checks before a PR

```bash
npm run check              # Biome
npm run typecheck          # tsc
npm run validate-profiles  # manifest ↔ profile JSON
npm test                   # node:test
npm run test:bun           # optional: same suite on Bun
```

CI runs check, typecheck, and both test runners in a single `verify` job.

## Tests

```bash
npm test           # node:test — Node ≥ 22.18 (default)
npm run test:bun   # bun:test — optional, same suite
npm run check      # Biome (@nesvet/biome-config), safe auto-fix
npm run typecheck  # tsc (src/ + test/)
npm run validate-profiles  # manifest + profile JSON consistency
```

| Layer | CI (`verify` job) | Needs firmware on disk |
|-------|-------------------|--------------------------|
| Biome (`npm run check`) | always | no |
| Typecheck (`npm run typecheck`) | yes | no |
| `profile.test.ts`, `patch.test.ts`, `profiles-manifest.test.ts`, `io-paths.test.ts` | always | no |
| `lzma.test.ts`, `integration.test.ts` | skip without fixture | `in/*.cap` **or** maintainer `../stock-4301.bin` |
| `in-workflow.test.ts` | skip without fixture | exactly one `in/*.cap` |

Firmware-dependent tests use `{ skip: !hasFixture() }` — no `in/*.cap` means skip, not fail.

Put the stock **4301** `.CAP` in `in/` locally to run the full pipeline tests (`in-workflow` + integration + LZMA). CI has no firmware; those tests are skipped there automatically.

## Do not commit firmware

Never open a PR that adds or changes:

- `.CAP` / `.cap` files
- `.bin` BIOS images
- Any ASUS or third-party firmware blobs

Keep stock BIOS in `in/` locally only (gitignored). Do not attach pre-built modded `.CAP` files in issues or PRs.

## Adding a BIOS profile

For a new board revision or BIOS version:

1. Locate the setupdata offsets for your profile with AMIBCP (or equivalent) on a decapped image.
2. Add `profiles/<board>-<version>.json` following [profile.schema.json](profiles/profile.schema.json) (see [4301 reference](profiles/z10pe-d8-ws-4301.json)).
3. Register the profile in [profiles/manifest.json](profiles/manifest.json) (`id`, `file`, `board`, `biosVersion`, `flashbackCapName`).
4. Run `npm run validate-profiles` and `npm run verify` against your local stock `.CAP`; use `--reference` if you have an AMIBCP-modified `.bin` with the **same patches** as the profile.
5. Open a PR with profile JSON + manifest entry only — no firmware files.

**Profile requests:** prefer [GitHub Discussions](https://github.com/nesvet/z10pe-d8-ws-bios-unlock/discussions) or the profile-request issue template. **Bugs:** use the bug template and include `npx --yes github:nesvet/z10pe-d8-ws-bios-unlock doctor` output.

## After publishing the repo (maintainer)

- Enable **GitHub Discussions**
- Labels: `bug`, `docs`, `profile-wanted`
- Optional pinned issue: «BIOS profiles wanted» (4101, D16) — vote with reactions

## Questions

Open a [GitHub issue](https://github.com/nesvet/z10pe-d8-ws-bios-unlock/issues/new/choose) for bugs or profile requests.
