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
 * (`DELIVERING_ENABLED`), from out for delivery otherwise. Delivered and failed orders show
 * nothing: they are final, and every row has its "More actions" menu.
 *
 * Assign rider is never offered in this column (`action.kind === "assign_rider"` below). Remove
 * that check to bring it back.
 */
export function OrderStatusAction({ order }: OrderStatusActionProps) {
	const statusChange = useOrderStatusChange(order);
	const action = primaryAction(order.status);

	// No button when there is no next step: the row's "More actions" menu is always there, so the
	// cell needs no placeholder.
	if (!action || action.kind === "assign_rider") return null;

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
