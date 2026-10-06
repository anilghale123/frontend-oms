import { NextResponse } from "next/server";
import { mockError } from "../../../_error";
import { nanoid } from "nanoid";
import { db } from "@/lib/mock/db";
import type { RiderDetails } from "@/lib/domain/types";

/** PATCH /api/mock/orders/[omsOrderId]/rider — assign rider details.
 * Name, phone, and vehicle number are all mandatory (domain rule 6). */
export async function PATCH(
	request: Request,
	ctx: RouteContext<"/api/mock/orders/[omsOrderId]/rider">,
) {
	const { omsOrderId } = await ctx.params;
	const rider = (await request.json()) as RiderDetails;

	const order = db.getOrder(omsOrderId);
	if (!order) {
		return mockError("not_found", "Order not found", 404);
	}

	if (!rider.name || !rider.phone || !rider.vehicleNumber) {
		return mockError(
			"rider_required",
			"Rider name, phone, and vehicle number are all required",
			400,
		);
	}

	const updated = db.updateOrder(omsOrderId, { rider });

	db.appendActivity({
		id: nanoid(),
		omsOrderId,
		type: "rider_assigned",
		message: `Rider ${rider.name} assigned`,
		actor: "merchant",
		timestamp: new Date().toISOString(),
	});

	return NextResponse.json(updated);
}
