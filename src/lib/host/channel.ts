/**
 * The OMS side of the host channel: one validated `postMessage` conversation with the portal
 * that frames us.
 *
 * Everything here is a no-op when OMS is not framed, so the standalone dashboard and the rider
 * portal are unaffected by simply mounting it.
 *
 * When authentication lands, `requestGrant` is built on this channel rather than beside it — the
 * grant travels over the same envelope as the theme (auth.md sections 7.3 and 8).
 *
 * No React in this folder.
 */

import {
	HOST_SOURCE,
	OMS_SOURCE,
	PROTOCOL_VERSION,
	isHostMessage,
	type HostMessage,
	type HostToOms,
	type OmsToHost,
} from "./messages";

type Handler<T extends HostToOms["type"]> = (
	message: Extract<HostToOms, { type: T }>,
	origin: string,
) => void;

/**
 * How handlers are stored, with the message type erased.
 *
 * A `Handler<"host.theme">` is not assignable to a handler of the whole union — function
 * parameters are contravariant, so the compiler is right to refuse. The erasure is sound anyway
 * because the map is keyed by `type` and `dispatch` only ever calls the handlers filed under the
 * message's own type. The cast is confined to `on`.
 */
type StoredHandler = (message: HostMessage, origin: string) => void;

export interface HostChannel {
	/** False when OMS is not framed; every other method is then a no-op. */
	readonly embedded: boolean;
	/** Attaches the window listener and announces `oms.ready`. Returns the detach function. */
	start(): () => void;
	/** Sends one message to the parent, targeted at its exact origin. */
	send(message: OmsToHost): void;
	/** Subscribes to one message type. Returns an unsubscribe function. */
	on<T extends HostToOms["type"]>(type: T, handler: Handler<T>): () => void;
}

/**
 * `allowedOrigins` is `NEXT_PUBLIC_EMBED_HOST_ORIGINS` — the same list `next.config.ts` uses for
 * `frame-ancestors`. One list answers both halves of the trust decision: who may frame OMS, and
 * whose messages OMS will read.
 */
export function createHostChannel(allowedOrigins: readonly string[]): HostChannel {
	const handlers = new Map<string, Set<StoredHandler>>();

	// `window.parent === window` in a top-level page. Guarded here rather than at every call site.
	const embedded = typeof window !== "undefined" && window.parent !== window;

	/**
	 * The parent's origin is not known until it speaks, so the first validated message records
	 * it. Replies then target that exact origin instead of a wildcard (auth.md section 12,
	 * rule 2).
	 */
	let parentOrigin: string | null = null;

	function send(message: OmsToHost) {
		if (!embedded) return;
		// Before the host has spoken, `oms.ready` has to go to each candidate separately: a
		// wildcard target would hand the message to whatever origin happens to hold the frame.
		const targets = parentOrigin ? [parentOrigin] : allowedOrigins;
		for (const target of targets) {
			try {
				window.parent.postMessage({ source: OMS_SOURCE, v: PROTOCOL_VERSION, ...message }, target);
			} catch {
				// A mismatched target origin throws rather than delivering. Expected while probing
				// the candidate list, so the remaining targets still get a turn.
			}
		}
	}

	function dispatch(message: HostMessage, origin: string) {
		const forType = handlers.get(message.type);
		if (!forType) return;
		// Copied first, so a handler that unsubscribes during dispatch cannot mutate the set
		// being iterated.
		for (const handler of [...forType]) handler(message, origin);
	}

	function start() {
		if (!embedded) return () => {};

		const onMessage = (event: MessageEvent) => {
			// All three checks are required, and dropping any one of them turns this channel into
			// an injection point (auth.md section 12, rule 3).
			if (!allowedOrigins.includes(event.origin)) return;
			if (event.source !== window.parent) return;
			if (!isHostMessage(event.data)) return;

			parentOrigin = event.origin;
			dispatch(event.data, event.origin);
		};

		window.addEventListener("message", onMessage);
		// The child drives the handshake: the parent cannot know when our JS ran, so it waits for
		// this and answers (auth.md section 8, handshake invariants).
		send({ type: "oms.ready" });

		return () => window.removeEventListener("message", onMessage);
	}

	function on<T extends HostToOms["type"]>(type: T, handler: Handler<T>) {
		const stored = handler as unknown as StoredHandler;
		const forType = handlers.get(type) ?? new Set<StoredHandler>();
		forType.add(stored);
		handlers.set(type, forType);
		return () => {
			forType.delete(stored);
		};
	}

	return { embedded, start, send, on };
}

export { HOST_SOURCE, OMS_SOURCE, PROTOCOL_VERSION };
