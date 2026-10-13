import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailField } from "@/features/orders";
import type { DeliveryResult } from "../api";

export interface DeliveryConfirmedProps {
	/** The Order ID the rider typed. */
	orderId: string;
	result: DeliveryResult;
	onReset: () => void;
}

/**
 * Shown after a confirmed delivery. This is the first point where the rider sees any order
 * details, and only these few — when the server sends the order back at all.
 */
export function DeliveryConfirmed({ orderId, result, onReset }: DeliveryConfirmedProps) {
	const { order, message } = result;
	const item = order?.items[0];
	const recipient = order?.customer.name;

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col items-center gap-3 pt-4 text-center" role="status">
				<span className="flex size-14 items-center justify-center rounded-full bg-success-accent text-success-text">
					<CircleCheck className="size-8" aria-hidden />
				</span>
				<div className="flex flex-col gap-1">
					<h2 className="text-lg font-semibold text-fg">Delivery confirmed</h2>
					<p className="text-sm text-fg-secondary">
						{message ?? "The voucher is redeemed and the order is marked delivered."}
					</p>
				</div>
			</div>
			<dl className="grid grid-cols-1 gap-3 rounded-xl border border-border p-4">
				<DetailField label="Order ID">{order?.omsOrderId || orderId}</DetailField>
				{item?.name && <DetailField label="Item">{item.name}</DetailField>}
				{recipient && <DetailField label="Delivered to">{recipient}</DetailField>}
			</dl>
			<Button size="48" className="w-full" onClick={onReset}>
				Confirm another delivery
			</Button>
		</div>
	);
}
