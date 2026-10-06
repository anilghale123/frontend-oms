"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { rememberToken, type MerchantProfile } from "@/lib/auth";
import { useHostChannel } from "./HostChannelProvider";

/**
 * The OMS session: how it is obtained, and what the screens see of it.
 *
 * There are two ways in, and they differ only in who produces the token:
 *
 * **Embedded (`source="host"`).** The merchant pressed OMS in the Fonepoints portal. The portal
 * asked its own backend, which presented the company API key to the OMS backend and got an access
 * token; the portal posts that token into this frame as `host.auth.grant`. We hand it to
 * `/api/session`, which verifies it upstream and puts it in an httpOnly cookie.
 *
 * **Standalone (`source="standalone"`).** There is no host. `/api/session/dev` mints a token
 * server-side — development only — so the order screens can be worked on without running the
 * portal and its backend.
 *
 * Both paths end in the same place: a cookie, and every later request going through `/api/oms/*`.
 * That is deliberate. The dev path is not a second authentication system; it replaces only the
 * question of who asked for the token.
 *
 * **The cookie is tried first, always.** It is what makes a reload inside the iframe free — the
 * session is already proven, and nothing needs to be said to the host. Only when there is no valid
 * cookie does the handoff run.
 */

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/**
 * Why there is no session, as a kind rather than as prose.
 *
 * The gate shows `direct-visit` quite differently from the rest — it is guidance, not an error, and
 * gets no retry — so it has to be able to tell them apart without matching on the message text.
 */
export type AuthFailureKind = "direct-visit" | "failure";

