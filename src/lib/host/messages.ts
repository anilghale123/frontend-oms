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

/** Messages OMS sends to the portal. */
export type OmsToHost =
	/** OMS mounted and is listening. Sent again after every reload, so the host must re-answer. */
	| { type: "oms.ready" }
	/** The merchant navigated inside OMS, so the host can follow in its breadcrumb and URL. */
	| { type: "oms.route.changed"; path: string; title: string }
	// Declared for the auth phase (auth.md section 8); not sent yet.
	| { type: "oms.auth.ok"; merchantId: string }
	| { type: "oms.auth.failed"; reason: string }
	| { type: "oms.auth.renew" };

/** Messages OMS accepts from the portal. */
export type HostToOms =
	/** Host appearance. Applied transiently — never persisted (auth.md section 9). */
	| { type: "host.theme"; mode: HostThemeMode; accent?: string }
	/** Host deep link, e.g. the browser back button in the portal. */
	| { type: "host.route.request"; path: string }
	// Declared for the auth phase (auth.md section 8); not handled yet.
	| { type: "host.auth.grant"; token: string; expiresAt: string }
	| { type: "host.auth.denied"; reason: string };

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
