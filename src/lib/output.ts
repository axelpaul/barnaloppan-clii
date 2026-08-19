export function isJsonMode(flags: { json: boolean; pretty: boolean }): boolean {
	if (flags.json) return true;
	if (flags.pretty) return false;
	return !process.stdout.isTTY;
}

export function output(value: unknown, json: boolean): void {
	console.log(
		typeof value === "string" && !json ? value : JSON.stringify(value, null, 2),
	);
}
