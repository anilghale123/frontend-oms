import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailField } from "@/features/orders";
import type { DeliverySummary } from "@/lib/api/contracts";
import { formatDateTime } from "@/lib/utils/format";

export interface DeliveryConfirmedProps {
	delivery: DeliverySummary;
	onReset: () => void;
}

/** Shown after a successful validation. This is the first point where the rider sees any order
 * details, and only these few. */
export function DeliveryConfirmed({ delivery, onReset }: DeliveryConfirmedProps) {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col items-center gap-3 pt-4 text-center" role="status">
				<span className="flex size-14 items-center justify-center rounded-full bg-success-accent text-success-text">
					<CircleCheck className="size-8" aria-hidden />
				</span>
				<div className="flex flex-col gap-1">
					<h2 className="text-lg font-semibold text-fg">Delivery confirmed</h2>
					<p className="text-sm text-fg-secondary">
						The voucher is redeemed and the order is marked delivered.
					</p>
				</div>
			</div>
			<dl className="grid grid-cols-1 gap-3 rounded-xl border border-border p-4">
				<DetailField label="OMS Order ID">{delivery.omsOrderId}</DetailField>
				{delivery.itemName && <DetailField label="Item">{delivery.itemName}</DetailField>}
				{delivery.recipientName && (
					<DetailField label="Delivered to">{delivery.recipientName}</DetailField>
				)}
				<DetailField label="Confirmed at">{formatDateTime(delivery.deliveredAt)}</DetailField>
			</dl>
			<Button size="48" className="w-full" onClick={onReset}>
				Confirm another delivery
			</Button>
		</div>
	);
}
