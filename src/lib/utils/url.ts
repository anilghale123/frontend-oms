/**
 * A URL path segment, decoded — or as it is when it cannot be. `decodeURIComponent` throws on a
 * malformed escape such as a lone `%`, and a typed or truncated address would otherwise take down
 * the screen reading it. Keep pure — no React.
 */
export function decodePathSegment(segment: string): string {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}
