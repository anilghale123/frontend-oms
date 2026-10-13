"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { EMBED_BASE_PATH } from "@/config/constants";
import {
	APPEARANCE_THEMES,
	applyAppearance,
	loadAppearance,
	resolveAppearanceTheme,
	type AppearanceTheme,
} from "@/lib/appearance";
import { trace } from "@/lib/debug";
import { asAppearanceTheme, asHostRoute, isHostThemeMode } from "@/lib/host";
import { useHostChannel } from "./HostChannelProvider";

/**
 * Keeps the embedded OMS in step with the Fonepoints Business portal that frames it.
 *
 * Mounted only on `/embed/*`. While embedded, the host owns the appearance: the portal pushes
 * `host.theme` when the merchant changes it there, and OMS follows (auth.md section 9).
 *
 * The portal also keeps the OMS frame alive while the merchant visits its other pages, and says
 * `host.visible` when they come back. Nothing was refetched while OMS was hidden, so the screen on
 * show refreshes whatever has gone stale (older than the 30-second `staleTime`). Only stale
 * queries: a merchant flicking between pages should not spend the Sales rate limit.
 *
 * With it the portal sends `host.route.request { path: "/orders" }`: coming back through the
 * portal's OMS link opens the order queue, as any portal section opens on its landing page, even
 * if the merchant had left OMS on an order. The navigation replaces the history entry rather than
 * adding one, so the browser's back button is not left stepping through OMS screens the merchant
 * never chose. Only order screens are accepted (`asHostRoute`).
 *
 * The theme is applied **transiently** — `applyAppearance`, never `saveAppearance`. Persisting
 * the host's choice would make it stick the next time the merchant opens OMS standalone, and
 * would fire `APPEARANCE_CHANGE_EVENT` for a change the user never made. The corollary is that
 * the appearance panel is hidden on the embedded surface: a control the next host message
 * overwrites is worse than no control.
 *
 * The channel comes from `HostChannelProvider` rather than being created here. It used to own one,
 * which was fine while the theme was the only thing on the wire; now that the authentication
 * handoff shares it, a second channel would mean a second `oms.ready` and the portal answering
 * twice.
 *
 * Renders nothing, and does nothing at all when OMS is not framed.
 */
export function HostSync() {
	const channel = useHostChannel();
	const queryClient = useQueryClient();
	const router = useRouter();
	const pathname = usePathname();

	useEffect(() => {
		if (!channel?.embedded) return;

		return channel.on("host.route.request", ({ path }) => {
			const route = asHostRoute(path);
			if (!route) {
				trace("host", "host.route.request ignored: not an order screen", { path });
				return;
			}
			const target = `${EMBED_BASE_PATH}${route}`;
			if (target === pathname) return;
			trace("host", `the portal opens ${target}`);
			router.replace(target);
		});
	}, [channel, router, pathname]);

	useEffect(() => {
		if (!channel?.embedded) return;

		return channel.on("host.visible", () => {
			trace("host", "the portal shows OMS again: refreshing what is stale on screen");
			void queryClient.refetchQueries({ type: "active", stale: true });
		});
	}, [channel, queryClient]);

	useEffect(() => {
		if (!channel?.embedded) return;

		return channel.on("host.theme", ({ mode, accent }) => {
			if (!isHostThemeMode(mode)) {
				trace("host", "step 5 · host.theme ignored: unknown mode", { mode });
				return;
			}

			// `loadAppearance` is the stored preference, so the font the merchant picked survives a
			// host theme push; only the mode and accent come from the host.
			const current = loadAppearance();
			const hostAccent = asAppearanceTheme(
				accent,
				APPEARANCE_THEMES as readonly { id: AppearanceTheme }[],
			);

			trace("host", "step 5 · applying the portal's theme (not saved)", {
				mode,
				accent: hostAccent ?? `ignored unknown accent "${String(accent)}"`,
			});
			applyAppearance({
				...current,
				mode,
				theme: hostAccent ? resolveAppearanceTheme(hostAccent) : current.theme,
			});
		});
	}, [channel]);

	return null;
}
