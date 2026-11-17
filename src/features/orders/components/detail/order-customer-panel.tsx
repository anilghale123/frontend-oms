import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { OrderCustomer } from "@/lib/domain";
import { formatPhone, initialsOf } from "@/lib/utils";
import { DetailField, EmptyValue } from "../detail-field";

export interface OrderCustomerDetailsProps {
	customer: OrderCustomer;
}

/**
 * Customer section body. The redeem form (`customer.formData`) is the source: whatever the partner
 * sent, including name and phone, is shown as label/value rows in the order sent, labels as sent.
 * Nothing is guessed, renamed or filtered, and a blank answer reads "Not provided".
 *
 * Only when the API sent no form data does it fall back to the avatar with name and phone, the
 * partner's customer ID and any other attributes. Read-only.
 */
export function OrderCustomerDetails({ customer }: OrderCustomerDetailsProps) {
	if (customer.formData.length > 0) {
		return (
			<dl className="grid gap-3">
				{customer.formData.map((field, index) => (
					<DetailField key={`${field.label}-${index}`} label={field.label}>
						{field.value || <EmptyValue />}
					</DetailField>
				))}
			</dl>
		);
	}

	const hasFields = customer.identifier || customer.extra.length > 0;

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
