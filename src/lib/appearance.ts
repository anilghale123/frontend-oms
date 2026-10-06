import { EMBED_BASE_PATH } from "@/config/constants";

export const APPEARANCE_STORAGE_KEY = "oms-appearance";
export const APPEARANCE_CHANGE_EVENT = "oms-appearance-change";

export const APPEARANCE_MODES = [
	{ id: "light", label: "Light" },
	{ id: "dark", label: "Dark" },
	{ id: "system", label: "System" },
] as const;

export type AppearanceMode = (typeof APPEARANCE_MODES)[number]["id"];

export const APPEARANCE_THEMES = [
	{ id: "gray", label: "Gray (Default)", token: "neutral" },
	{ id: "fonepoints", label: "Fonepoints", token: "fonepoints" },
	{ id: "red", label: "Red", token: "red" },
	{ id: "orange", label: "Orange", token: "orange" },
	{ id: "amber", label: "Amber", token: "amber" },
	{ id: "yellow", label: "Yellow", token: "yellow" },
	{ id: "neon", label: "Neon", token: "neon" },
	{ id: "green", label: "Green", token: "green" },
	{ id: "emerald", label: "Emerald", token: "emerald" },
	{ id: "teal", label: "Teal", token: "teal" },
	{ id: "cyan", label: "Cyan", token: "cyan" },
	{ id: "light-blue", label: "Light Blue", token: "light-blue" },
	{ id: "blue", label: "Blue", token: "blue" },
	{ id: "violet-blue", label: "Violet Blue", token: "violet-blue" },
	{ id: "purple", label: "Purple", token: "purple" },
	{ id: "dark-orchid", label: "Dark Orchid", token: "dark-orchid" },
	{ id: "fuchsia", label: "Fuchsia", token: "fuchsia" },
	{ id: "magenta", label: "Magenta", token: "magenta" },
	{ id: "rose", label: "Rose", token: "rose" },
] as const;

export type AppearanceTheme = (typeof APPEARANCE_THEMES)[number]["id"];

export const APPEARANCE_FONTS = [
	{
		id: "geist",
		label: "Geist",
		description: "Modern product sans — default look",
	},
	{
		id: "inter",
		label: "Inter",
		description: "Clean, highly legible UI typeface",
	},
	{
		id: "roboto",
		label: "Roboto",
		description: "Neutral geometric sans for dense UIs",
	},
] as const;

export type AppearanceFont = (typeof APPEARANCE_FONTS)[number]["id"];

export type Appearance = {
	mode: AppearanceMode;
	theme: AppearanceTheme;
	font: AppearanceFont;
};

/** Matches the current product look until the user saves a preference. */
export const DEFAULT_APPEARANCE: Appearance = {
	mode: "light",
	theme: "violet-blue",
	font: "geist",
};

/** Reset target, matching the reference appearance defaults. */
export const RESET_APPEARANCE: Appearance = {
	mode: "system",
	theme: "gray",
	font: "geist",
};

const THEME_IDS = new Set<string>(APPEARANCE_THEMES.map((theme) => theme.id));
const FONT_IDS = new Set<string>(APPEARANCE_FONTS.map((font) => font.id));
const MODE_IDS = new Set<string>(APPEARANCE_MODES.map((mode) => mode.id));

let drafting = false;

export function setAppearanceDrafting(next: boolean) {
	drafting = next;
}

export function isAppearanceDrafting() {
	return drafting;
}

export function themeById(id: AppearanceTheme) {
	return APPEARANCE_THEMES.find((theme) => theme.id === id) ?? APPEARANCE_THEMES[0];
}

export function fontById(id: AppearanceFont) {
	return APPEARANCE_FONTS.find((font) => font.id === id) ?? APPEARANCE_FONTS[0];
}

