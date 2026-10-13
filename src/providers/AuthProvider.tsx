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
import { SESSION_EXPIRED_MESSAGE, forgetToken, onSessionExpired, rememberToken } from "@/lib/auth";
import { trace } from "@/lib/debug";
import type { GrantReason } from "@/lib/host";
import { useHostChannel } from "./HostChannelProvider";

/**
 * The OMS session: how it is obtained, and what the screens see of it.
 *
 * The token is a merchant access token issued by Providhy IAM. It does not expire. It arrives one
 * way only: the Fonepoints portal frames OMS at `/embed/*` and posts it as `host.auth.grant` — and
 * only when OMS asks for one with `oms.auth.renew`. There is no other way in: no token on the URL,
 * no development sign-in. Opening OMS outside the portal shows where to open it from instead.
 *
 * `/api/session` stores the token in a persistent httpOnly cookie (without calling Sales), and
 * every later request goes through `/api/oms/*`.
 *
 * **The cookie is tried first, always, and it decides whether a handshake happens at all.** The
 * token does not expire, so the cookie is the reference: checking it is a cookie read, with no call
 * to Sales. A token Sales does not accept is caught by the first data request. The portal cannot
 * see this cookie (it is HttpOnly and belongs to another site), so every time it opens OMS it waits
 * for OMS to say which case it is in:
 *
 * - a cookie → `oms.auth.ok { session: "existing" }`. No token is requested.
 * - no cookie → `oms.auth.renew { reason: "missing" }`. The portal asks its backend for a token
 *   and hands it over. The portal keeps no token of its own.
 *
 * One request at a time: while OMS is waiting for a grant it does not ask again, and it ignores a
 * grant or denial it did not ask for.
 *
 * **A refused token is replaced when it can be.** Any `401` from the API — a token revoked or
 * replaced on the Sales side — raises `onSessionExpired`; the proxy has already cleared the cookie.
 * OMS asks the portal again with `reason: "rejected"`, which gets a new token from its backend. A
 * token refused within a minute of being handed over is a bad token, so OMS stops and says so
 * instead of asking again in a loop. Either way every query stops while it happens.
 *
 * The cookie ends only with portal sign-out (`/embed-signout`), a refused token, or the merchant
 * clearing site data.
 */

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/**
 * Why there is no session, as a kind rather than as prose.
 *
 * The gate shows each differently without matching on the message text: `direct-visit` is
 * guidance (where to open OMS from) and gets no retry — retrying changes nothing. `failure` is
 * everything worth retrying.
 */
export type AuthFailureKind = "direct-visit" | "failure";

/**
 * A token refused sooner than this after it was handed over is not renewed automatically. A token
 * the portal just fetched and Sales already refuses has not been revoked; something else is wrong,
 * and asking the portal again would most likely bring back the same token.
 */
const RENEW_COOLDOWN_MS = 60_000;

/** `{ error: { message } }` from this app's session route, when the body has one. */
async function errorMessage(res: Response): Promise<string | undefined> {
	const body = (await res.json().catch(() => null)) as {
		error?: { message?: string };
	} | null;
	return body?.error?.message;
}

export interface AuthState {
	status: AuthStatus;
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
}

