import { NextResponse } from "next/server";
import { mockError } from "../../_error";
import type { DevDeliveringOrderResponse } from "@/lib/api/contracts";
import { db } from "@/lib/mock/db";
import { TEST_VOUCHERS } from "@/lib/mock/fonepoints";

/**
 * GET /api/mock/dev/delivering — PROTOTYPE BACKDOOR, dev only. Returns an order that is out for
 * delivery and can still be confirmed, plus the voucher its QR code would carry, so the delivery
 * portal's "Simulate delivery" shortcut can confirm it in one click. The oldest such order comes
 * first. 404 when no order is out for delivery.
 */
export async function GET() {
	const order = db
		.listOrders()
		.filter(
			(o) =>
				o.status === "delivering" &&
				o.validationAttemptsRemaining > 0 &&
				// Skip the seeded order whose redemption is forced to fail.
				o.voucherCode !== TEST_VOUCHERS.redemptionFails,
		)
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
	if (!order) {
		return mockError("no_delivering_order", "No order is out for delivery", 404);
	}
	return NextResponse.json<DevDeliveringOrderResponse>({
		omsOrderId: order.omsOrderId,
		voucherCode: order.voucherCode,
	});
}
