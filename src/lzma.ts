import { compress, decompress, type Mode } from "lzma";

function toUint8Array(
	result: Buffer | Uint8Array | string,
	context: string,
): Uint8Array {
	if (typeof result === "string") {
		throw new Error(`LZMA ${context} returned text; expected binary setupdata`);
	}
	return result instanceof Uint8Array ? result : new Uint8Array(result);
}

export function decompressLzmaAlone(compressed: Uint8Array): Uint8Array {
	return toUint8Array(decompress(compressed), "decompress");
}

export function compressLzmaAlone(
	decompressed: Uint8Array,
	preset = 9,
): Uint8Array {
	return toUint8Array(compress(decompressed, preset as Mode), "compress");
}

export function compressLzmaAloneToSlot(
	decompressed: Uint8Array,
	slotSize: number,
	maxPreset = 9,
): Uint8Array {
	for (let preset = maxPreset; preset >= 1; preset--) {
		const compressed = compressLzmaAlone(decompressed, preset);
		if (compressed.length <= slotSize) {
			return compressed;
		}
	}
	throw new Error(
		`Recompressed AMITSE exceeds stock slot (${slotSize} B) at all presets 1–${maxPreset}. ` +
			"Report an issue with your BIOS profile.",
	);
}

export function fitCompressedIntoSlot(
	compressed: Uint8Array,
	slotSize: number,
): Uint8Array {
	if (compressed.length > slotSize) {
		throw new Error(
			`Recompressed AMITSE (${compressed.length} B) exceeds stock slot (${slotSize} B).`,
		);
	}
	const padded = new Uint8Array(slotSize);
	padded.set(compressed);
	padded.fill(0xff, compressed.length);
	return padded;
}

export function replaceAmitseSection(
	stockBios: Uint8Array,
	bodyOffset: number,
	compressedSize: number,
	decompressed: Uint8Array,
): Uint8Array {
	const compressed = compressLzmaAloneToSlot(decompressed, compressedSize);
	const padded = fitCompressedIntoSlot(compressed, compressedSize);
	const out = new Uint8Array(stockBios);
	out.set(padded, bodyOffset);
	return out;
}

export function extractSetupdata(
	decompressed: Uint8Array,
	offsetInDecompressed: number,
	size: number,
): Uint8Array {
	return decompressed.subarray(
		offsetInDecompressed,
		offsetInDecompressed + size,
	);
}

export function decompressAmitseFromBios(
	stockBios: Uint8Array,
	bodyOffset: number,
	compressedSize: number,
): Uint8Array {
	const compressed = stockBios.subarray(
		bodyOffset,
		bodyOffset + compressedSize,
	);
	return decompressLzmaAlone(compressed);
}
