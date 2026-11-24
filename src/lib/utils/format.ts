/**
 * Small formatting helpers for OMS screens. Keep pure — no React.
 *
 * There are no date formatters: the Sales API sends dates already formatted in Nepal time, and the
 * screens show them as sent.
 */

const wholeNumber = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const money = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** Formats a Rs amount the way the Fonepoints app does, e.g. "Rs 1,923" or "Rs 99.5". */
export function formatRs(amount: number): string {
	return `Rs ${money.format(amount)}`;
}

/** Formats points, e.g. "1,000 pts". */
export function formatPoints(points: number): string {
	return `${wholeNumber.format(points)} pts`;
}

/**
 * Formats a redeemed value like the Fonepoints app: "Rs 100 + 1,000 pts", or "1,000 pts".
 * Either part may be missing (the API sends `null`); with neither, a dash.
 */
export function formatOrderValue(order: { points: number | null; amount: number | null }): string {
	const parts: string[] = [];
	if (order.amount !== null && order.amount > 0) parts.push(formatRs(order.amount));
	if (order.points !== null) parts.push(formatPoints(order.points));
	return parts.join(" + ") || "—";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Splits the server's Nepal-time stamp ("2026-10-04 10:42:07") into "04 Oct 2026" and "10:42" for
 * the queue. Only the text is rearranged, so no time zone is applied. A stamp in any other shape
 * comes back whole as `date`, with no `time`.
 */
export function splitOrderDate(stamp: string): { date: string; time: string } {
	const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(stamp.trim());
	const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
	if (!match || !month) return { date: stamp, time: "" };
	return { date: `${match[3]} ${month} ${match[1]}`, time: `${match[4]}:${match[5]}` };
}

/** Up to two initials from a name, falling back to the first letter of `fallback`. */
export function initialsOf(name: string, fallback = "?"): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return (fallback.trim()[0] ?? "?").toUpperCase();
	const first = words[0][0];
	const last = words.length > 1 ? words[words.length - 1][0] : "";
	return (first + last).toUpperCase();
}

/** Local 10-digit mobile number, e.g. "+977 984 123 4567" → "9841234567". */
export function formatPhone(phone: string): string {
	const digits = phone.replace(/\D/g, "");
	return digits.length > 10 && digits.startsWith("977") ? digits.slice(3) : digits;
}
