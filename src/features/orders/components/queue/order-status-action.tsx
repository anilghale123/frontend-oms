"use client";

import { Button } from "@/components/ui/button";
import { primaryAction, type Order } from "@/lib/domain";
import { useOrderStatusChange } from "../../hooks/use-order-status-change";

export interface OrderStatusActionProps {
	order: Order;
}

/**
 * The one next step for a queue row, from `primaryAction`: Mark ready while preparing, then Mark
 * delivered (confirmed first) — from ready for delivery while Delivering is off
 * (`DELIVERING_ENABLED`), from out for delivery otherwise. Delivered and failed orders show a
 * dash; their "Change status" menu is on the order detail page.
 *
 * Assign rider is never offered in this column (`action.kind === "assign_rider"` below). Remove
 * that check to bring it back.
 */
export function OrderStatusAction({ order }: OrderStatusActionProps) {
	const statusChange = useOrderStatusChange(order);
	const action = primaryAction(order.status);

	if (!action || action.kind === "assign_rider") {
		return (
			<span className="block text-center text-fg-tertiary">
				<span aria-hidden>—</span>
				<span className="sr-only">No action</span>
			</span>
		);
	}

	return (
		<>
			<Button
				size="28"
				variant="outline"
				color="neutral"
				loading={statusChange.pending}
				onClick={() => statusChange.run(action)}
			>
				{action.label}
			</Button>
			{statusChange.dialogs}
		</>
	);
}
