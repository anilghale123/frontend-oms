import { ORDER_STATUS_LABELS, type Order } from "@/lib/domain";
import { type ExportTable, exportTable } from "@/lib/utils/export";

/** Field/value sheet for one order, plus its line items. */
export function orderToExport(order: Order): ExportTable {
	const rows: [string, string | number][] = [
		["OMS Order ID", order.omsOrderId],
		["Partner order ID", order.referenceId],
		["Status", ORDER_STATUS_LABELS[order.status]],
		["Customer", order.customer.name],
		["Phone", order.customer.contact],
		["Customer ID", order.customer.identifier],
		["Delivery address", order.customer.deliveryAddress],
		["Points", order.points ?? ""],
		["Cash (Rs)", order.amount ?? ""],
		["Value type", order.valueType === "points" ? "Points" : "Points + cash"],
		["Created", order.created],
		["Rider", order.rider?.name ?? ""],
		["Rider phone", order.rider?.phone ?? ""],
	];
	order.items.forEach((item, index) => {
		rows.push([`Item ${index + 1}`, `${item.quantity} × ${item.name}`]);
	});
	return { headers: ["Field", "Value"], rows };
}

/** Downloads one order as a CSV file named after its OMS Order ID. */
export function downloadOrder(order: Order) {
	exportTable(orderToExport(order), "csv", order.omsOrderId);
}
