"use client";

import { Button } from "@/components/ui/button";
import { primaryAction, type Order } from "@/lib/domain";
import { useOrderStatusChange } from "../../hooks/use-order-status-change";

export interface OrderStatusActionProps {
	order: Order;
}

/**
 * The one next step for a queue row, from the guide's table: Mark ready while preparing, Assign
 * rider once ready, Mark delivered (confirmed first) while out for delivery. Delivered and failed
 * orders show a dash; their "Change status" menu is on the order detail page.
 */
export function OrderStatusAction({ order }: OrderStatusActionProps) {
	const statusChange = useOrderStatusChange(order);
	const action = primaryAction(order.status);

	if (!action) {
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
