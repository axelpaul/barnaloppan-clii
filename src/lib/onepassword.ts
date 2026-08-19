export async function credentialsFrom1Password(): Promise<{
	email: string;
	password: string;
}> {
	const op = Bun.which("op");
	if (!op)
		throw new Error("1Password CLI (op) is not installed or not on PATH.");
	const itemName = Bun.env.BARNALOPPAN_1PASSWORD_ITEM || "Barnaloppan";
	const vault = Bun.env.BARNALOPPAN_1PASSWORD_VAULT;
	const args = [op, "item", "get", itemName, "--format", "json"];
	if (vault) args.push("--vault", vault);
	const child = Bun.spawn(args, {
		stdout: "pipe",
		stderr: "pipe",
		env: Bun.env,
	});
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	if (code !== 0)
		throw new Error(
			`Could not read the Barnaloppan credentials from 1Password: ${stderr.trim() || `exit ${code}`}`,
		);
	const item = JSON.parse(stdout) as {
		fields?: Array<{ label?: string; value?: string }>;
	};
	const fields = new Map(
		(item.fields ?? []).map((field) => [
			field.label?.toLowerCase(),
			field.value,
		]),
	);
	const email = fields.get("email") || fields.get("username");
	const password = fields.get("password");
	if (!email || !password)
		throw new Error(
			"The 1Password item needs email/username and password fields.",
		);
	return { email, password };
}
