/**
 * Turning a failed response into one message a user can read.
 *
 * Adapted from the eSewa MiniApp's `submitWithErrorHandler` (`shared/utils/error.ts`), which
 * collapses the several error envelopes a backend emits into a single string. Kept because the
 * lesson generalises: a real API is rarely consistent, and every screen should not re-derive the
 * same fallback chain.
 *
 * `ApiError` carries `code` as well as `message` and `status`, so a caller can branch on a stable
 * machine-readable code where the backend supplies one, and fall back to the text where it does not.
 *
 * No React code in this folder.
 */

/** Shown when nothing usable can be extracted from a failure. */
export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** Code used when the backend does not name one. */
export const UNKNOWN_ERROR_CODE = "unknown";

export class ApiError extends Error {
	/** Machine-readable code from the backend, or `"unknown"`. */
	readonly code: string;
	/** HTTP status, or 0 when the request never got a response (offline, DNS, abort). */
	readonly status: number;

	constructor(
		message: string,
		status: number,
		code: string = UNKNOWN_ERROR_CODE,
		options?: { cause?: unknown },
	) {
		super(message, options);
		this.name = "ApiError";
		this.code = code;
		this.status = status;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/** First non-empty string in a list of candidates. */
function firstString(...candidates: unknown[]): string | null {
	for (const candidate of candidates) {
		if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
	}
	return null;
}

/**
 * Best available message from a parsed error body, trying every envelope the OMS mock and the
 * Providhy API are known to use:
 *
 * - `{ error: { code, message } }` — the documented OMS shape
 * - `{ message }` / `{ error }` / `{ detail }` — single-string shapes
 * - `{ details: { field: [msg, ...] } }` — Django-style field errors, joined
 * - `{ details: "msg" }`, `{ non_field_errors: [msg, ...] }` — other Providhy shapes
 */
export function messageFromBody(body: unknown): string | null {
	if (typeof body === "string") return body.trim() || null;
	if (!isRecord(body)) return null;

	// { error: { code, message } }
	if (isRecord(body.error)) {
		const nested = firstString(body.error.message, body.error.detail);
		if (nested) return nested;
	}

	const direct = firstString(body.message, body.error, body.detail, body.details);
	if (direct) return direct;

	// { details: { field: ["too short", ...] } }
	if (isRecord(body.details)) {
		const joined = Object.values(body.details)
			.flatMap((value) => (Array.isArray(value) ? value : [value]))
			.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
			.join(", ");
		if (joined) return joined;
	}

	if (Array.isArray(body.non_field_errors)) {
		const joined = body.non_field_errors
			.filter((value): value is string => typeof value === "string")
			.join(", ");
		if (joined) return joined;
	}

	return null;
}

/** Machine-readable code from a parsed error body, when it supplies one. */
export function codeFromBody(body: unknown): string | null {
	if (!isRecord(body)) return null;
	if (isRecord(body.error)) {
		const nested = firstString(body.error.code);
		if (nested) return nested;
	}
	return firstString(body.code);
}

/**
 * Message to show for any thrown value. Use this in UI; never surface a raw error object.
 *
 * `ApiError` already holds a normalised message. Anything else (a `TypeError` from `fetch` when
 * the network is down, a thrown string) falls back to the generic message, because browser
 * network messages are not useful to a user.
 */
export function toErrorMessage(error: unknown): string {
	if (error instanceof ApiError) return error.message || GENERIC_ERROR_MESSAGE;
	return GENERIC_ERROR_MESSAGE;
}

/** True when a request failed before any response arrived — worth a "check your connection" hint. */
export function isOfflineError(error: unknown): boolean {
	return error instanceof ApiError && error.status === 0;
}
