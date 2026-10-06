import { NextResponse } from "next/server";
import type { DevVoucherResponse } from "@/lib/api/contracts";
import { db } from "@/lib/mock/db";

/**
 * GET /api/mock/dev/voucher/[omsOrderId] — PROTOTYPE BACKDOOR, dev only. Returns the voucher the
 * customer's QR code would carry, so the rider portal's simulated scanner can "scan" it. The real
 * OMS has no such endpoint: the rider reads the code from the customer's phone.
 * An unknown Order ID gets a made-up code, which then fails like any wrong voucher.
 */
export async function GET(
	_request: Request,
	ctx: RouteContext<"/api/mock/dev/voucher/[omsOrderId]">,
) {
	const omsOrderId = (await ctx.params).omsOrderId.trim().toUpperCase();
	const order = db.getOrder(omsOrderId);
	return NextResponse.json<DevVoucherResponse>({
		voucherCode: order?.voucherCode ?? `VOUCHER-${omsOrderId}`,
	});
}
