/**
 * The postMessage protocol between the Fonepoints Business portal (parent) and OMS (child).
 *
 * The full protocol is specified in `auth.md` section 8. It is one channel shared by two
 * concerns: the authentication handshake and the host-driven appearance. Only the appearance
 * half is wired today — the portal has a theme switcher, while authentication is still deferred
 * — so the auth message types are declared here and handled when `AuthProvider` lands. Declaring
 * them now keeps the protocol in one place and means auth adds handlers rather than a second
 * envelope.
 *
 * No React in this folder.
 */

import type { AppearanceMode, AppearanceTheme } from "@/lib/appearance";

/** Bumped only for a breaking change. A receiver drops any message with a version it doesn't know. */
export const PROTOCOL_VERSION = 1;

/** `source` on messages OMS sends. */
export const OMS_SOURCE = "fonepoints-oms";
/** `source` on messages OMS accepts. */
export const HOST_SOURCE = "fonepoints-host";

/** Light or dark only — the host resolves "system" before it sends. */
export type HostThemeMode = Extract<AppearanceMode, "light" | "dark">;

/**
 * Why OMS is asking the portal for a token: it has no session cookie (`missing`), or the Sales
 * service refused the token OMS had — revoked, replaced or simply wrong (`rejected`). Tokens do not
 * expire, so `rejected` tells the portal this is a second ask: whatever it gave before did not work.
 */
export type GrantReason = "missing" | "rejected";

/** Messages OMS sends to the portal. */
export type OmsToHost =
	/**
	 * OMS mounted and is listening. Sent again after every reload. It says nothing about the
	 * session: the host answers with the theme only, and waits for `oms.auth.ok` or
	 * `oms.auth.renew` before doing anything about a token.
	 */
	| { type: "oms.ready" }
	/** The merchant navigated inside OMS, so the host can follow in its breadcrumb and URL. */
	| { type: "oms.route.changed"; path: string; title: string }
	/**
	 * OMS has a session. `existing` means its cookie was there, so no token was needed; `new` means
	 * it has just stored a `host.auth.grant`. `merchantId` is sent only when OMS knows it (the
	 * development sign-in); OMS does not call Sales to sign in, so it usually does not.
	 */
	| { type: "oms.auth.ok"; merchantId?: string; session: "existing" | "new" }
	| { type: "oms.auth.failed"; reason: string }
	/** OMS has no usable session and asks for a token. The only message that should start one. */
	| { type: "oms.auth.renew"; reason: GrantReason }
	/** Sent by `/embed-signout` once the session cookies are deleted: portal sign-out is done. */
	| { type: "oms.auth.cleared" };

/** Messages OMS accepts from the portal. */
export type HostToOms =
	/** Host appearance. Applied transiently — never persisted (auth.md section 9). */
	| { type: "host.theme"; mode: HostThemeMode; accent?: string }
	/**
	 * Open an OMS screen, by its path under the embedded surface (`/orders`, `/orders/{id}`). The
	 * portal sends `/orders` when the merchant comes back to OMS from another portal page, so OMS
	 * opens on its order queue like any portal section opened from the sidebar. Anything that is not
	 * an order screen is ignored (`asHostRoute`).
	 */
	| { type: "host.route.request"; path: string }
	/** The answer to `oms.auth.renew`. Used only while OMS is waiting for one. */
	| { type: "host.auth.grant"; token: string; expiresAt: string }
	/** The portal could not get a token: `no_session` or `token_request_failed`. */
	| { type: "host.auth.denied"; reason: string }
	/**
	 * The merchant is back on OMS. The portal keeps the OMS frame alive while they visit its other
	 * pages and only hides it, so nothing on screen was refetched meanwhile: OMS refreshes what is
	 * stale. An older OMS ignores it, so the two apps still ship independently.
	 */
	| { type: "host.visible" };

/** Every message carries the envelope, so unrelated postMessage traffic is easy to reject. */
export type Envelope = { source: string; v: number };

export type HostMessage = HostToOms & Envelope;

/**
 * True when `data` is a message from the portal on a protocol version we understand.
 *
 * This guard is not decoration. Next's HMR client, the React DevTools bridge and browser
 * extensions all post messages to this window, so without the `source` and `v` check the
 * handlers below would run on unrelated traffic. Origin and `event.source` are checked
 * separately, in the channel — all three are required (auth.md section 12, rule 3).
 */
export function isHostMessage(data: unknown): data is HostMessage {
	if (typeof data !== "object" || data === null) return false;
	const message = data as Partial<Envelope> & { type?: unknown };
	return (
		message.source === HOST_SOURCE &&
		message.v === PROTOCOL_VERSION &&
		typeof message.type === "string"
	);
}

/** Narrows a validated host message to one `type`. */
export function isHostMessageOfType<T extends HostToOms["type"]>(
	message: HostMessage,
	type: T,
): message is Extract<HostToOms, { type: T }> & Envelope {
	return message.type === type;
}

/**
 * The OMS path a `host.route.request` may open, or `null`. Only the order screens, and only as a
 * plain path: no query, no fragment, no `..`, and never `//`, which a router would read as another
 * host. The portal is trusted, but a message is still data.
 */
export function asHostRoute(path: unknown): string | null {
	if (typeof path !== "string") return null;
	return /^\/orders(\/[A-Za-z0-9._~%-]+)?$/.test(path) && !path.includes("..") ? path : null;
}

/** True when `value` is one of the appearance modes the host may send. */
export function isHostThemeMode(value: unknown): value is HostThemeMode {
	return value === "light" || value === "dark";
}

/**
 * The accent is an opaque string on the wire, because the host and OMS ship independently and
 * the host may know an accent this build does not. An unknown accent is ignored rather than
 * guessed, so the theme falls back to whatever is already applied.
 */
export function asAppearanceTheme(
	value: unknown,
	known: readonly { id: AppearanceTheme }[],
): AppearanceTheme | null {
	if (typeof value !== "string") return null;
	return known.find((theme) => theme.id === value)?.id ?? null;
}
