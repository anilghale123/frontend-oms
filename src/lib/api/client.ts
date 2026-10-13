/**
 * Typed fetch client. Every screen talks to the OMS through this one module.
 *
 * Two instances, one per surface:
 *
 * - `apiClient` — the merchant's order screens, through this app's `/api/oms` proxy
 *   (`OMS_API_BASE`), not the Sales service directly: the proxy reads the access token from an
 *   httpOnly cookie on the server and forwards to `{SALES_URL}api/oms/portal/`, so no screen and no
 *   module in this folder ever holds a credential. A `401` announces that the token stopped
 *   working (`@/lib/auth`); there is no refresh, and the fix is a new token from the portal.
 * - `riderApiClient` — the rider portal, through `/api/rider` (`RIDER_API_BASE`). A rider has no
 *   session, so this one sends no token and a `401` means nothing to the merchant's session.
 *
 * Failures are normalised into `ApiError { code, message, status }` by `./errors`, so callers get
 * one shape whichever envelope the backend used.
 *
 * No React code in this folder.
 */

import { OMS_API_BASE, RIDER_API_BASE } from "@/config/constants";
import { trace } from "@/lib/debug";
import {
	SESSION_EXPIRED_MESSAGE,
	forgetToken,
	notifySessionExpired,
	readRememberedToken,
} from "@/lib/auth";
import {
	ApiError,
	codeFromBody,
	fieldErrorsFromBody,
	messageForStatus,
	messageFromBody,
	parseRetryAfter,
} from "./errors";

/**
 * Authentication is a header this function does not normally send.
 *
 * The cookie does the work, and it is attached by the browser to these same-origin requests
 * without being readable here. `x-oms-token` is sent only when `@/lib/auth/token` is holding a
 * token, which happens when the browser refused the partitioned third-party cookie — the one case
 * where the iframe cannot rely on cookies at all. The proxy accepts either.
 */
async function request<T>(
	base: string,
	session: boolean,
	path: string,
	init?: RequestInit,
): Promise<T> {
	const fallbackToken = session ? readRememberedToken() : null;
	const method = init?.method ?? "GET";
	const startedAt = performance.now();
	const done = (status: number | string) =>
		trace(
			session ? "api" : "rider",
			`step 23 · ${method} ${base}${path} → ${status} (${Math.round(performance.now() - startedAt)} ms)`,
		);

	let res: Response;
	try {
		res = await fetch(`${base}${path}`, {
			...init,
			// Same-origin requests send cookies by default, but the embedded surface makes this
			// worth stating: the session cookie is the credential, and nothing works without it.
			credentials: "same-origin",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				...(fallbackToken ? { "x-oms-token": fallbackToken } : {}),
				...init?.headers,
			},
		});
	} catch (cause) {
		done("no response");
		// No response at all: offline, DNS failure, or an aborted request.
		// Keep the original failure attached for debugging; the message stays user-facing.
		throw new ApiError("Couldn't reach OMS. Check your connection and try again.", 0, "network", {
			cause,
		});
	}

	// Missing, invalid or revoked token. There is no refresh endpoint, so retrying is pointless:
	// drop the fallback copy and let the session gate ask the portal for a new one.
	done(res.status);
	if (res.status === 401 && session) {
		trace(
			"api",
			"step 26 · 401 from Sales: the token is refused; the proxy has already deleted the cookie",
		);
		forgetToken();
		notifySessionExpired();
		throw new ApiError(SESSION_EXPIRED_MESSAGE, 401, "session_expired");
	}

	if (!res.ok) {
		const body = await readBody(res);
		throw new ApiError(
			messageFromBody(body) ?? messageForStatus(res.status),
			res.status,
			codeFromBody(body) ?? `http_${res.status}`,
			{
				fieldErrors: res.status === 400 ? fieldErrorsFromBody(body) : null,
				retryAfter: parseRetryAfter(res.headers.get("Retry-After")),
			},
		);
	}

	// 204 and other empty responses have no JSON to parse.
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

/** Parsed JSON when the body is JSON, the raw text when it is not, `null` when it is empty. */
async function readBody(res: Response): Promise<unknown> {
	const text = await res.text().catch(() => "");
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		// An HTML error page (a proxy, a debug 500) is not a message anyone should read.
		return text.trimStart().startsWith("<") ? null : text;
	}
}

function createClient(base: string, session: boolean) {
	return {
		get: <T>(path: string, init?: RequestInit) => request<T>(base, session, path, init),
		post: <T>(path: string, body?: unknown) =>
			request<T>(base, session, path, {
				method: "POST",
				body: body ? JSON.stringify(body) : undefined,
			}),
	};
}

/** The merchant's order screens, through the token-attaching `/api/oms` proxy. */
export const apiClient = createClient(OMS_API_BASE, true);

/** The rider portal, through `/api/rider`. No session, no token. */
export const riderApiClient = createClient(RIDER_API_BASE, false);

export { ApiError };
