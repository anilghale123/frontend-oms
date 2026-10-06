import { ORDER_CATEGORY_LABELS, ORDER_STATUS_LABELS, type Order } from "@/lib/domain";
import { formatDate, formatDateTime } from "@/lib/utils";
import { type ExportTable, exportTable } from "@/lib/utils/export";

/** Field/value sheet for one order, plus its line items. */
export function orderToExport(order: Order): ExportTable {
	const rows: [string, string | number][] = [
		["OMS Order ID", order.omsOrderId],
		["Sales Order ID", order.salesOrderId],
		["Fonepoints reference", order.fonepointsReferenceId],
		["Status", ORDER_STATUS_LABELS[order.status]],
		["Customer", order.customerName],
		["Email", order.customerEmail],
		["Phone", order.customerPhone],
		["Customer location", order.customerLocation],
		["Category", ORDER_CATEGORY_LABELS[order.category]],
		["Points", order.orderValue],
		["Cash (Rs)", order.cashAmount],
		["Value type", order.valueType === "points" ? "Points" : "Points + cash"],
		["Delivery name", order.delivery.name],
		["Delivery phone", order.delivery.phone],
		["Delivery location", order.delivery.address],
		["Delivery date", formatDate(order.deliveryDate)],
		["Note", order.delivery.note],
		["Remarks", order.delivery.remarks],
		["Created", formatDateTime(order.createdAt)],
		["Rider", order.rider ? `${order.rider.name} (${order.rider.vehicleNumber})` : ""],
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
