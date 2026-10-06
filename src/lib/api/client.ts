/**
 * Typed fetch client. Every screen talks to the OMS through this one module.
 *
 * Base URL comes from `@/config/env` (`NEXT_PUBLIC_OMS_API_BASE`, default `/api/oms`). That
 * default is this app's own proxy, not the OMS backend: the proxy reads the access token from an
 * httpOnly cookie on the server and attaches it, so no screen and no module in this folder ever
 * holds a credential. Pointing the variable at `/api/mock` still works and runs the whole app
 * against the in-repo mock with no backends at all.
 *
 * Failures are normalised into `ApiError { code, message, status }` by `./errors`, so callers get
 * one shape whichever envelope the backend used.
 *
 * No React code in this folder.
 */

import { OMS_API_BASE } from "@/config/env";
import { readRememberedToken } from "@/lib/auth";
import { ApiError, GENERIC_ERROR_MESSAGE, codeFromBody, messageFromBody } from "./errors";

/**
 * Authentication is a header this function does not normally send.
 *
 * The cookie does the work, and it is attached by the browser to these same-origin requests
 * without being readable here. `x-oms-token` is sent only when `@/lib/auth/token` is holding a
 * token, which happens when the browser refused the partitioned third-party cookie — the one case
 * where the iframe cannot rely on cookies at all. The proxy accepts either.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const fallbackToken = readRememberedToken();

	let res: Response;
	try {
		res = await fetch(`${OMS_API_BASE}${path}`, {
			...init,
			// Same-origin requests send cookies by default, but the embedded surface makes this
			// worth stating: the session cookie is the credential, and nothing works without it.
			credentials: "same-origin",
			headers: {
				"Content-Type": "application/json",
				...(fallbackToken ? { "x-oms-token": fallbackToken } : {}),
				...init?.headers,
			},
		});
	} catch (cause) {
		// No response at all: offline, DNS failure, or an aborted request.
		// Keep the original failure attached for debugging; the message stays user-facing.
		throw new ApiError("Couldn't reach OMS. Check your connection and try again.", 0, "network", {
			cause,
		});
	}

	if (!res.ok) {
		const body = await readBody(res);
		throw new ApiError(
			messageFromBody(body) ?? res.statusText ?? GENERIC_ERROR_MESSAGE,
			res.status,
			codeFromBody(body) ?? `http_${res.status}`,
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
		return text;
	}
}

export const apiClient = {
	get: <T>(path: string, init?: RequestInit) => request<T>(path, init),
	post: <T>(path: string, body?: unknown) =>
		request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
	patch: <T>(path: string, body?: unknown) =>
		request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
};

export { ApiError };
