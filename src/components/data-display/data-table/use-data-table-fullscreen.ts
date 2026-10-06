"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Full-screen toggle for a table card (Meat-Management pattern). Escape exits, and page
 * scrolling is locked while the table covers the viewport.
 */
export function useDataTableFullscreen() {
	const [isFullscreen, setIsFullscreen] = useState(false);
	const toggleFullscreen = useCallback(() => setIsFullscreen((current) => !current), []);

	useEffect(() => {
		if (!isFullscreen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setIsFullscreen(false);
		};
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [isFullscreen]);

	return { isFullscreen, setIsFullscreen, toggleFullscreen };
}

/** Classes that pin the table card over the whole viewport while full screen. */
export function dataTableFullscreenClassName(isFullscreen: boolean) {
	return isFullscreen ? "fixed inset-0 z-50 flex flex-col rounded-none border-0" : undefined;
}
