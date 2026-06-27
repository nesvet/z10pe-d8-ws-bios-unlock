export class UserError extends Error {
	readonly exitCode = 1;

	constructor(message: string) {
		super(message);
		this.name = "UserError";
	}
}

export function isUserError(error: unknown): error is UserError {
	return error instanceof UserError;
}
