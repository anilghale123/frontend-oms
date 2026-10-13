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
	/** Strong primary when it is the only action (final statuses); outline beside a primary. */
	prominent?: boolean;
}

/**
 * "Change status": every status except the current one (`src/api.md` — "offer every other status
 * in a Change status menu"). The server accepts any move, so this is how a merchant corrects a
 * mistake, including on a delivered or failed order. Delivering opens Assign rider instead of
 * changing the status directly, so the rider is recorded.
 */
export function OrderStatusMenu({ status, onSelect, disabled, prominent }: OrderStatusMenuProps) {
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
				{otherStatuses(status).map((to) => (
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
