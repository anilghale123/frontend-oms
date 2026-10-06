import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Order } from "@/lib/domain";
import { cn, formatPhone, initialsOf } from "@/lib/utils";

export interface CustomerCellProps {
	order: Pick<Order, "customerName" | "customerEmail" | "customerPhone" | "customerAvatarUrl">;
}

/**
 * Customer avatar + name + phone (local 10 digits, no +977). Uses the Fonepoints photo when
 * there is one, otherwise initials. Customers without a name show their phone as the main line.
 */
export function CustomerCell({ order }: CustomerCellProps) {
	const { customerName, customerEmail, customerPhone, customerAvatarUrl } = order;
	const name = customerName.trim();
	const phone = formatPhone(customerPhone);

	return (
		<div className="flex min-w-0 items-center gap-2.5">
			<Avatar size="32">
				{customerAvatarUrl && <AvatarImage src={customerAvatarUrl} alt="" />}
				<AvatarFallback>{initialsOf(name, customerEmail)}</AvatarFallback>
			</Avatar>
			<div className="flex min-w-0 flex-col">
				<span className={cn("truncate font-medium text-fg", !name && "tabular-nums")}>
					{name || phone}
				</span>
				<span className={cn("truncate text-xs text-fg-secondary", name && "tabular-nums")}>
					{name ? phone : "No name on file"}
				</span>
			</div>
		</div>
	);
}
