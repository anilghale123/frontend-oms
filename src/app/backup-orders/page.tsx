"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { salesGet, useToken } from "./token-context";

type SalesOrder = {
	id?: number | string;
	unique_id?: string;
	order_date?: string;
	customer?: string | { name?: string; full_name?: string };
	grand_total?: number | string;
};

const customerName = (c: SalesOrder["customer"]) =>
	typeof c === "object" && c ? c.name || c.full_name || "" : c || "";

const extractOrders = (payload: any): SalesOrder[] =>
	Array.isArray(payload) ? payload : payload?.results || payload?.data || payload?.orders || [];

export default function Home() {
	const router = useRouter();
	const token = useToken();
	const [orders, setOrders] = useState<SalesOrder[]>([]);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!token) return;
		const controller = new AbortController();
		setLoading(true);
		setError("");
		salesGet("sales/order/search/?q=&status=approved&page=1&count=50", token, controller.signal)
			.then((data) => setOrders(extractOrders(data)))
			.catch((e) => {
				if (e.name !== "AbortError") setError(e.message || "Failed to load");
			})
			.finally(() => setLoading(false));
		return () => controller.abort();
	}, [token]);

	return (
		<main className="p-4 font-sans">
			<h1 className="mb-3 text-lg font-semibold">Sales Orders</h1>

			{!token && <p>Waiting for access token from apps-frontend…</p>}
			{loading && <p>Loading sales orders…</p>}
			{error && <p className="text-red-600">{error}</p>}

			{token && !loading && !error && (
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr className="border-b text-left">
							<th className="py-2">Order No</th>
							<th>Date</th>
							<th>Customer</th>
							<th className="text-right">Total</th>
						</tr>
					</thead>
					<tbody>
						{orders.map((o, i) => (
							<tr
								key={o.id ?? o.unique_id ?? i}
								className="cursor-pointer border-b hover:bg-zinc-100"
								onClick={() => router.push(`/backup-orders/${o.id}`)}
							>
								<td className="py-2">{o.unique_id}</td>
								<td>{o.order_date}</td>
								<td>{customerName(o.customer)}</td>
								<td className="text-right">{o.grand_total}</td>
							</tr>
						))}
						{orders.length === 0 && (
							<tr>
								<td colSpan={4} className="py-4 text-center text-zinc-500">
									No sales orders
								</td>
							</tr>
						)}
					</tbody>
				</table>
			)}
		</main>
	);
}
