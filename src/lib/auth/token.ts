/**
 * The in-memory fallback for the access token.
 *
 * The token normally lives in an httpOnly cookie that `/api/oms/*` reads server-side, so page
 * JavaScript never holds it. That breaks in one real case: OMS runs in a third-party iframe, and a
 * browser that blocks partitioned cookies refuses to store it. The merchant would then see a
 * sign-in failure on a working setup.
 *
 * So the token is also kept here, in a module variable, and `@/lib/api/client` sends it as a
 * bearer header when it is present. The proxy accepts either source.
 *
 * Two properties make this acceptable rather than a hole in the design:
 *
 * - It is **memory only**. Not `localStorage`, not `sessionStorage`, not a readable cookie —
 *   nothing survives a reload, so there is no stored credential for a later XSS to find.
 * - The token arrived over `postMessage` into this same JavaScript context, so this adds no
 *   exposure that the handoff itself did not already have.
 *
 * It is a fallback, not the mechanism: when cookies work, a reload re-reads the cookie and this is
 * never consulted.
 *
 * No React in this folder.
 */

let token: string | null = null;

export function rememberToken(value: string): void {
	token = value;
}

export function readRememberedToken(): string | null {
	return token;
}

export function forgetToken(): void {
	token = null;
}
