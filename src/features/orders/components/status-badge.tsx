import type { BadgeProps } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { type OrderStatus, ORDER_STATUS_LABELS } from "@/lib/domain";

/** Single source for status → Badge color (design-system §6). */
export const ORDER_STATUS_BADGE_COLOR: Record<OrderStatus, NonNullable<BadgeProps["color"]>> = {
	preparing: "info",
	ready_for_delivery: "primary",
	delivering: "warning",
	delivered: "success",
	failed: "error",
};

export interface StatusBadgeProps {
	status: OrderStatus;
	className?: string;
}

/** Soft badge for an OMS order status. Always use this — never pick colors per page. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
	return (
		<Badge variant="soft" size="20" color={ORDER_STATUS_BADGE_COLOR[status]} className={className}>
			{ORDER_STATUS_LABELS[status]}
		</Badge>
	);
}