export function AuthProvider({ children }: AuthProviderProps) {
	const channel = useHostChannel();
	const [status, setStatus] = useState<AuthStatus>("loading");
	const [reason, setReason] = useState<string | null>(null);
	const [reasonKind, setReasonKind] = useState<AuthFailureKind | null>(null);
	const [attempt, setAttempt] = useState(0);

	/**
	 * Guards against a second exchange for one page view, and makes Strict Mode's second boot a
	 * no-op while the first one's exchange is still in flight.
	 */
	const exchanging = useRef(false);

	/**
	 * True from the moment OMS sends `oms.auth.renew` until the portal answers.
	 *
	 * Two jobs. It keeps the handshake to one at a time: a second reason to ask (another `401`, a
	 * Strict Mode re-run) while one is in flight does not send a second request. And it is the only
	 * time a grant or a denial is acted on — OMS uses a token it asked for, not one that arrives
	 * while its own session is fine.
	 */
	const awaitingGrant = useRef(false);

	/** When the portal last handed over a token that was stored. Zero for a cookie session. */
	const signedInAt = useRef(0);

	/** When OMS last asked the portal for a token, to time the handshake in the trace. */
	const askedAt = useRef(0);

	const retry = useCallback(() => {
		trace("auth", "retry pressed: starting the session check again");
		exchanging.current = false;
		awaitingGrant.current = false;
		setStatus("loading");
		setReason(null);
		setReasonKind(null);
		setAttempt((value) => value + 1);
	}, []);

	/** Every path out of "no session" goes through here, so the kind is never left stale. */
	const fail = useCallback((kind: AuthFailureKind, message: string) => {
		trace("auth", `✖ no session (${kind}): ${message}`);
		setReason(message);
		setReasonKind(kind);
		setStatus("unauthenticated");
	}, []);

	/**
	 * Trades a token for the session cookie.
	 *
	 * `/api/session` stores the token as given — it does not call Sales — so a token Sales does not
	 * accept shows up on the first data request instead (see the expiry handler). Resolves to whether
	 * the cookie was set.
	 */
	const exchange = useCallback(
		async (token: string): Promise<boolean> => {
			if (exchanging.current) {
				trace("auth", "a second grant arrived while the first is being stored: ignored");
				return false;
			}
			exchanging.current = true;

			// Held in memory as well as in the cookie, for a browser that refuses a partitioned
			// third-party cookie. See `@/lib/auth/token` — memory only, never storage.
			rememberToken(token);

			trace("auth", "step 19 · sending the token to OMS's own server (POST /api/session)", {
				token,
			});
			try {
				const res = await fetch("/api/session", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ token }),
				});

				if (!res.ok) {
					exchanging.current = false;
					forgetToken();
					trace("auth", `✖ step 20 · the server refused to store it: HTTP ${res.status}`);
					fail("failure", (await errorMessage(res)) || "Couldn't start the OMS session.");
					return false;
				}

				// Counted from a fresh trade only: a token refused soon after this is a bad token,
				// not a revoked one, and must not be asked for again in a loop.
				signedInAt.current = Date.now();
				trace(
					"auth",
					`✔ step 21–22 · token stored in the oms_at cookie; session ready${
						askedAt.current
							? ` (${Math.round(performance.now() - askedAt.current)} ms after asking the portal)`
							: ""
					}`,
				);
				setReason(null);
				setReasonKind(null);
				setStatus("authenticated");
				return true;
			} catch (error) {
				exchanging.current = false;
				forgetToken();
				trace("auth", "✖ step 19 · could not reach OMS's own server", { error: String(error) });
				fail("failure", "Couldn't reach OMS to start the session.");
				return false;
			}
		},
		[fail],
	);

	/**
	 * Asks the portal for a token: the start of a handshake, and the only thing that starts one.
	 *
	 * Called when the cookie check finds no session, and when Sales refuses the token mid-visit.
	 * The surface shows "Opening OMS…" meanwhile, which also unmounts every query.
	 */
	const requestGrant = useCallback(
		(why: GrantReason) => {
			setReason(null);
			setReasonKind(null);
			setStatus("loading");
			if (awaitingGrant.current) {
				trace(
					"auth",
					`step 8 · already waiting for the portal's answer; not asking again (${why})`,
				);
				return;
			}
			awaitingGrant.current = true;
			askedAt.current = performance.now();
			trace("auth", `step 8 · asking the portal for a token (reason: ${why})`);
			channel?.send({ type: "oms.auth.renew", reason: why });
		},
		[channel],
	);

	/*
	 * The grant listener.
	 *
	 * Subscribed before `HostChannelProvider` posts `oms.ready` — React runs child effects before
	 * parent ones — so the portal's answer cannot arrive before we are listening.
	 */
	useEffect(() => {
		if (!channel?.embedded) return;

		const offGrant = channel.on("host.auth.grant", ({ token }) => {
			// Only the answer to our own `oms.auth.renew`. A grant that arrives while the session is
			// fine is dropped, which is what keeps a valid session from being replaced.
			if (!awaitingGrant.current) {
				trace("auth", "✖ step 18 · a grant arrived but OMS did not ask for one: ignored (check J)");
				return;
			}
			if (typeof token !== "string" || !token) {
				trace("auth", "✖ step 18 · the grant carried no token: ignored");
				return;
			}
			trace("auth", "step 18 · the grant answers OMS's own request: accepted (check J)", { token });
			awaitingGrant.current = false;

			void exchange(token).then((stored) => {
				// Reported back so the portal can show the connection state, and so a failure is
				// visible there rather than only inside a frame nobody is looking at.
				trace(
					"auth",
					stored
						? "step 22 · telling the portal: signed in (session: new)"
						: "telling the portal the token could not be stored (exchange_failed)",
				);
				channel.send(
					stored
						? { type: "oms.auth.ok", session: "new" }
						: { type: "oms.auth.failed", reason: "exchange_failed" },
				);
			});
		});

		const offDenied = channel.on("host.auth.denied", ({ reason: denied }) => {
			// A denial matters only while OMS is waiting for a token. One that arrives while the
			// session is fine must not sign the merchant out.
			if (!awaitingGrant.current) {
				trace("auth", `a denial (${denied}) arrived but OMS did not ask for a token: ignored`);
				return;
			}
			trace("auth", `✖ step 10–12 · the portal could not get a token: ${denied}`);
			awaitingGrant.current = false;
			exchanging.current = false;
			// Distinct causes, and conflating them sends people to the wrong fix: an ended portal
			// session needs a sign-in; a failed token request is usually the Fonepoints backend
			// being down or IAM refusing its key.
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
	}, [channel, exchange, fail]);

	/*
	 * A refused token. The fetch client raises it on any 401; the gate then replaces the surface,
	 * which unmounts every query — the "stop calling the API" half of `src/api.md`'s instruction.
	 *
	 * The portal can hand over a new token, so a refused one (revoked or replaced) is replaced
	 * rather than left as a dead end. Several queries usually fail together; `requestGrant` asks
	 * once.
	 */
	useEffect(() => {
		return onSessionExpired(() => {
			const sinceSignIn = Date.now() - signedInAt.current;
			trace(
				"auth",
				`step 26–27 · Sales refused the token (401); the screens stop calling the API`,
				{ msSinceSignIn: signedInAt.current ? sinceSignIn : "none on this page view" },
			);
			exchanging.current = false;

			// A token handed over less than a minute ago and already refused is a bad token, not a
			// revoked one. Asking again would most likely bring back the same token, so stop, in the
			// guide's words for a refused token (`src/api.md`).
			if (Date.now() - signedInAt.current < RENEW_COOLDOWN_MS) {
				trace(
					"auth",
					"step 28 · the token was handed over under a minute ago: not asking again (no loop)",
				);
				fail("failure", SESSION_EXPIRED_MESSAGE);
				return;
			}
			trace("auth", "step 28 · asking the portal for a new token");
			requestGrant("rejected");
		});
	}, [channel, fail, requestGrant]);

	/* Boot. */
	useEffect(() => {
		let cancelled = false;

		async function boot() {
			// 0. OMS is embedded only. Outside the portal's frame there is no host to ask for a token,
			//    and even a cookie from an earlier visit is not a way in: OMS opens from the portal.
			//    (On localhost the portal and OMS are one site, so the cookie is visible here too.)
			trace("auth", `boot · embedded in a portal: ${Boolean(channel?.embedded)}`);
			if (!channel?.embedded) {
				fail("direct-visit", "Open OMS from the Fonepoints Business portal.");
				return;
			}

			// 1. The cookie, if there is one. A session here means nothing else has to happen — this
			//    is the common path: the merchant opening OMS again, a reload, or a new browser
			//    session (the cookie is persistent). The route only checks the cookie is there; it
			//    does not call Sales. A token Sales no longer accepts is caught by the first data
			//    request, whose 401 starts a new handshake.
			try {
				trace("auth", "step 6 · checking OMS's own session cookie (GET /api/session)");
				const res = await fetch("/api/session", { cache: "no-store" });
				if (cancelled) return;
				if (res.ok) {
					trace("auth", "✔ step 7 · cookie found: signed in with no handshake (session: existing)");
					setStatus("authenticated");
					// The portal is waiting to hear this before it does anything about a token.
					// An existing session means no handshake at all.
					channel.send({ type: "oms.auth.ok", session: "existing" });
					return;
				}
				trace("auth", `step 7 · no session cookie (HTTP ${res.status}): a handshake is needed`);
				// 401 `no_session`: fall through and ask the portal.
			} catch (error) {
				// No session yet is the normal first visit, not an error. Fall through.
				trace("auth", "step 6 · the session check failed; treating it as no session", {
					error: String(error),
				});
			}
			if (cancelled) return;

			// 2. No session: ask the portal for a token.
			requestGrant("missing");
			// The grant listener takes it from here.
		}

		void boot();
		return () => {
			cancelled = true;
		};
		// `attempt` is what the retry button changes, and the only reason to boot twice.
	}, [attempt, channel, fail, requestGrant]);

	return (
		<AuthContext.Provider value={{ status, reason, reasonKind, retry }}>
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
