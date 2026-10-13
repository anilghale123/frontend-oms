import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/layout";
import type { Order } from "@/lib/domain";
import { formatDate } from "@/lib/utils";
import { DetailField, EmptyValue } from "../detail-field";

export interface OrderDeliveryPanelProps {
	order: Pick<Order, "deliveryDate" | "delivery">;
}

/**
 * Delivery details card: what the customer typed on the Fonepoints redeem form when ordering.
 * Name and number can differ from the profile in the Customer card. Read-only.
 */
export function OrderDeliveryPanel({ order }: OrderDeliveryPanelProps) {
	const { delivery } = order;

	return (
		<Panel flush>
			<PanelHeader>
				<PanelTitle>Delivery details</PanelTitle>
			</PanelHeader>
			<PanelContent>
				<dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
					<DetailField label="Name">{delivery.name || <EmptyValue />}</DetailField>
					<DetailField label="Phone" numeric>
						{delivery.phone || <EmptyValue />}
					</DetailField>
					<DetailField label="Delivery date" numeric>
						{formatDate(order.deliveryDate)}
					</DetailField>
					<DetailField label="Location" wide>
						{delivery.address || <EmptyValue />}
					</DetailField>
					<DetailField label="Note" wide>
						{delivery.note || <EmptyValue />}
					</DetailField>
					<DetailField label="Remarks" wide>
						{delivery.remarks || <EmptyValue />}
					</DetailField>
				</dl>
			</PanelContent>
		</Panel>
	);
}
