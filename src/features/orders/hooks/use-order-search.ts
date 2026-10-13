import { useEffect, useState } from "react";

/** The Sales service searches encrypted data, so searches are spaced out and kept meaningful. */
const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_MIN_LENGTH = 2;

/**
 * The `q` to send for what is in the search box: settled for 400 ms and at least two characters
 * (`src/api.md`, "Limits"), otherwise `undefined` — no search, the plain list.
 */
export function useOrderSearch(text: string): string | undefined {
	const [settled, setSettled] = useState(text);

	useEffect(() => {
		const timer = setTimeout(() => setSettled(text), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [text]);

	const q = settled.trim();
	return q.length >= SEARCH_MIN_LENGTH ? q : undefined;
}
