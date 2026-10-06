import { NextResponse } from "next/server";
import { mockError } from "../_error";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { ValidateVoucherResponse } from "@/lib/api/contracts";
import {
	VALIDATION_MESSAGES,
	consumesAttempt,
	isValidationBlocked,
	nextAttemptsRemaining,
} from "@/lib/domain";
import { db } from "@/lib/mock/db";
import { validateVoucher } from "@/lib/mock/fonepoints";

const bodySchema = z.object({
	omsOrderId: z.string().trim().min(1).toUpperCase(),
	voucherCode: z.string().trim().min(1).toUpperCase(),
});

/**
 * POST /api/mock/validate — the rider's delivery validation call. Mirrors domain rule 8's four
 * outcomes and rule 9's 5-attempt cap. An unknown Order ID is counted and blocked exactly like a
 * real one and gets the same response as a wrong voucher, so the response never reveals whether
 * the Order ID exists. The rider portal has no login: the Order ID + voucher pair is the credential.
 */
export async function POST(request: Request) {
	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return mockError("invalid_body", "Enter the OMS Order ID and the voucher number", 400);
	}

	const { omsOrderId, voucherCode } = parsed.data;
	const order = db.getOrder(omsOrderId);
	const attemptsBefore = order
		? order.validationAttemptsRemaining
		: db.getUnknownAttempts(omsOrderId);

	if (isValidationBlocked(attemptsBefore)) {
		return NextResponse.json<ValidateVoucherResponse>({
			outcome: "blocked",
			message: VALIDATION_MESSAGES.blocked,
			attemptsRemaining: 0,
		});
	}

	const result = await validateVoucher(omsOrderId, voucherCode);
	const timestamp = new Date().toISOString();

	if (result.outcome === "success" && order) {
		const previousStatus = order.status;
		db.updateOrder(omsOrderId, { status: "delivered", voucherRedeemed: true });
		db.appendActivity({
			id: nanoid(),
			omsOrderId,
			type: "validation_attempt",
			message: "Voucher validated — order marked delivered",
			actor: "rider",
			timestamp,
			metadata: { outcome: result.outcome },
		});
		db.appendActivity({
			id: nanoid(),
			omsOrderId,
			type: "status_changed",
			message: `Status changed from ${previousStatus} to delivered`,
			actor: "system",
			timestamp,
			metadata: { previousStatus, newStatus: "delivered", override: false },
		});
		return NextResponse.json<ValidateVoucherResponse>({
			outcome: "success",
			attemptsRemaining: attemptsBefore,
			delivery: {
				omsOrderId,
				itemName: order.items[0]?.name ?? "",
				recipientName: order.delivery.name || order.customerName,
				deliveredAt: timestamp,
			},
		});
	}

	const outcome = result.outcome === "success" ? "mismatch" : result.outcome;
	const attemptsRemaining = consumesAttempt(outcome)
		? nextAttemptsRemaining(attemptsBefore)
		: attemptsBefore;

	if (order) {
		db.updateOrder(omsOrderId, { validationAttemptsRemaining: attemptsRemaining });
		db.appendActivity({
			id: nanoid(),
			omsOrderId,
			type: "validation_attempt",
			message: `Validation attempt failed: ${outcome}`,
			actor: "rider",
			timestamp,
			metadata: { outcome, attemptsRemaining },
		});
	} else {
		db.setUnknownAttempts(omsOrderId, attemptsRemaining);
	}

	return NextResponse.json<ValidateVoucherResponse>({
		outcome,
		message: VALIDATION_MESSAGES[outcome],
		attemptsRemaining,
	});
}