function parseAppearance(raw: string | null): Appearance | null {
	if (!raw) return null;
	try {
		const value = JSON.parse(raw) as Partial<Appearance>;
		if (
			!value.mode ||
			!value.theme ||
			!value.font ||
			!MODE_IDS.has(value.mode) ||
			!THEME_IDS.has(value.theme) ||
			!FONT_IDS.has(value.font)
		) {
			return null;
		}
		return {
			mode: value.mode,
			theme: value.theme,
			font: value.font,
		};
	} catch {
		return null;
	}
}

export function loadAppearance(): Appearance {
	if (typeof window === "undefined") return DEFAULT_APPEARANCE;
	return parseAppearance(localStorage.getItem(APPEARANCE_STORAGE_KEY)) ?? DEFAULT_APPEARANCE;
}

/**
 * True when the Fonepoints Business portal, not the merchant, owns mode and accent.
 *
 * On the embedded surface the host pushes `host.theme` and OMS follows (`auth.md` section 9).
 * Something has to decide that, and it cannot be a flag one component sets for another: the root
 * layout's `AppearanceSync` runs its effect before anything inside `/embed` mounts, so a flag
 * would always be read too early. Both facts are available from the environment instead, which
 * makes this a plain function with no coordination and no render side effect.
 *
 * Framed **and** on `/embed/*`: a framed page elsewhere (nothing does this today) still owns its
 * own appearance, because no host is supplying its chrome.
 */
export function hostOwnsAppearance() {
	if (typeof window === "undefined") return false;
	return window.parent !== window && window.location.pathname.startsWith(EMBED_BASE_PATH);
}

export function prefersDark() {
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveDark(mode: AppearanceMode) {
	if (mode === "dark") return true;
	if (mode === "light") return false;
	return prefersDark();
}

export function applyAppearance(appearance: Appearance) {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	root.classList.toggle("dark", resolveDark(appearance.mode));
	root.dataset.theme = appearance.theme;
	if (appearance.font === "geist") {
		delete root.dataset.font;
	} else {
		root.dataset.font = appearance.font;
	}
}

export function saveAppearance(appearance: Appearance) {
	localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
	applyAppearance(appearance);
	window.dispatchEvent(new Event(APPEARANCE_CHANGE_EVENT));
}

/** Flips between light and dark (from "system" too), keeping accent and font. */
export function toggleDarkMode() {
	const current = loadAppearance();
	saveAppearance({ ...current, mode: resolveDark(current.mode) ? "light" : "dark" });
}

/**
 * Pre-paint hint from the host, read by the boot script below.
 *
 * The Fonepoints portal appends `#theme=dark&accent=fonepoints` to the iframe URL so the
 * embedded OMS paints in the host's theme on the very first frame. Without it a dark host shows
 * a light flash, because the authoritative `host.theme` message cannot arrive until after the
 * page has painted (auth.md section 9).
 *
 * A fragment, not a query string: fragments are never sent to a server, so they stay out of
 * access logs and `Referer` headers. It is only a hint — `HostSync` applies the real value
 * moments later, and `loadAppearance` is unaffected, so nothing about the merchant's own stored
 * preference changes.
 */
export const HOST_THEME_HINT_PARAMS = { mode: "theme", accent: "accent" } as const;

/**
 * Runs before paint. Keep in sync with applyAppearance.
 *
 * Order: the merchant's stored preference first, then the host hint on top, because while
 * embedded the host owns the mode and accent. The stored font always wins — the host has no
 * opinion on it.
 */
export const APPEARANCE_BOOT_SCRIPT = `(function(){try{var r=localStorage.getItem("${APPEARANCE_STORAGE_KEY}");var a=r?JSON.parse(r):null;var h=new URLSearchParams(location.hash.slice(1));var hm=h.get("${HOST_THEME_HINT_PARAMS.mode}");var ha=h.get("${HOST_THEME_HINT_PARAMS.accent}");var m=hm==="dark"||hm==="light"?hm:a&&a.mode;var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",!!d);var t=ha&&/^[a-z][a-z-]{1,23}$/.test(ha)?ha:a&&a.theme;if(t)document.documentElement.dataset.theme=t;if(a&&a.font&&a.font!=="geist")document.documentElement.dataset.font=a.font;}catch(e){}})();`;
