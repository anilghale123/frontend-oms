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
	/** Per-field messages from a `400`, e.g. `{ remarks: "Ensure this field has…" }`. */
	readonly fieldErrors: Record<string, string> | null;
	/** Seconds to wait before trying again, from a `429`'s `Retry-After`. */
	readonly retryAfter: number | null;

	constructor(
		message: string,
		status: number,
		code: string = UNKNOWN_ERROR_CODE,
		options?: {
			cause?: unknown;
			fieldErrors?: Record<string, string> | null;
			retryAfter?: number | null;
		},
	) {
		super(message, options?.cause === undefined ? undefined : { cause: options.cause });
		this.name = "ApiError";
		this.code = code;
		this.status = status;
		this.fieldErrors = options?.fieldErrors ?? null;
		this.retryAfter = options?.retryAfter ?? null;
	}
}

/**
 * What to say when the body names nothing, by status. Better than `res.statusText`, which is
 * empty over HTTP/2 and reads like "Service Unavailable" when it is not.
 */
export function messageForStatus(status: number): string {
	if (status === 404) return "Order not found.";
	if (status === 409) return "This order changed in the meantime. Reload it and try again.";
	if (status === 429) return "Too many requests. Wait a moment and try again.";
	if (status >= 500) return "OMS is unavailable right now. Try again in a moment.";
	return GENERIC_ERROR_MESSAGE;
}

/** `Retry-After` as seconds. The header may also be an HTTP date. */
export function parseRetryAfter(header: string | null): number | null {
	if (!header) return null;
	const seconds = Number(header);
	if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
	const at = Date.parse(header);
	return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - Date.now()) / 1000));
}

/** Keys that carry a whole-response message rather than one field's. */
const ENVELOPE_KEYS = new Set([
	"detail",
	"message",
	"error",
	"details",
	"code",
	"non_field_errors",
]);

/**
 * Per-field messages from a Django REST validation body: `{"field": ["message"]}` or
 * `{"field": "message"}`. `null` when the body is not shaped like that.
 */
export function fieldErrorsFromBody(body: unknown): Record<string, string> | null {
	if (!isRecord(body)) return null;
	const fields: Record<string, string> = {};
	for (const [key, value] of Object.entries(body)) {
		if (ENVELOPE_KEYS.has(key)) continue;
		const message = Array.isArray(value) ? firstString(...value) : firstString(value);
		if (message) fields[key] = message;
	}
	return Object.keys(fields).length > 0 ? fields : null;
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
 * Best available message from a parsed error body, trying every envelope the OMS proxy, the mock
 * and the Sales API are known to use:
 *
 * - `{ error: { code, message } }` — this app's proxy and session routes
 * - `{ message }` / `{ detail }` — the Sales API's 409 and its 401/404/429/503
 * - `{ error }` — other single-string shapes
 * - `{ details: { field: [msg, ...] } }` — Django-style field errors, joined
 * - `{ details: "msg" }`, `{ non_field_errors: [msg, ...] }` — other Providhy shapes
 * - `{ field: [msg] }` / `{ field: msg }` — the Sales API's 400
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

	// { field: ["message"] } — the Sales service's 400. Named, so "Ensure this field has no more
	// than 255 characters." says which field.
	const fields = fieldErrorsFromBody(body);
	if (fields) {
		return Object.entries(fields)
			.map(([field, message]) => `${fieldLabel(field)}: ${message}`)
			.join(" ");
	}

	return null;
}

/** `delivery_address` → "Delivery address". */
function fieldLabel(field: string): string {
	const words = field.replace(/[_-]+/g, " ").trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
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
