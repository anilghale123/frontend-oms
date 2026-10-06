"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { EMBED_HOST_ORIGINS } from "@/config/env";
import { createHostChannel, type HostChannel } from "@/lib/host";

/**
 * One `postMessage` channel to the Fonepoints portal, shared by everything that needs it.
 *
 * Two features now ride the channel — the theme (`HostSync`) and the authentication handoff
 * (`AuthProvider`) — and they must not open a channel each. The handshake is child-driven: OMS
 * posts `oms.ready` and the portal answers. Two channels would mean two `oms.ready` messages and
 * the portal answering twice, with each half of the conversation hearing replies meant for the
 * other.
 *
 * **The ordering here is load-bearing.** `start()` is what posts `oms.ready`, and it runs in this
 * provider's effect. React runs child effects before parent effects, so every consumer has
 * subscribed by the time the announcement goes out — which is what makes it impossible to miss the
 * reply. Moving `start()` into the render body, or into a child, breaks that.
 *
 * Everything is a no-op when OMS is not framed, so mounting this on the standalone dashboard costs
 * nothing.
 */

const HostChannelContext = createContext<HostChannel | null>(null);

export function HostChannelProvider({ children }: { children: ReactNode }) {
	// Created once per mount. `createHostChannel` reads `window.parent`, which is why it is in a
	// lazy initialiser: on the server it simply reports `embedded: false`.
	const [channel] = useState(() => createHostChannel(EMBED_HOST_ORIGINS));

	useEffect(() => channel.start(), [channel]);

	return <HostChannelContext.Provider value={channel}>{children}</HostChannelContext.Provider>;
}

/** The channel, or `null` outside the provider (the rider portal, which never talks to a host). */
export function useHostChannel(): HostChannel | null {
	return useContext(HostChannelContext);
}
