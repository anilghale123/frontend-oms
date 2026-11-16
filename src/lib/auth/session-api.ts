/**
 * The two calls to this app's own `/api/session` route: storing a handed-over token as the session
 * cookie, and deleting it at portal sign-out.
 *
 * They are not data queries, so they do not go through `@/lib/api/client`: a `401` from them means
 * nothing to the session machinery there, and they run before there is a session to speak of. This
 * module is the one place outside that client allowed to call `fetch` for the session (AGENTS.md
 * rule 6), so the route's address and its error envelope are read in one place.
 *
 * No React in this folder.
 */

import { SESSION_API } from "@/config/constants";

export type SessionCallResult = { ok: true } | { ok: false; status: number; message?: string };

/**
 * Trades a token for the httpOnly session cookie. Resolves whether or not the route accepted it;
 * rejects only when the route could not be reached at all.
 */
export async function storeSession(token: string): Promise<SessionCallResult> {
	const res = await fetch(SESSION_API, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ token }),
	});
	return res.ok
		? { ok: true }
		: { ok: false, status: res.status, message: await errorMessage(res) };
}

/** Deletes the session cookie. Rejects only when the route could not be reached at all. */
export async function clearSession(): Promise<SessionCallResult> {
	const res = await fetch(SESSION_API, { method: "DELETE" });
	return res.ok ? { ok: true } : { ok: false, status: res.status };
}

/** `{ error: { message } }` from the session route, when the body has one. */
async function errorMessage(res: Response): Promise<string | undefined> {
	const body = (await res.json().catch(() => null)) as { error?: { message?: unknown } } | null;
	return typeof body?.error?.message === "string" ? body.error.message : undefined;
}
