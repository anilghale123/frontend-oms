import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { OrderCustomer } from "@/lib/domain";
import { formatPhone, initialsOf } from "@/lib/utils";
import { DetailField, EmptyValue } from "../detail-field";

export interface OrderCustomerDetailsProps {
	customer: OrderCustomer;
}

/**
 * Customer section body: what the partner sent about the customer — name, phone, the partner's
 * customer ID, and any other attributes it included. Read-only.
 */
export function OrderCustomerDetails({ customer }: OrderCustomerDetailsProps) {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex min-w-0 items-center gap-3">
				<Avatar size="40">
					<AvatarFallback>{initialsOf(customer.name, customer.identifier)}</AvatarFallback>
				</Avatar>
				<div className="flex min-w-0 flex-col">
					<span className="truncate text-sm font-medium text-fg">
						{customer.name || <EmptyValue>No name on file</EmptyValue>}
					</span>
					<span className="truncate text-xs text-fg-secondary tabular-nums">
						{formatPhone(customer.contact) || <EmptyValue>No phone on file</EmptyValue>}
					</span>
				</div>
			</div>
			<dl className="grid gap-3">
				<DetailField label="Customer ID" numeric>
					{customer.identifier || <EmptyValue />}
				</DetailField>
				{customer.extra.map((field) => (
					<DetailField key={field.label} label={field.label}>
						{field.value}
					</DetailField>
				))}
			</dl>
		</div>
	);
}
