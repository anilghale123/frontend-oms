/**
 * The Sales portal API's wire format → the domain `Order`.
 *
 * The one place that deals with snake_case, `{ data }` envelopes and the API's deliberately loose
 * fields, so no screen has to:
 *
 * - `customer_detail.delivery_address` is a string **or** an object — flattened to one line.
 * - `customer_detail` and `rider` carry whatever keys the partner sent. The known ones become
 *   fields; the rest are kept as `extra`, with readable labels, so they can still be shown.
 * - `redeem_points` and `amount` are numbers or `null`; a numeric string is accepted too, since a
 *   decimal field serialised as a string is the usual way that promise gets broken.
 * - Dates are Nepal-time strings the server already formatted, so they pass through untouched.
 *
 * Defensive throughout: a missing or wrongly-typed partner field becomes an empty value, never a
 * crash on a screen. No React code in this folder.
 */

import {
	isOrderStatus,
	type ExtraField,
	type Order,
	type OrderCustomer,
	type OrderItem,
	type OrderLog,
	type OrderRider,
} from "@/lib/domain";
import type {
	OrderListResult,
	PortalList,
	PortalOrder,
	PortalOrderItem,
	PortalOrderLog,
} from "./contracts";

export function toOrder(wire: PortalOrder): Order {
	return {
		omsOrderId: text(wire.order_id),
		referenceId: text(wire.reference_id),
		merchant: wire.merchant_detail
			? {
					id: text(wire.merchant_detail.id),
					name: text(wire.merchant_detail.name),
					contact: text(wire.merchant_detail.contact),
					pan: text(wire.merchant_detail.pan),
				}
			: null,
		customer: toCustomer(wire.customer_detail),
		items: Array.isArray(wire.items) ? wire.items.map(toItem) : [],
		// An unknown status cannot be drawn by `StatusBadge` or the tracker. The API documents five
		// and nothing else; if a sixth ever appears it shows as the start of the flow, not a crash.
		status: isOrderStatus(wire.status) ? wire.status : "preparing",
		valueType: wire.redemption_value_type === "points" ? "points" : "points_money",
		points: numberOrNull(wire.redeem_points),
		amount: numberOrNull(wire.amount),
		rider: toRider(wire.rider),
		logs: Array.isArray(wire.logs) ? wire.logs.flatMap(toLog) : [],
		created: text(wire.created),
	};
}

export function toOrderList(wire: PortalList<PortalOrder>): OrderListResult {
	const orders = Array.isArray(wire.data) ? wire.data.map(toOrder) : [];
	return {
		orders,
		total: typeof wire.count === "number" ? wire.count : orders.length,
		hasNext: Boolean(wire.next),
		hasPrevious: Boolean(wire.previous),
	};
}

const CUSTOMER_KEYS = new Set(["identifier", "name", "contact", "delivery_address"]);

function toCustomer(detail: PortalOrder["customer_detail"]): OrderCustomer {
	const record = isRecord(detail) ? detail : {};
	return {
		identifier: text(record.identifier),
		name: text(record.name),
		contact: text(record.contact),
		deliveryAddress: flattenAddress(record.delivery_address),
		extra: extraFields(record, CUSTOMER_KEYS),
	};
}

const RIDER_NAME_KEYS = ["name", "full_name"];
const RIDER_PHONE_KEYS = ["phone", "contact", "mobile", "phone_number"];

function toRider(rider: PortalOrder["rider"]): OrderRider | null {
	if (!isRecord(rider)) return null;
	const nameKey = RIDER_NAME_KEYS.find((key) => text(rider[key]));
	const phoneKey = RIDER_PHONE_KEYS.find((key) => text(rider[key]));
	const known = new Set([nameKey, phoneKey].filter((key): key is string => Boolean(key)));
	return {
		name: nameKey ? text(rider[nameKey]) : "",
		phone: phoneKey ? text(rider[phoneKey]) : "",
		extra: extraFields(rider, known),
	};
}

function toItem(item: PortalOrderItem): OrderItem {
	const quantity = numberOrNull(item?.qty);
	return {
		productId: text(item?.product_id),
		name: text(item?.name),
		quantity: quantity ?? 1,
		unitName: text(item?.unit_name),
		productType: item?.product_type === "service" ? "service" : "goods",
	};
}

function toLog(log: PortalOrderLog): OrderLog[] {
	if (!isRecord(log) || !isOrderStatus(log.status)) return [];
	return [{ status: log.status, date: text(log.date), remarks: text(log.remarks) }];
}

/** One line from a string or an object address: its non-empty values, in the order sent. */
export function flattenAddress(value: unknown): string {
	if (typeof value === "string") return value.trim();
	if (typeof value === "number") return String(value);
	if (Array.isArray(value)) return value.map(flattenAddress).filter(Boolean).join(", ");
	if (isRecord(value)) {
		return Object.values(value).map(flattenAddress).filter(Boolean).join(", ");
	}
	return "";
}

/** Every primitive value under a key not in `known`, labelled from the key. */
function extraFields(record: Record<string, unknown>, known: Set<string>): ExtraField[] {
	return Object.entries(record).flatMap(([key, value]) => {
		if (known.has(key)) return [];
		const shown = typeof value === "boolean" ? (value ? "Yes" : "No") : flattenAddress(value);
		return shown ? [{ label: humanizeKey(key), value: shown }] : [];
	});
}

/** `vehicle_number` / `vehicleNumber` → "Vehicle number". */
export function humanizeKey(key: string): string {
	const words = key
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.trim()
		.toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

function text(value: unknown): string {
	if (typeof value === "string") return value.trim();
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return "";
}

function numberOrNull(value: unknown): number | null {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
