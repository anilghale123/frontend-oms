/**
 * What the fetch client learns about the session, announced to `AuthProvider`.
 *
 * OMS does not check its session before opening the screens: the session cookie is httpOnly, so
 * page script cannot see it, and asking the server first would put a round trip in front of every
 * open. The first data request is the check instead, and the client reports what it learned:
 *
 * - **lost** — a `401`. Either there was no session at all (`missing`: the proxy found no cookie)
 *   or Sales refused the token (`rejected`: revoked or replaced; tokens do not expire). The
 *   provider takes the surface down, which unmounts every query, and asks the portal for a token.
 * - **confirmed** — a request through the proxy succeeded, so the session works. The provider
 *   tells the portal it needed no token.
 *
 * **Epochs keep a late answer from undoing a new session.** Each stored token starts a new epoch,
 * and every request carries the epoch it was sent in. A `401` from a request sent before the newest
 * token was stored speaks for a session that is already gone, and is ignored.
 *
 * Plain listener sets rather than React context, because the client is not React code.
 *
 * No React in this folder.
 */

/** The guide's wording for a refused token (`src/api.md`, "Getting the token"). */
export const SESSION_EXPIRED_MESSAGE =
	"Your access has ended. Open OMS again from the Fonepoints portal.";

/** Why a request found no working session. Same values as the `oms.auth.renew` reason. */
export type SessionLossReason = "missing" | "rejected";

export interface SessionLoss {
	reason: SessionLossReason;
	/** The epoch the failed request was sent in. */
	epoch: number;
}

let epoch = 0;

/** The current session epoch: the client stamps each request with it. */
export function sessionEpoch(): number {
	return epoch;
}

/** A new token was stored. Requests already in flight now belong to the session before it. */
export function advanceSessionEpoch(): number {
	epoch += 1;
	return epoch;
}

const lostListeners = new Set<(loss: SessionLoss) => void>();
const confirmedListeners = new Set<(epoch: number) => void>();

/** Subscribes to a `401` from the proxy; returns the unsubscribe. */
export function onSessionLost(listener: (loss: SessionLoss) => void): () => void {
	lostListeners.add(listener);
	return () => {
		lostListeners.delete(listener);
	};
}

export function notifySessionLost(loss: SessionLoss): void {
	for (const listener of lostListeners) listener(loss);
}

/** Subscribes to a successful request through the proxy; returns the unsubscribe. */
export function onSessionConfirmed(listener: (epoch: number) => void): () => void {
	confirmedListeners.add(listener);
	return () => {
		confirmedListeners.delete(listener);
	};
}

export function notifySessionConfirmed(requestEpoch: number): void {
	for (const listener of confirmedListeners) listener(requestEpoch);
}
