import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Order } from "@/lib/domain";
import { initialsOf } from "@/lib/utils";
import { DetailField, EmptyValue } from "../detail-field";

export interface OrderCustomerDetailsProps {
	order: Pick<
		Order,
		"customerName" | "customerEmail" | "customerAvatarUrl" | "customerPhone" | "customerLocation"
	>;
}

/**
 * Customer section body: the customer's Fonepoints profile (photo, name, phone, email, location).
 * What they typed when ordering is in the Delivery details card. Read-only.
 */
export function OrderCustomerDetails({ order }: OrderCustomerDetailsProps) {
	const name = order.customerName.trim();

	return (
		<div className="flex flex-col gap-4">
			<div className="flex min-w-0 items-center gap-3">
				<Avatar size="40">
					{order.customerAvatarUrl && <AvatarImage src={order.customerAvatarUrl} alt="" />}
					<AvatarFallback>{initialsOf(name, order.customerEmail)}</AvatarFallback>
				</Avatar>
				<div className="flex min-w-0 flex-col">
					<span className="truncate text-sm font-medium text-fg">
						{name || <EmptyValue>No name on file</EmptyValue>}
					</span>
					<span className="truncate text-xs text-fg-secondary tabular-nums">
						{order.customerPhone || <EmptyValue>No phone on file</EmptyValue>}
					</span>
				</div>
			</div>
			<dl className="grid gap-3">
				<DetailField label="Email">{order.customerEmail || <EmptyValue />}</DetailField>
				<DetailField label="Location">{order.customerLocation || <EmptyValue />}</DetailField>
			</dl>
		</div>
	);
}
