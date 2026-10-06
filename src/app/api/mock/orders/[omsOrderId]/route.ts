import { NextResponse } from "next/server";
import { mockError } from "../../_error";
import { db } from "@/lib/mock/db";

/** GET /api/mock/orders/[omsOrderId] — fetch a single order, plus its
 * activity log for the detail view's timeline. */
export async function GET(_request: Request, ctx: RouteContext<"/api/mock/orders/[omsOrderId]">) {
	const { omsOrderId } = await ctx.params;
	const order = db.getOrder(omsOrderId);

	if (!order) {
		return mockError("not_found", "Order not found", 404);
	}

	return NextResponse.json({
		order,
		activity: db.listActivity(omsOrderId),
	});
}
