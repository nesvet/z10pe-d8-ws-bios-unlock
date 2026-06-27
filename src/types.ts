export type ProfilePatch = {
	offset: number;
	from: number;
	to: number;
	menu: string;
	label: string;
};

export type BiosProfile = {
	id: string;
	board: string;
	biosVersion: string;
	flashbackCapName: string;
	stockBiosSha256: string;
	stockSetupdataSha256: string;
	patchedSetupdataSha256: string;
	amitse: {
		bodyOffset: number;
		compressedSize: number;
	};
	setupdata: {
		offsetInDecompressed: number;
		size: number;
	};
	patches: ProfilePatch[];
};

export type PatchResult = {
	offset: number;
	label: string;
	from: number;
	to: number;
	applied: boolean;
};
