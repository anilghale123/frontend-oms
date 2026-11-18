"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { goesThroughAssignRider, otherStatuses, type OrderStatus } from "@/lib/domain";
import { StatusBadge } from "../status-badge";

export interface OrderStatusMenuProps {
	status: OrderStatus;
	/** Called with the chosen status; the caller routes it (Assign rider, confirm, or change). */
	onSelect: (to: OrderStatus) => void;
	disabled?: boolean;
	/** Strong primary when it is the only action; outline beside a primary. */
	prominent?: boolean;
}

/**
 * "Change status": the other merchant statuses (Preparing, Ready for delivery, Delivering), in
 * either direction, and Failed (`otherStatuses`). Never Delivered, which the rider and backend set;
 * delivered and failed orders have no menu. While Assign rider is on, Delivering opens it instead of changing the status
 * directly, so the rider is recorded.
 */
export function OrderStatusMenu({ status, onSelect, disabled, prominent }: OrderStatusMenuProps) {
	const next = otherStatuses(status);
	// Delivered and failed orders are final: nothing to move to, so no menu.
	if (next.length === 0) return null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					size="36"
					variant={prominent ? "strong" : "outline"}
					color={prominent ? "primary" : "neutral"}
					disabled={disabled}
				>
					Change status
					<ChevronDown aria-hidden />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel className="text-xs text-fg-secondary">
					Move this order to
				</DropdownMenuLabel>
				{next.map((to) => (
					<DropdownMenuItem key={to} onSelect={() => onSelect(to)}>
						<StatusBadge status={to} />
						{goesThroughAssignRider(to) && (
							<span className="text-xs text-fg-secondary">Assign rider</span>
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
