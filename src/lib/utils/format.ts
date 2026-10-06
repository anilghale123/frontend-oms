/**
 * Small formatting helpers for OMS screens. Keep pure — no React.
 */

import { format, parseISO } from "date-fns";

/** Formats an ISO timestamp for table / detail display. */
export function formatDateTime(iso: string): string {
	try {
		return format(parseISO(iso), "dd MMM yyyy, HH:mm");
	} catch {
		return iso;
	}
}

const wholeNumber = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Formats a Rs amount the way the Fonepoints app does, e.g. "Rs 1,923". */
export function formatRs(amount: number): string {
	return `Rs ${wholeNumber.format(amount)}`;
}

/** Formats a redeemed value like the Fonepoints app: "Rs 1,923 + 174 pts", or "174 pts". */
export function formatOrderValue(order: { orderValue: number; cashAmount: number }): string {
	const points = `${wholeNumber.format(order.orderValue)} pts`;
	return order.cashAmount > 0 ? `${formatRs(order.cashAmount)} + ${points}` : points;
}

/** Formats an ISO timestamp as a date only, e.g. "28 Sep 2026". */
export function formatDate(iso: string): string {
	try {
		return format(parseISO(iso), "dd MMM yyyy");
	} catch {
		return iso;
	}
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
