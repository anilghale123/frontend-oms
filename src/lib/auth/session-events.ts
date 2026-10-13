/**
 * "The token stopped working" — raised by the fetch client, heard by `AuthProvider`.
 *
 * Tokens do not expire, but Providhy can revoke or replace them, and the Sales service then
 * answers `401`. `src/api.md` asks for one response to it: say access has ended, and stop calling
 * the API. The client cannot do the first and should not decide the second for every screen, so it
 * only announces the `401`; the provider takes the surface down, which unmounts every query along
 * with it, and asks the portal for a new token.
 *
 * A plain listener set rather than React context, because the client is not React code.
 *
 * No React in this folder.
 */

/** The guide's wording for a refused token (`src/api.md`, "Getting the token"). */
export const SESSION_EXPIRED_MESSAGE =
	"Your access has ended. Open OMS again from the Fonepoints portal.";

type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribes to a refused token; returns the unsubscribe. */
export function onSessionExpired(listener: Listener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function notifySessionExpired(): void {
	for (const listener of listeners) listener();
}
