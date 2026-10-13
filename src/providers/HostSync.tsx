"use client";

import { useEffect } from "react";
import {
	APPEARANCE_THEMES,
	applyAppearance,
	loadAppearance,
	resolveAppearanceTheme,
	type AppearanceTheme,
} from "@/lib/appearance";
import { trace } from "@/lib/debug";
import { asAppearanceTheme, isHostThemeMode } from "@/lib/host";
import { useHostChannel } from "./HostChannelProvider";

/**
 * Keeps the embedded OMS in step with the Fonepoints Business portal that frames it.
 *
 * Mounted only on `/embed/*`. While embedded, the host owns the appearance: the portal pushes
 * `host.theme` when the merchant changes it there, and OMS follows (auth.md section 9).
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
