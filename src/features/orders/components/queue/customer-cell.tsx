import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { OrderCustomer } from "@/lib/domain";
import { formatPhone, initialsOf } from "@/lib/utils";

export interface CustomerCellProps {
	customer: OrderCustomer;
}

/**
 * Customer initials + name + phone (local 10 digits, no +977). Customers without a name show
 * their phone as the main line.
 */
export function CustomerCell({ customer }: CustomerCellProps) {
	const name = customer.name;
	const phone = formatPhone(customer.contact);

	return (
		<div className="flex min-w-0 items-center gap-2">
			<Avatar size="32">
				<AvatarFallback className="bg-fill2 text-sm leading-5 font-semibold text-ink-avatar">
					{initialsOf(name, customer.identifier)}
				</AvatarFallback>
			</Avatar>
			<div className="flex min-w-0 flex-col">
				<span className="truncate text-sm leading-5 font-bold text-ink">
					{name || phone || customer.identifier || "—"}
				</span>
				<span className="truncate text-sm leading-5 font-semibold text-ink-secondary">
					{name ? phone || customer.identifier : "No name on file"}
				</span>
			</div>
		</div>
	);
}
