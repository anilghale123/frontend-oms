"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { salesGet, salesPost, useToken } from "../token-context";

type Detail = {
	status?: string;
	unique_id?: string;
	[key: string]: unknown;
};

const isPrimitive = (v: unknown) =>
	v === null || ["string", "number", "boolean"].includes(typeof v);

const label = (key: string) => key.replace(/_/g, " ");

// Statuses an order can move to from its current status.
const NEXT_STATUSES: Record<string, string[]> = {
	draft: ["submitted_for_approval"],
	submitted_for_approval: ["approved", "cancelled"],
	approved: ["cancelled"],
};

export default function OrderDetailPage() {
	const { id } = useParams<{ id: string }>();
	const token = useToken();
	const [order, setOrder] = useState<Detail | null>(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const [modalOpen, setModalOpen] = useState(false);
	const [newStatus, setNewStatus] = useState("");
	const [comment, setComment] = useState("");
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState("");

	const load = useCallback(
		async (signal?: AbortSignal) => {
			setLoading(true);
			setError("");
			try {
				const data = await salesGet(`sales/order/detail/${id}/`, token, signal);
				setOrder(data?.data ?? data);
			} catch (e: unknown) {
				if (e instanceof Error && e.name !== "AbortError") {
					setError(e.message || "Failed to load");
				}
			} finally {
				setLoading(false);
			}
		},
		[id, token],
	);

	useEffect(() => {
		if (!token || !id) return;
		const controller = new AbortController();
		load(controller.signal);
		return () => controller.abort();
	}, [token, id, load]);

	const currentStatus: string = order?.status ?? "";
	const options = NEXT_STATUSES[currentStatus] ?? [];

	const openModal = () => {
		setNewStatus(options[0] ?? "");
		setComment("");
		setSaveError("");
		setModalOpen(true);
	};

	const confirmChange = async () => {
		setSaving(true);
		setSaveError("");
		try {
			await salesPost(`sales/order/status/${id}/`, token, {
				status: newStatus,
				comment,
			});
			setModalOpen(false);
			await load();
		} catch (e: unknown) {
			setSaveError(e instanceof Error ? e.message : "Failed to change status");
		} finally {
			setSaving(false);
		}
	};

	const fields = order ? Object.entries(order).filter(([, v]) => isPrimitive(v)) : [];

	return (
		<main className="p-4 font-sans">
			<Link href="/backup-orders" className="text-sm text-blue-600">
				← Back to sales orders
			</Link>
			<div className="mt-2 mb-3 flex items-center justify-between">
				<h1 className="text-lg font-semibold">Order {order?.unique_id ?? `#${id}`}</h1>
				{order && options.length > 0 && (
					<button className="rounded bg-black px-3 py-1 text-sm text-white" onClick={openModal}>
						Change status
					</button>
				)}
			</div>

			{!token && <p>Waiting for access token from apps-frontend…</p>}
			{loading && <p>Loading order…</p>}
			{error && <p className="text-red-600">{error}</p>}

			{order && !loading && (
				<>
					<table className="w-full max-w-xl border-collapse text-sm">
						<tbody>
							{fields.map(([key, value]) => (
								<tr key={key} className="border-b">
									<th className="w-1/3 py-2 text-left font-medium capitalize">{label(key)}</th>
									<td>{String(value ?? "")}</td>
								</tr>
							))}
						</tbody>
					</table>

					<details className="mt-4 text-xs">
						<summary className="cursor-pointer">Raw response</summary>
						<pre className="mt-2 break-all whitespace-pre-wrap">
							{JSON.stringify(order, null, 2)}
						</pre>
					</details>
				</>
			)}

			{modalOpen && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
					onClick={() => !saving && setModalOpen(false)}
				>
					<div
						className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl"
						onClick={(e) => e.stopPropagation()}
					>
						<h2 className="mb-1 font-semibold">Change order status</h2>
						<p className="mb-3 text-sm text-zinc-600">
							Order {order?.unique_id} is currently <b>{label(currentStatus)}</b>. Are you sure you
							want to change it?
						</p>

						<label className="mb-1 block text-sm font-medium">New status</label>
						<select
							value={newStatus}
							onChange={(e) => setNewStatus(e.target.value)}
							className="mb-3 w-full rounded border p-2 text-sm capitalize"
						>
							{options.map((s) => (
								<option key={s} value={s}>
									{label(s)}
								</option>
							))}
						</select>

						<label className="mb-1 block text-sm font-medium">Remarks (optional)</label>
						<textarea
							value={comment}
							onChange={(e) => setComment(e.target.value)}
							rows={3}
							className="w-full rounded border p-2 text-sm"
						/>

						{saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}

						<div className="mt-3 flex justify-end gap-2">
							<button
								className="rounded border px-3 py-1 text-sm"
								disabled={saving}
								onClick={() => setModalOpen(false)}
							>
								Cancel
							</button>
							<button
								className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
								disabled={saving || !newStatus}
								onClick={confirmChange}
							>
								{saving ? "Saving…" : "Confirm"}
							</button>
						</div>
					</div>
				</div>
			)}
		</main>
	);
}
