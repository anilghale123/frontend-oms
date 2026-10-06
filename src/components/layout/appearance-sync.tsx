"use client";

import { useEffect } from "react";
import {
	APPEARANCE_CHANGE_EVENT,
	applyAppearance,
	hostOwnsAppearance,
	isAppearanceDrafting,
	loadAppearance,
	toggleDarkMode,
} from "@/lib/appearance";

/** Keys typed here belong to the control (text entry, menu typeahead), not to shortcuts. */
function isTypingTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	return Boolean(
		target.closest("input, textarea, select, [role='menu'], [role='listbox'], [role='combobox']"),
	);
}

/**
 * Keeps document theme/font in sync with saved appearance (and system dark mode), and owns
 * the global `D` shortcut that switches between light and dark.
 *
 * Inert on the embedded surface, where the host portal owns mode and accent
 * (`hostOwnsAppearance`). Without that guard there would be two owners: this would apply the
 * merchant's stored appearance on mount, overwriting the theme the host put in the document
 * before paint, and `D` would fight the next `host.theme` message. The stored font still applies
 * there — the boot script sets it before paint, and the host has no opinion on it.
 */
export function AppearanceSync() {
	useEffect(() => {
		const applySaved = () => {
			if (isAppearanceDrafting() || hostOwnsAppearance()) return;
			applyAppearance(loadAppearance());
		};

		applySaved();
		window.addEventListener(APPEARANCE_CHANGE_EVENT, applySaved);

		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onSystemChange = () => {
			if (loadAppearance().mode === "system") applySaved();
		};
		media.addEventListener("change", onSystemChange);

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key.toLowerCase() !== "d" || event.repeat || event.defaultPrevented) return;
			if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
			// The Settings dialog previews a draft appearance; it owns the mode while open. So does
			// the host portal, for the whole embedded surface.
			if (isAppearanceDrafting() || hostOwnsAppearance() || isTypingTarget(event.target)) return;
			event.preventDefault();
			toggleDarkMode();
		};
		window.addEventListener("keydown", onKeyDown);

		return () => {
			window.removeEventListener(APPEARANCE_CHANGE_EVENT, applySaved);
			media.removeEventListener("change", onSystemChange);
			window.removeEventListener("keydown", onKeyDown);
		};
	}, []);

	return null;
}
