/**
 * Trace logging for the authentication flow, for testing it end to end.
 *
 * One line per thing that happens, prefixed `[OMS:<scope>]` so a test run can be filtered by
 * typing `[OMS` into the browser console (or `grep "\[OMS"` on the server), and tagged with the
 * step number from the flow document (`OMS-Fonepoints-Flow.docx`) wherever there is one, so the
 * log reads against the flowchart:
 *
 *   [OMS:auth] 12:01:02.345 step 6 · checking the session cookie (GET /api/session)
 *
 * **It never prints a credential.** Anything under a key that looks like a token, key, cookie or
 * password is replaced with `<redacted, N chars>` before it is logged (`redact`), and call sites
 * log lengths and outcomes rather than values. A trace line is safe to paste into a ticket.
 *
 * **When it prints** (`traceEnabled`):
 * - always in development (`next dev`);
 * - in any build when `NEXT_PUBLIC_OMS_DEBUG=1` was set at build time;
 * - in the browser, in any build, when `localStorage["oms:debug"] === "1"` — set it from the
 *   DevTools console of the OMS frame (select the frame in the context dropdown first) and reload.
 *   Handy against a deployed portal where rebuilding is not an option.
 * Otherwise nothing is logged, so a production merchant's console stays empty. Tests set
 * `NODE_ENV=test`, which is also off, so the test output stays readable.
 *
 * `traceWarn` is for the few events that matter even with tracing off — a request refused for its
 * origin, a token Sales rejected. It is for server code only: in the browser a rejected message is
 * routine noise from extensions and dev tools, so it goes through `trace`.
 *
 * Pure TypeScript, no React, usable from the browser and from route handlers.
 */

export type TraceScope = "host" | "auth" | "api" | "session" | "proxy" | "rider" | "signout";

const FLAG_KEY = "oms:debug";

/** Keys whose values are credentials, matched case-insensitively against the whole key. */
const SECRET_KEY = /token|authorization|api[-_]?key|password|secret|cookie|voucher/i;

export function traceEnabled(): boolean {
	if (process.env.NODE_ENV === "development") return true;
	if (process.env.NEXT_PUBLIC_OMS_DEBUG === "1") return true;
	if (typeof window === "undefined") return process.env.OMS_DEBUG === "1";
	try {
		return window.localStorage.getItem(FLAG_KEY) === "1";
	} catch {
		// Storage can be blocked in a third-party frame; then the build-time flag is the way.
		return false;
	}
}

/**
 * A copy of `value` that is safe to log: values under secret-looking keys are replaced by a
 * placeholder naming only their length. Walks plain objects and arrays; everything else is
 * returned as is.
 */
export function redact(value: unknown, depth = 0): unknown {
	if (depth > 4 || value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
			key,
			SECRET_KEY.test(key) ? placeholder(entry) : redact(entry, depth + 1),
		]),
	);
}

function placeholder(entry: unknown): string {
	return typeof entry === "string" ? `<redacted, ${entry.length} chars>` : "<redacted>";
}

function stamp(): string {
	return new Date().toISOString().slice(11, 23);
}

function format(scope: TraceScope, message: string): string {
	return `[OMS:${scope}] ${stamp()} ${message}`;
}

/** One trace line, when tracing is on. `data` is redacted first. */
export function trace(scope: TraceScope, message: string, data?: unknown): void {
	if (!traceEnabled()) return;
	if (data === undefined) console.log(format(scope, message));
	else console.log(format(scope, message), redact(data));
}

/** A line that prints even with tracing off. Server code only; see the module comment. */
export function traceWarn(scope: TraceScope, message: string, data?: unknown): void {
	if (data === undefined) console.warn(format(scope, message));
	else console.warn(format(scope, message), redact(data));
}
