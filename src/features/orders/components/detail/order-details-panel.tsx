import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/layout";
import type { Order } from "@/lib/domain";
import { DetailField, EmptyValue } from "../detail-field";

export interface OrderDetailsPanelProps {
	order: Pick<Order, "referenceId" | "created" | "customer" | "items">;
}

/**
 * "Delivery details" card: the partner's own order ID (`src/api.md` asks for it as "Partner order ID"),
 * when the order was created, and where it goes. Read-only.
 */
export function OrderDetailsPanel({ order }: OrderDetailsPanelProps) {
	const serviceOnly =
		order.items.length > 0 && order.items.every((item) => item.productType === "service");

	return (
		<Panel flush>
			<PanelHeader>
				<PanelTitle>Delivery details</PanelTitle>
			</PanelHeader>
			<PanelContent>
				<dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
					<DetailField label="Partner order ID" numeric>
						{order.referenceId || <EmptyValue />}
					</DetailField>
					{/* Nepal time, formatted by the server; shown as it is. */}
					<DetailField label="Created" numeric>
						{order.created || <EmptyValue />}
					</DetailField>
					<DetailField label="Delivery address" wide>
						{order.customer.deliveryAddress || (
							<EmptyValue>{serviceOnly ? "Service order, no delivery" : "Not provided"}</EmptyValue>
						)}
					</DetailField>
				</dl>
			</PanelContent>
		</Panel>
	);
}
