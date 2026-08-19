import { access, constants, readFile } from "node:fs/promises";
import type { CsvProduct } from "../types.ts";

function parseCsv(source: string): string[][] {
	const rows: string[][] = [[]];
	let value = "";
	let quoted = false;
	for (let index = 0; index < source.length; index += 1) {
		const character = source.charAt(index);
		if (quoted) {
			if (character === '"' && source[index + 1] === '"') {
				value += '"';
				index += 1;
			} else if (character === '"') quoted = false;
			else value += character;
			continue;
		}
		if (character === '"') quoted = true;
		else if (character === ",") {
			const current = rows.at(-1);
			if (!current) throw new Error("CSV parser lost its current row.");
			current.push(value);
			value = "";
		} else if (character === "\n") {
			const current = rows.at(-1);
			if (!current) throw new Error("CSV parser lost its current row.");
			current.push(value.replace(/\r$/, ""));
			rows.push([]);
			value = "";
		} else value += character;
	}
	if (quoted) throw new Error("CSV has an unterminated quoted field.");
	const current = rows.at(-1);
	if (!current) throw new Error("CSV parser produced no rows.");
	if (value || current.length) current.push(value.replace(/\r$/, ""));
	else rows.pop();
	return rows;
}

async function validatePhoto(path: string, row: number): Promise<void> {
	if (!/\.(jpe?g|png)$/i.test(path))
		throw new Error(`Row ${row}: photo must be a .jpg, .jpeg, or .png file.`);
	try {
		await access(path, constants.R_OK);
	} catch {
		throw new Error(`Row ${row}: photo cannot be read: ${path}`);
	}
}

export async function readProductsCsv(path: string): Promise<CsvProduct[]> {
	const rows = parseCsv(await readFile(path, "utf8"));
	if (rows.length < 2)
		throw new Error("CSV needs a header and at least one product.");
	const firstRow = rows[0];
	if (!firstRow) throw new Error("CSV needs a header row.");
	const header = firstRow.map((field) => field.trim().toLowerCase());
	const fieldIndex = (name: string) => header.indexOf(name);
	if (fieldIndex("name") === -1 || fieldIndex("price") === -1)
		throw new Error("CSV needs headers: name,price (optional: active,photo).");
	const products: CsvProduct[] = [];
	for (let row = 1; row < rows.length; row += 1) {
		const values = rows[row];
		if (!values) continue;
		const get = (name: string) => values[fieldIndex(name)]?.trim() ?? "";
		const name = get("name");
		const price = Number(get("price").replaceAll(" ", ""));
		if (!name || name.length > 24)
			throw new Error(
				`Row ${row + 1}: name is required and must be at most 24 characters.`,
			);
		if (!Number.isInteger(price) || price < 1)
			throw new Error(
				`Row ${row + 1}: price must be a positive whole number in kr.`,
			);
		const active = !["0", "false", "no"].includes(get("active").toLowerCase());
		const photo = get("photo") || undefined;
		if (photo) await validatePhoto(photo, row + 1);
		products.push({ name, price, active, photo });
	}
	return products;
}
