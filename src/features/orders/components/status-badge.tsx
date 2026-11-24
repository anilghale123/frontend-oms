import type { BadgeProps } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { type OrderStatus, ORDER_STATUS_LABELS } from "@/lib/domain";
import { cn } from "@/lib/utils";

/** Single source for status → Badge color (design-system §6). */
export const ORDER_STATUS_BADGE_COLOR: Record<OrderStatus, NonNullable<BadgeProps["color"]>> = {
	preparing: "info",
	ready_for_delivery: "primary",
	delivering: "warning",
	delivered: "success",
	failed: "error",
};

/** Badge fill and text color per status (listing spec). Failed keeps the error text of its badge color. */
const ORDER_STATUS_TEXT_CLASS: Record<OrderStatus, string> = {
	preparing: "bg-status-preparing-bg text-status-preparing",
	ready_for_delivery: "bg-status-ready-bg text-status-ready",
	delivering: "bg-status-delivering-bg text-status-delivering",
	delivered: "bg-status-delivered-bg text-status-delivered",
	failed: "",
};

export interface StatusBadgeProps {
	status: OrderStatus;
	className?: string;
}

/** Soft badge for an OMS order status. Always use this — never pick colors per page. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
	return (
		<Badge
			variant="soft"
			size="20"
			color={ORDER_STATUS_BADGE_COLOR[status]}
			className={cn(
				"justify-center border-transparent px-1 py-0.5 text-xs leading-4 font-semibold",
				ORDER_STATUS_TEXT_CLASS[status],
				className,
			)}
		>
			{ORDER_STATUS_LABELS[status]}
		</Badge>
	);
}
