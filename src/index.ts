#!/usr/bin/env bun

import {
	deleteProducts,
	getProductsHtml,
	login,
	saveProducts,
	uploadImage,
} from "./lib/client.ts";
import { clearSession, loadSession } from "./lib/config.ts";
import { readProductsCsv } from "./lib/csv.ts";
import { credentialsFrom1Password } from "./lib/onepassword.ts";
import { isJsonMode, output } from "./lib/output.ts";
import type { Product } from "./types.ts";

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const value = (flag: string) => {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
};
const positional = args.filter(
	(arg, index) => !arg.startsWith("-") && args[index - 1] !== "--booking-id",
);
const json = isJsonMode({ json: has("--json"), pretty: has("--pretty") });

function help(): void {
	console.log(`barnaloppan - CLI for Barnaloppan booth inventory

Usage:
  barnaloppan auth login --from-1password [--booking-id ID]
  barnaloppan auth status | logout
  barnaloppan list [--json]
  barnaloppan add products.csv [--yes]
  barnaloppan delete <product-id> [more IDs] [--yes]

CSV columns: name,price,active,photo
Creation and deletion are dry-run by default; --yes is required for writes.`);
}

function productsFromHtml(html: string): Product[] {
	const products: Product[] = [];
	for (const match of html.matchAll(
		/<div[^>]*class="[^"]*\bproduct\b[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*\bproduct\b|$)/gi,
	)) {
		const block = match[0];
		const id = Number(/name="product_id"[^>]*value="(\d+)"/i.exec(block)?.[1]);
		const name = /name="name"[^>]*value="([^"]*)"/i.exec(block)?.[1];
		if (!id || name === undefined) continue;
		const price = Number(/name="price"[^>]*value="(\d+)"/i.exec(block)?.[1]);
		const status = /data-status="([^"]+)"/i.exec(block)?.[1];
		products.push({
			id,
			name: name.replaceAll("&amp;", "&"),
			...(Number.isFinite(price) && price ? { price } : {}),
			...(status ? { status } : {}),
		});
	}
	return products;
}

async function main(): Promise<void> {
	const command = positional[0];
	if (has("--help") || !command || command === "help") return help();
	if (command === "version") return output({ version: "0.1.0" }, json);
	if (command === "auth") {
		const subcommand = positional[1];
		if (subcommand === "login") {
			if (!has("--from-1password"))
				throw new Error(
					"Use --from-1password; credentials are never accepted as CLI arguments.",
				);
			const { email, password } = await credentialsFrom1Password();
			const requestedBookingId = value("--booking-id");
			const bookingId = requestedBookingId
				? Number(requestedBookingId)
				: undefined;
			if (bookingId !== undefined && !Number.isInteger(bookingId))
				throw new Error("--booking-id must be an integer.");
			const resolvedBookingId = await login(email, password, bookingId);
			return output(
				{ status: "authenticated", bookingId: resolvedBookingId },
				json,
			);
		}
		if (subcommand === "status") {
			const session = await loadSession();
			return output(
				{ authenticated: true, bookingId: session.bookingId },
				json,
			);
		}
		if (subcommand === "logout")
			return output({ loggedOut: await clearSession() }, json);
		return help();
	}
	if (command === "list")
		return output(productsFromHtml(await getProductsHtml()), true);
	if (command === "add") {
		const csv = positional[1];
		if (!csv) throw new Error("Usage: barnaloppan add products.csv [--yes]");
		const products = await readProductsCsv(csv);
		if (!has("--yes"))
			return output({ dryRun: true, count: products.length, products }, true);
		const payload = [] as Record<string, unknown>[];
		for (const [order, product] of products.entries()) {
			const image = product.photo ? await uploadImage(product.photo) : "";
			payload.push({
				product_id: "",
				temp_id: String(order),
				image,
				newImage: image ? "1" : "0",
				deleteImage: "0",
				_delete: "0",
				name: product.name,
				price: String(product.price),
				imageUpload: null,
				active: product.active,
				image_2: "",
				newImage2: "0",
				deleteImage2: "0",
				webshop: "0",
				order,
			});
		}
		return output(
			{ created: await saveProducts(payload), count: products.length },
			true,
		);
	}
	if (command === "delete") {
		const ids = positional.slice(1).map(Number);
		if (!ids.length || ids.some((id) => !Number.isInteger(id) || id < 1))
			throw new Error(
				"Usage: barnaloppan delete <product-id> [more IDs] [--yes]",
			);
		if (!has("--yes")) return output({ dryRun: true, wouldDelete: ids }, true);
		return output({ deleted: ids, message: await deleteProducts(ids) }, true);
	}
	throw new Error(`Unknown command: ${command}. Run "barnaloppan help".`);
}

try {
	await main();
} catch (error) {
	console.error(
		json
			? JSON.stringify({ error: (error as Error).message })
			: `Error: ${(error as Error).message}`,
	);
	process.exit(1);
}
