import "server-only";
import { OMS_PUBLIC_ORIGIN } from "@/config/server-env";

/**
 * What every route handler under `src/app/api` shares: the error envelope, the same-origin check
 * and a size-capped JSON body reader. One copy, so the three routes cannot drift apart.
 */

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** `Cache-Control: no-store`, for every answer: none of these responses may be cached. */
export const NO_STORE_HEADERS = NO_STORE;

/** The `{ error: { code, message } }` envelope `@/lib/api/errors` reads. Never cached. */
export function jsonError(code: string, message: string, status: number): Response {
	return Response.json({ error: { code, message } }, { status, headers: NO_STORE });
}

/**
 * The origins a same-origin request may carry: the one in the request URL, the public address the
 * proxy in front of this server forwarded (`X-Forwarded-Host` / `Host`, with `X-Forwarded-Proto`),
 * and `OMS_PUBLIC_ORIGIN` when it is set. Behind a reverse proxy the URL alone names the container
 * (`http://0.0.0.0:3000`), so a browser's real `Origin` would never match it.
 */
export function expectedOrigins(request: Request): string[] {
	const url = new URL(request.url);
	const origins = new Set([url.origin]);
	const first = (value: string | null) => value?.split(",")[0]?.trim() || null;
	const host = first(request.headers.get("x-forwarded-host")) ?? first(request.headers.get("host"));
	if (host) {
		const proto = first(request.headers.get("x-forwarded-proto")) ?? url.protocol.slice(0, -1);
		origins.add(`${proto}://${host}`);
	}
	if (OMS_PUBLIC_ORIGIN) origins.add(OMS_PUBLIC_ORIGIN);
	return [...origins];
}

/**
 * True when the request came from a page on this origin.
 *
 * `Origin` is set by the browser on every cross-origin request and on every same-origin `POST` and
 * `DELETE`, and page script cannot change it. The session cookie is `SameSite=None` (the iframe
 * needs that), so `SameSite` does no CSRF work and this check replaces it. A request with no
 * `Origin` at all is a same-origin `GET` or a non-browser caller (curl, a server-side fetch), which
 * are not the confused-deputy case this guards against.
 */
export function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get("origin");
	if (!origin) return true;
	return expectedOrigins(request).includes(origin);
}

export type JsonBody = { ok: true; value: unknown } | { ok: false; status: 400 | 413 };

/**
 * The request body parsed as JSON, refused when it is larger than `maxBytes` (`413`) or is not JSON
 * (`400`). `Content-Length` is checked first, so an oversized body announced as such is never read;
 * the length is checked again after reading, because the header is optional and can be wrong.
 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBody> {
	const declared = Number(request.headers.get("content-length"));
	if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, status: 413 };

	let text: string;
	try {
		text = await request.text();
	} catch {
		return { ok: false, status: 400 };
	}
	if (new TextEncoder().encode(text).byteLength > maxBytes) return { ok: false, status: 413 };

	try {
		return { ok: true, value: JSON.parse(text) };
	} catch {
		return { ok: false, status: 400 };
	}
}
