# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-27

### Added

- Initial release: unlock **IIO0** and **IIO1 Configuration** on ASUS Z10PE-D8 WS BIOS 4301 (2-byte setupdata patch)
- CLI: `build`, `verify`, `doctor`, `profiles list`
- Zero-install via `npx github:nesvet/z10pe-d8-ws-bios-unlock`
- Profile `z10pe-d8-ws-4301` with FlashBack output `Z10PEWS.CAP`

### Notes

- Patches AMI setupdata only; configure IOU link width in BIOS after flashing
- Stock `.CAP` must be obtained from ASUS; no AMIBCP required

[0.1.0]: https://github.com/nesvet/z10pe-d8-ws-bios-unlock/tree/0.1.0
