# Security

This project modifies UEFI firmware images locally. It does not execute code on the host beyond Node.js or Bun, the `lzma` npm dependency, and file I/O.

- Never commit or share patched `.CAP` / `.bin` files in issues or PRs.
- Do not attach pre-built modded firmware to bug reports — share `z10pe-unlock doctor` output and stock SHA256 only.
- Verify downloads: stock BIOS SHA256 must match the profile before patching.
- Reproducibility: the same stock `.CAP` (matching `stockBiosSha256`) always produces the same patched setupdata (`patchedSetupdataSha256`) for a given profile.
- Treat modified firmware as untrusted until you validate POST and settings on hardware.

Report vulnerabilities via GitHub Security Advisories on the published repository.
