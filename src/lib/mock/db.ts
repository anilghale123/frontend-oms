import { type ActivityLogEntry, MAX_VALIDATION_ATTEMPTS, type Order } from "@/lib/domain/types";
import { seedActivityLog, seedOrders } from "./seed";

/**
 * In-memory mock store — a module-level singleton. State resets whenever
 * the dev server restarts (CLAUDE.md → "Mock layer").
 */
const ordersById = new Map<string, Order>(seedOrders.map((order) => [order.omsOrderId, order]));
const activityLog: ActivityLogEntry[] = [...seedActivityLog];
const unknownOrderAttempts = new Map<string, number>();

export const db = {
	listOrders(filter?: { merchantId?: string }): Order[] {
		const all = [...ordersById.values()];
		if (filter?.merchantId) {
			return all.filter((order) => order.merchantId === filter.merchantId);
		}
		return all;
	},

	getOrder(omsOrderId: string): Order | undefined {
		return ordersById.get(omsOrderId);
	},

	findByReferenceId(fonepointsReferenceId: string): Order | undefined {
		return [...ordersById.values()].find(
			(order) => order.fonepointsReferenceId === fonepointsReferenceId,
		);
	},

	createOrder(order: Order): void {
		ordersById.set(order.omsOrderId, order);
	},

	updateOrder(omsOrderId: string, patch: Partial<Order>): Order | undefined {
		const existing = ordersById.get(omsOrderId);
		if (!existing) return undefined;
		const updated: Order = {
			...existing,
			...patch,
			updatedAt: new Date().toISOString(),
		};
		ordersById.set(omsOrderId, updated);
		return updated;
	},

	listActivity(omsOrderId: string): ActivityLogEntry[] {
		return activityLog
			.filter((entry) => entry.omsOrderId === omsOrderId)
			.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
	},

	appendActivity(entry: ActivityLogEntry): void {
		activityLog.push(entry);
	},

	/** Attempts left for an Order ID that doesn't exist. Counted like a real order so the rider
	 * can't tell the difference (domain rule 8). */
	getUnknownAttempts(omsOrderId: string): number {
		return unknownOrderAttempts.get(omsOrderId) ?? MAX_VALIDATION_ATTEMPTS;
	},

	setUnknownAttempts(omsOrderId: string, attemptsRemaining: number): void {
		unknownOrderAttempts.set(omsOrderId, attemptsRemaining);
	},
};
