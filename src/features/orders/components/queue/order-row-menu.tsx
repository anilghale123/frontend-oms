"use client";

import { useRouter } from "next/navigation";
import { Eye, MoreVertical } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Order } from "@/lib/domain";
import { useOrderRoutes } from "../../order-routes";

export interface OrderRowMenuProps {
	order: Order;
}

/**
 * A queue row's "More actions" menu (`MoreVertical`). Opening an order happens here, through
 * "View details", and nowhere else: the row itself is not clickable, so a click meant for the row's
 * status button or a stray click while scrolling never leaves the queue.
 *
 * The order's page is prefetched when the menu opens, so its loading state shows the moment
 * "View details" is chosen. It navigates rather than being a link: opened in a new tab, an embedded
 * page would land outside the portal.
 */
export function OrderRowMenu({ order }: OrderRowMenuProps) {
	const router = useRouter();
	const orderRoutes = useOrderRoutes();
	const href = orderRoutes.detail(order.referenceId);

	return (
		<DropdownMenu onOpenChange={(open) => open && router.prefetch(href)}>
			<DropdownMenuTrigger asChild>
				<IconButton
					variant="ghost"
					color="neutral"
					size="28"
					aria-label={`More actions for ${order.omsOrderId}`}
				>
					<MoreVertical aria-hidden />
				</IconButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{/* Hover and keyboard focus take the accent's soft shade, not the default grey fill. */}
				<DropdownMenuItem
					onSelect={() => router.push(href)}
					className="hover:bg-primary-accent hover:text-primary-text focus:bg-primary-accent focus:text-primary-text hover:[&_svg]:text-primary-text focus:[&_svg]:text-primary-text"
				>
					<Eye aria-hidden />
					View details
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
