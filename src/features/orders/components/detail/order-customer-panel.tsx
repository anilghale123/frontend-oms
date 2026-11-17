import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { OrderCustomer } from "@/lib/domain";
import { formatPhone, initialsOf } from "@/lib/utils";
import { DetailField, EmptyValue } from "../detail-field";

export interface OrderCustomerDetailsProps {
	customer: OrderCustomer;
}

/**
 * Customer section body: the customer's name and phone, then what they filled in on the redeem
 * form (`customer.formData`, labels as the partner sent them), then the partner's customer ID and
 * any other attributes it included. Read-only.
 *
 * Form answers that repeat the name or phone already shown at the top are left out of the list,
 * so the section doesn't say the same thing twice. A blank answer reads "Not provided".
 */
export function OrderCustomerDetails({ customer }: OrderCustomerDetailsProps) {
	const shown = new Set([customer.name, customer.contact].filter(Boolean));
	const formData = customer.formData.filter((field) => !shown.has(field.value));
	const hasFields = formData.length > 0 || customer.identifier || customer.extra.length > 0;

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
			{hasFields && (
				<dl className="grid gap-3">
					{formData.map((field, index) => (
						<DetailField key={`${field.label}-${index}`} label={field.label}>
							{field.value || <EmptyValue />}
						</DetailField>
					))}
					{customer.identifier && (
						<DetailField label="Customer ID" numeric>
							{customer.identifier}
						</DetailField>
					)}
					{customer.extra.map((field) => (
						<DetailField key={field.label} label={field.label}>
							{field.value}
						</DetailField>
					))}
				</dl>
			)}
		</div>
	);
}
