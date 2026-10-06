/**
 * Rider voucher validation rules (domain rules 8 and 9). The mock API decides with these and the
 * rider portal shows the same copy, so the wording and the attempt limit live in one place.
 */

import { MAX_VALIDATION_ATTEMPTS, type ValidationOutcome } from "./types";

/** What the rider sees after an attempt. `blocked` means no attempts are left for the Order ID. */
export type ValidationResultOutcome = ValidationOutcome | "blocked";

/** Exact rider-facing messages (rider-portal rules). Success has no message; the UI shows a
 * confirmation screen instead. */
export const VALIDATION_MESSAGES: Record<Exclude<ValidationResultOutcome, "success">, string> = {
	mismatch: "The two fields do not match",
	already_redeemed: "Voucher code already redeemed",
	redemption_failed: "Redemption failed. Try again.",
	blocked: "Validation is blocked for this order",
};

/**
 * Whether an outcome uses up one of the Order ID's attempts. An already-redeemed voucher does
 * not: the rider didn't guess wrong, the delivery was already completed.
 */
export function consumesAttempt(outcome: ValidationOutcome): boolean {
	return outcome === "mismatch" || outcome === "redemption_failed";
}

/** Validation stops for an Order ID once its attempts reach 0. */
export function isValidationBlocked(attemptsRemaining: number): boolean {
	return attemptsRemaining <= 0;
}

/** Attempts left after one more consuming attempt, never below 0. */
export function nextAttemptsRemaining(attemptsRemaining: number): number {
	return Math.max(0, Math.min(MAX_VALIDATION_ATTEMPTS, attemptsRemaining) - 1);
}
