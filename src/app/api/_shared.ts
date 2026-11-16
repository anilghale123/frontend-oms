import "server-only";

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
	return origin === new URL(request.url).origin;
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
