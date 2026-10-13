"use client";

import { useEffect } from "react";
import { EMBED_HOST_ORIGINS } from "@/config/env";
import { forgetToken } from "@/lib/auth";
import { trace } from "@/lib/debug";
import { createHostChannel } from "@/lib/host";

/**
 * Portal sign-out, on the OMS side. Rendered by `/embed-signout`.
 *
 * The session cookies are persistent and HttpOnly, and they belong to OMS's site, so the portal
 * cannot delete them itself. When the merchant signs out of the portal, the portal loads this page
 * in a hidden iframe; the page deletes the cookies (`DELETE /api/session`, same origin) and reports
 * `oms.auth.cleared` to the portal, which then removes the frame. Because the cookies are
 * partitioned, an iframe inside the portal reaches exactly the jar the OMS frame uses.
 *
 * Only the portal can trigger it: `next.config.ts` lets only the listed portal origins frame this
 * page, and opened any other way (`window.parent === window`) it does nothing.
 *
 * Like `AuthProvider`, it calls `fetch` directly: `/api/session` is the session boot route, not a
 * data query behind `OMS_API_BASE` (AGENTS.md rule 6, the session exception).
 */
export function EmbedSignOut() {
	useEffect(() => {
		const channel = createHostChannel(EMBED_HOST_ORIGINS);
		if (!channel.embedded) {
			trace(
				"signout",
				"opened outside the portal: doing nothing (only the portal may sign OMS out)",
			);
			return;
		}

		let cancelled = false;
		trace("signout", "step 30 · the portal asked OMS to sign out: DELETE /api/session");
		void fetch("/api/session", { method: "DELETE" })
			.then((res) => {
				forgetToken();
				trace(
					"signout",
					`step 31 · the server answered HTTP ${res.status}${res.ok ? ": cookie deleted" : ""}`,
				);
				// Reported only when the cookies are really gone; otherwise the portal's timeout says so.
				if (res.ok && !cancelled) {
					trace("signout", "step 32 · telling the portal: oms.auth.cleared");
					channel.send({ type: "oms.auth.cleared" });
				}
			})
			.catch((error) => {
				trace("signout", "✖ could not reach OMS's server; the portal will time out", {
					error: String(error),
				});
				// Nothing to report: the portal times out and treats sign-out as unconfirmed.
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return <p className="sr-only">Signing out of OMS…</p>;
}
