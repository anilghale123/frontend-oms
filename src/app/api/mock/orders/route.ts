import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/mock/db";
import { MAX_VALIDATION_ATTEMPTS, type Order } from "@/lib/domain/types";

/** GET /api/mock/orders — list orders, optionally scoped to a merchant
 * (domain rule 14: merchants see only their own orders). */
export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const merchantId = searchParams.get("merchantId") ?? undefined;
	const orders = db.listOrders(merchantId ? { merchantId } : undefined);
	return NextResponse.json(orders);
}

interface CreateOrderBody {
	salesOrderId: string;
	fonepointsReferenceId: string;
	merchantId: string;
	customerName: string;
	customerEmail?: string;
	customerAvatarUrl?: string | null;
	customerPhone?: string;
	customerLocation?: string;
	category?: Order["category"];
	location?: string;
	deliveryDate?: string;
	delivery?: Partial<Order["delivery"]>;
	voucherCode: string;
	items?: Order["items"];
	orderValue?: number;
	cashAmount?: number;
	valueType?: Order["valueType"];
}

/**
 * POST /api/mock/orders — create an order. The Fonepoints reference ID is
 * the idempotency key: a repeat request with the same reference returns
 * the existing OMS Order ID and never creates a second order
 * (domain rule 3). New orders start in `preparing` (domain rule 5).
 */
export async function POST(request: Request) {
	const body = (await request.json()) as CreateOrderBody;

	const existing = db.findByReferenceId(body.fonepointsReferenceId);
	if (existing) {
		return NextResponse.json(existing, { status: 200 });
	}

	const now = new Date().toISOString();
	const order: Order = {
		omsOrderId: `OMS-${nanoid(8).toUpperCase()}`,
		salesOrderId: body.salesOrderId,
		fonepointsReferenceId: body.fonepointsReferenceId,
		merchantId: body.merchantId,
		customerName: body.customerName,
		customerEmail: body.customerEmail ?? "",
		customerAvatarUrl: body.customerAvatarUrl ?? null,
		customerPhone: body.customerPhone ?? "",
		category: body.category ?? "restaurants",
		location: body.location ?? "",
		deliveryDate: body.deliveryDate ?? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
		customerLocation: body.customerLocation ?? "",
		delivery: {
			name: body.delivery?.name ?? body.customerName,
			phone: body.delivery?.phone ?? body.customerPhone ?? "",
			address: body.delivery?.address ?? body.location ?? "",
			note: body.delivery?.note ?? "",
			remarks: body.delivery?.remarks ?? "",
		},
		voucherCode: body.voucherCode,
		items: body.items ?? [
			{ name: "Redeemed item", quantity: 1, imageUrl: null, marketPrice: null },
		],
		orderValue: body.orderValue ?? 0,
		cashAmount: body.cashAmount ?? 0,
		valueType: body.valueType ?? "points",
		status: "preparing",
		rider: null,
		validationAttemptsRemaining: MAX_VALIDATION_ATTEMPTS,
		voucherRedeemed: false,
		pendingStatusSync: false,
		createdAt: now,
		updatedAt: now,
	};
	db.createOrder(order);
	db.appendActivity({
		id: nanoid(),
		omsOrderId: order.omsOrderId,
		type: "order_created",
		message: `Order created from Sales Order ${order.salesOrderId}`,
		actor: "system",
		timestamp: now,
	});

	return NextResponse.json(order, { status: 201 });
}
