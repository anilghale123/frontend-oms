/**
 * The channel's three validation axes, exercised against a real `window.postMessage`.
 *
 * `messages.test.ts` covers the envelope guard in isolation. This file covers the part that only
 * shows up once a listener is attached: origin, `event.source` and envelope are checked
 * *together*, and dropping any one of them turns the channel into an injection point. That matters
 * more now than it did when the channel only carried a theme — the same messages now carry an
 * access token.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOST_SOURCE, OMS_SOURCE, PROTOCOL_VERSION } from "./messages";
import { createHostChannel } from "./channel";

const ALLOWED = "http://localhost:4200";
const EVIL = "http://evil.example";

/**
 * jsdom reports `window.parent === window`, so the channel would consider itself unframed. A stub
 * parent is what makes `embedded` true; it also records what OMS sends, which is how `oms.ready`
 * is asserted.
 */
function frameWindow() {
	const posted: { message: unknown; target: string }[] = [];
	const parent = {
		postMessage: (message: unknown, target: string) => posted.push({ message, target }),
	};

	vi.spyOn(window, "parent", "get").mockReturnValue(parent as unknown as Window);
	return { parent, posted };
}

/** Delivers a message as the browser would, with the origin and source the channel inspects. */
function deliver(data: unknown, origin: string, source: unknown) {
	const event = new MessageEvent("message", { data, origin });
	// jsdom will not let `source` be an arbitrary object through the constructor.
	Object.defineProperty(event, "source", { value: source });
	window.dispatchEvent(event);
}

const grant = (over: Record<string, unknown> = {}) => ({
	source: HOST_SOURCE,
	v: PROTOCOL_VERSION,
	type: "host.auth.grant",
	token: "oms_at_test",
	expiresAt: "",
	...over,
});

let stop: (() => void) | null = null;

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	stop?.();
	stop = null;
});

describe("createHostChannel", () => {
	it("announces oms.ready to every allowed origin before the host has spoken", () => {
		const { posted } = frameWindow();
		const channel = createHostChannel([ALLOWED, "https://portal.example"]);
		stop = channel.start();

		expect(posted).toHaveLength(2);
		expect(posted[0]!.message).toMatchObject({
			source: OMS_SOURCE,
			v: PROTOCOL_VERSION,
			type: "oms.ready",
		});
		// Never a wildcard: a `*` target would hand the message to whatever origin holds the frame.
		expect(posted.map((entry) => entry.target)).toEqual([ALLOWED, "https://portal.example"]);
	});

	it("delivers a grant from the allowed origin", () => {
		const { parent } = frameWindow();
		const channel = createHostChannel([ALLOWED]);
		const onGrant = vi.fn();
		channel.on("host.auth.grant", onGrant);
		stop = channel.start();

		deliver(grant(), ALLOWED, parent);

		expect(onGrant).toHaveBeenCalledTimes(1);
		expect(onGrant.mock.calls[0]![0]).toMatchObject({ token: "oms_at_test" });
	});

	it("drops a grant from an origin that is not allowed", () => {
		const { parent } = frameWindow();
		const channel = createHostChannel([ALLOWED]);
		const onGrant = vi.fn();
		channel.on("host.auth.grant", onGrant);
		stop = channel.start();

		deliver(grant({ token: "attacker" }), EVIL, parent);

		expect(onGrant).not.toHaveBeenCalled();
	});

	it("drops a grant that did not come from the parent window", () => {
		// The attack this blocks: a nested iframe, or an opened window, on an allowed origin. The
		// origin check alone would accept it.
		frameWindow();
		const channel = createHostChannel([ALLOWED]);
		const onGrant = vi.fn();
		channel.on("host.auth.grant", onGrant);
		stop = channel.start();

		deliver(grant({ token: "attacker" }), ALLOWED, { notTheParent: true });

		expect(onGrant).not.toHaveBeenCalled();
	});

	it("drops a grant on an unknown protocol version", () => {
		const { parent } = frameWindow();
		const channel = createHostChannel([ALLOWED]);
		const onGrant = vi.fn();
		channel.on("host.auth.grant", onGrant);
		stop = channel.start();

		deliver(grant({ v: PROTOCOL_VERSION + 1 }), ALLOWED, parent);

		expect(onGrant).not.toHaveBeenCalled();
	});

	it("targets the host's exact origin once it has spoken", () => {
		const { parent, posted } = frameWindow();
		const channel = createHostChannel([ALLOWED, "https://portal.example"]);
		stop = channel.start();
		posted.length = 0;

		deliver(grant(), ALLOWED, parent);
		channel.send({ type: "oms.auth.ok", merchantId: "merchant-a" });

		// One message to the origin that actually holds the frame, not one per candidate.
		expect(posted).toHaveLength(1);
		expect(posted[0]!.target).toBe(ALLOWED);
	});

	it("does nothing at all when OMS is not framed", () => {
		// The standalone dashboard and the rider portal mount the provider too; everything must be
		// a no-op there rather than a guard at each call site.
		const channel = createHostChannel([ALLOWED]);
		expect(channel.embedded).toBe(false);

		const onGrant = vi.fn();
		channel.on("host.auth.grant", onGrant);
		stop = channel.start();

		deliver(grant(), ALLOWED, window);
		expect(onGrant).not.toHaveBeenCalled();
	});
});