export interface AuthState {
	status: AuthStatus;
	merchant: MerchantProfile | null;
	/** Why the session could not be established, in words, for the gate to show. */
	reason: string | null;
	/** Which kind of failure it is, so the gate does not have to read `reason`. */
	reasonKind: AuthFailureKind | null;
	/** Re-runs the handoff, for the retry button on the failure state. */
	retry: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export interface AuthProviderProps {
	children: ReactNode;
	/** `host` on `/embed/*`, where the portal supplies the token. `standalone` everywhere else. */
	source: "host" | "standalone";
}

export function AuthProvider({ children, source }: AuthProviderProps) {
	const channel = useHostChannel();
	const [status, setStatus] = useState<AuthStatus>("loading");
	const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
	const [reason, setReason] = useState<string | null>(null);
	const [reasonKind, setReasonKind] = useState<AuthFailureKind | null>(null);
	const [attempt, setAttempt] = useState(0);

	/**
	 * Guards against a second exchange for one page view.
	 *
	 * The host re-answers `oms.ready` after every reload and may send `host.auth.grant` more than
	 * once — it is cheap for it to do so, and the protocol says it must re-answer. Without this,
	 * each arrival would re-POST the session.
	 */
	const exchanging = useRef(false);

	const retry = useCallback(() => {
		exchanging.current = false;
		setStatus("loading");
		setReason(null);
		setReasonKind(null);
		setAttempt((value) => value + 1);
	}, []);

	/** Every path out of "no session" goes through here, so the kind is never left stale. */
	const fail = useCallback((kind: AuthFailureKind, message: string) => {
		setReason(message);
		setReasonKind(kind);
		setStatus("unauthenticated");
	}, []);

	/**
	 * Trades a token for the session cookie. Shared by both sources.
	 *
	 * Returns the merchant rather than a boolean, so the caller can name them when it reports back
	 * to the portal — reading it off `merchant` state instead would race the re-render.
	 */
	const exchange = useCallback(
		async (token: string): Promise<MerchantProfile | null> => {
			if (exchanging.current) return null;
			exchanging.current = true;

			// Held in memory as well as in the cookie, for a browser that refuses a partitioned
			// third-party cookie. See `@/lib/auth/token` — memory only, never storage.
			rememberToken(token);

			try {
				const res = await fetch("/api/session", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ token }),
				});

				if (!res.ok) {
					exchanging.current = false;
					fail("failure", "The access token was rejected. Reopen OMS from the portal.");
					return null;
				}

				const body = (await res.json()) as { merchant: MerchantProfile };
				setMerchant(body.merchant);
				setReason(null);
				setReasonKind(null);
				setStatus("authenticated");
				return body.merchant;
			} catch {
				exchanging.current = false;
				fail("failure", "Couldn't reach OMS to start the session.");
				return null;
			}
		},
		[fail],
	);

	/*
	 * The grant listener.
	 *
	 * Subscribed before `HostChannelProvider` posts `oms.ready` — React runs child effects before
	 * parent ones — so the portal's answer cannot arrive before we are listening.
	 */
	useEffect(() => {
		if (source !== "host" || !channel?.embedded) return;

		const offGrant = channel.on("host.auth.grant", ({ token }) => {
			if (typeof token !== "string" || !token) return;

			void exchange(token).then((merchant) => {
				// Reported back so the portal can show the connection state, and so a failure is
				// visible there rather than only inside a frame nobody is looking at. The merchant
				// id goes with it, which is how the portal can tell that OMS opened as the merchant
				// the portal thinks it signed in.
				channel.send(
					merchant
						? { type: "oms.auth.ok", merchantId: merchant.merchantId }
						: { type: "oms.auth.failed", reason: "exchange_failed" },
				);
			});
		});

		const offDenied = channel.on("host.auth.denied", ({ reason: denied }) => {
			exchanging.current = false;
			// Three distinct causes, and conflating them sends people to the wrong fix: an ended
			// portal session needs a sign-in, a failed token request is usually the Fonepoints
			// backend being down or holding the wrong API key, and anything else is the account.
			if (denied === "no_session") {
				fail("failure", "Your Fonepoints session has ended. Sign in to the portal again.");
			} else if (denied === "token_request_failed") {
				fail("failure", "The Fonepoints portal couldn't get access to OMS. Try again.");
			} else {
				fail("failure", "The portal could not open OMS for this account.");
			}
		});

		return () => {
			offGrant();
			offDenied();
		};
	}, [channel, exchange, fail, source]);

	/* Boot. */
	useEffect(() => {
		let cancelled = false;

		async function boot() {
			// 1. The cookie, if there is one. A valid session here means nothing else has to
			//    happen — this is the reload path, and the common one.
			try {
				const res = await fetch("/api/session", { cache: "no-store" });
				if (cancelled) return;
				if (res.ok) {
					const body = (await res.json()) as { merchant: MerchantProfile };
					setMerchant(body.merchant);
					setStatus("authenticated");
					return;
				}
			} catch {
				// No session yet is the normal first visit, not an error. Fall through.
			}
			if (cancelled) return;

			// 2. No cookie. Where a token comes from depends on the surface.
			if (source === "host") {
				if (!channel?.embedded) {
					// `/embed/*` opened outside a frame, usually from a pasted URL. There is no
					// host to ask, and saying so is more useful than a spinner that never ends.
					fail("direct-visit", "Open OMS from the Fonepoints Business portal.");
					return;
				}

				// Framed with no session: ask for one. The host also answers `oms.ready` with a
				// grant, so this is the belt to that braces — it covers a session revoked
				// mid-visit, where `oms.ready` has already been answered for this frame.
				channel.send({ type: "oms.auth.renew" });
				return; // The grant listener takes it from here.
			}

			// Standalone: mint one locally. Only `AUTH_MODE=dev` allows it; anything else answers
			// 404, which becomes the "open it from the portal" message below.
			try {
				const res = await fetch("/api/session/dev", { method: "POST" });
				if (cancelled) return;

				if (res.ok) {
					const body = (await res.json()) as {
						merchant: MerchantProfile;
						accessToken?: string;
					};
					if (body.accessToken) rememberToken(body.accessToken);
					setMerchant(body.merchant);
					setStatus("authenticated");
					return;
				}

				const body = (await res.json().catch(() => null)) as {
					error?: { code?: string; message?: string };
				} | null;

				// `disabled` is production answering: the development mint is off, so the only way
				// in is the portal. Not a failure, so it is not shown as one.
				if (body?.error?.code === "disabled") {
					fail("direct-visit", "Open OMS from the Fonepoints Business portal.");
				} else {
					fail("failure", body?.error?.message || "Couldn't start an OMS session.");
				}
			} catch {
				if (cancelled) return;
				fail("failure", "Couldn't reach OMS to start the session.");
			}
		}

		void boot();
		return () => {
			cancelled = true;
		};
		// `attempt` is what the retry button changes, and the only reason to boot twice.
	}, [attempt, channel, fail, source]);

	return (
		<AuthContext.Provider value={{ status, merchant, reason, reasonKind, retry }}>
			{children}
		</AuthContext.Provider>
	);
}

/** The session. Throws outside the provider, because every caller sits inside a gated surface. */
export function useAuth(): AuthState {
	const value = useContext(AuthContext);
	if (!value) {
		throw new Error("useAuth must be used inside an AuthProvider");
	}
	return value;
}

/** The signed-in merchant, or `null` while the session is still being established. */
export function useMerchant(): MerchantProfile | null {
	return useAuth().merchant;
}
