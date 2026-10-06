"use client";

import type { ReactNode } from "react";
import { Panel } from "@/components/layout";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ActivityLogEntry, Order } from "@/lib/domain";
import { OrderCustomerDetails } from "./order-customer-panel";
import { OrderActivityList } from "./order-fulfillment";
import { OrderRiderDetails } from "./order-rider-panel";

type SectionId = "customer" | "rider" | "activity";

/** Customer is what merchants check most; rider and activity open on demand. */
const DEFAULT_OPEN: SectionId[] = ["customer"];

/** Longer logs scroll inside the section so the page itself doesn't grow. */
const ACTIVITY_SCROLL_AFTER = 5;

export interface OrderSidePanelProps {
	order: Order;
	activity: ActivityLogEntry[];
}

/**
 * Customer, Rider and Activity in one card, each a collapsible section split by a divider
 * (Radian `Accordion`, `open` variant, multiple open at once). A closed section shows a
 * one-line summary on its header so merchants rarely need to open it; an open section gets the
 * same divider under its header as the other cards. Long activity logs scroll inside the section.
 */
export function OrderSidePanel({ order, activity }: OrderSidePanelProps) {
	const eventCount = activity.length;

	return (
		<Panel flush>
			<Accordion variant="open" type="multiple" defaultValue={DEFAULT_OPEN}>
				<Section
					value="customer"
					title="Customer"
					summary={order.customerName.trim() || order.customerEmail}
				>
					<OrderCustomerDetails order={order} />
				</Section>
				<Section value="rider" title="Rider" summary={order.rider?.name ?? "Not assigned"}>
					<OrderRiderDetails rider={order.rider} />
				</Section>
				<Section
					value="activity"
					title="Activity"
					summary={`${eventCount} ${eventCount === 1 ? "event" : "events"}`}
				>
					{eventCount > ACTIVITY_SCROLL_AFTER ? (
						<ScrollArea className="-mr-2 h-80 pr-3">
							<OrderActivityList entries={activity} />
						</ScrollArea>
					) : (
						<OrderActivityList entries={activity} />
					)}
				</Section>
			</Accordion>
		</Panel>
	);
}

function Section({
	value,
	title,
	summary,
	children,
}: {
	value: SectionId;
	title: string;
	/** Shown on the header row while the section is closed. */
	summary: string;
	children: ReactNode;
}) {
	return (
		<AccordionItem value={value} className="border-border">
			<AccordionTrigger className="group min-h-12 gap-2 px-4 py-3 hover:bg-fill1-alpha data-[state=open]:border-b data-[state=open]:border-border">
				<span className="text-sm font-semibold tracking-tight text-fg">{title}</span>
				<span className="ml-auto min-w-0 truncate text-xs font-normal text-fg-secondary group-data-[state=open]:hidden">
					{summary}
				</span>
			</AccordionTrigger>
			<AccordionContent className="p-4">{children}</AccordionContent>
		</AccordionItem>
	);
}
