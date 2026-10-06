import { NextResponse } from "next/server";
import { mockError } from "../../../_error";
import { nanoid } from "nanoid";
import { db } from "@/lib/mock/db";
import { canTransition } from "@/lib/domain/status";
import type { OrderStatus } from "@/lib/domain/types";
import type { MockRole } from "@/config/constants";

/**
 * `actor` and `actorRole` are optional because the real contract no longer carries them: the OMS
 * backend derives the actor from the access token, so `@/lib/api/contracts` sends only the status
 * (see `UpdateOrderStatusRequest`). The mock has no token to read, so it falls back to the
 * merchant the seed data belongs to — enough to keep the activity log readable when the app is
 * pointed back at `/api/mock`.
 */
interface UpdateStatusBody {
	status: OrderStatus;
	actor?: string;
	actorRole?: MockRole;
	/** True for a CS status override, which bypasses the normal transition
	 * rules but still requires permission (domain rule 10). */
	override?: boolean;
}

const ROLES_WITH_OVERRIDE_PERMISSION: MockRole[] = ["cs-agent"];

/** Who the mock attributes a change to when the request does not say. */
const DEFAULT_ACTOR: MockRole = "merchant-a";

/**
 * PATCH /api/mock/orders/[omsOrderId]/status — merchant transitions and CS
 * overrides both go through here, distinguished by `override`.
 */
export async function PATCH(
	request: Request,
	ctx: RouteContext<"/api/mock/orders/[omsOrderId]/status">,
) {
	const { omsOrderId } = await ctx.params;
	const body = (await request.json()) as UpdateStatusBody;
	const actor = body.actor ?? DEFAULT_ACTOR;
	const actorRole = body.actorRole ?? DEFAULT_ACTOR;

	const order = db.getOrder(omsOrderId);
	if (!order) {
		return mockError("not_found", "Order not found", 404);
	}

	// `delivered` happens only through successful rider voucher redemption —
	// no caller, merchant or CS, can set it manually (domain rule 7).
	if (body.status === "delivered") {
		return mockError(
			"invalid_transition",
			"Delivered can only be set by rider voucher redemption",
			400,
		);
	}

	if (body.override) {
		if (!ROLES_WITH_OVERRIDE_PERMISSION.includes(actorRole)) {
			return mockError("forbidden", "This role does not have override permission", 403);
		}
	} else if (!canTransition(order.status, body.status)) {
		return mockError(
			"invalid_transition",
			`Cannot move from ${order.status} to ${body.status}`,
			400,
		);
	}

	// Rider name, phone, and vehicle number are mandatory before
	// `delivering` (domain rule 6).
	if (body.status === "delivering" && !order.rider) {
		return mockError("rider_required", "Assign a rider before moving to delivering", 400);
	}

	const previousStatus = order.status;
	const updated = db.updateOrder(omsOrderId, { status: body.status });

	// CS overrides record actor, previous status, new status, timestamp,
	// and an override flag (domain rule 10).
	db.appendActivity({
		id: nanoid(),
		omsOrderId,
		type: body.override ? "cs_override" : "status_changed",
		message: body.override
			? `${actor} overrode status from ${previousStatus} to ${body.status}`
			: `Status changed from ${previousStatus} to ${body.status}`,
		actor,
		timestamp: new Date().toISOString(),
		metadata: {
			previousStatus,
			newStatus: body.status,
			override: Boolean(body.override),
			actorRole,
		},
	});

	return NextResponse.json(updated);
}
