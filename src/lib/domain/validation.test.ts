import { describe, expect, it } from "vitest";
import { MAX_VALIDATION_ATTEMPTS, type ValidationOutcome } from "./types";
import {
	VALIDATION_MESSAGES,
	type ValidationResultOutcome,
	consumesAttempt,
	isValidationBlocked,
	nextAttemptsRemaining,
} from "./validation";

const OUTCOMES: ValidationOutcome[] = [
	"success",
	"mismatch",
	"already_redeemed",
	"redemption_failed",
];

describe("consumesAttempt", () => {
	it("spends an attempt on a wrong pair or a failed redemption", () => {
		expect(consumesAttempt("mismatch")).toBe(true);
		expect(consumesAttempt("redemption_failed")).toBe(true);
	});

	it("does not spend an attempt on success", () => {
		expect(consumesAttempt("success")).toBe(false);
	});

	it("does not punish an already-redeemed voucher — the rider did not guess wrong", () => {
		expect(consumesAttempt("already_redeemed")).toBe(false);
	});
});

describe("isValidationBlocked", () => {
	it("blocks only at zero or below", () => {
		expect(isValidationBlocked(MAX_VALIDATION_ATTEMPTS)).toBe(false);
		expect(isValidationBlocked(1)).toBe(false);
		expect(isValidationBlocked(0)).toBe(true);
		expect(isValidationBlocked(-1)).toBe(true);
	});
});

describe("nextAttemptsRemaining", () => {
	it("counts down one at a time", () => {
		expect(nextAttemptsRemaining(5)).toBe(4);
		expect(nextAttemptsRemaining(2)).toBe(1);
		expect(nextAttemptsRemaining(1)).toBe(0);
	});

	it("never goes below zero, so a blocked order cannot drift negative", () => {
		expect(nextAttemptsRemaining(0)).toBe(0);
		expect(nextAttemptsRemaining(-3)).toBe(0);
	});

	it("clamps a count above the maximum back into range", () => {
		expect(nextAttemptsRemaining(99)).toBe(MAX_VALIDATION_ATTEMPTS - 1);
	});

	it("reaches blocked in exactly MAX_VALIDATION_ATTEMPTS consuming attempts", () => {
		let remaining = MAX_VALIDATION_ATTEMPTS;
		let attempts = 0;
		while (!isValidationBlocked(remaining)) {
			remaining = nextAttemptsRemaining(remaining);
			attempts += 1;
			expect(attempts).toBeLessThanOrEqual(MAX_VALIDATION_ATTEMPTS);
		}
		expect(attempts).toBe(MAX_VALIDATION_ATTEMPTS);
	});
});

describe("VALIDATION_MESSAGES", () => {
	it("has exact copy for every failure the rider can see", () => {
		const failures: Exclude<ValidationResultOutcome, "success">[] = [
			"mismatch",
			"already_redeemed",
			"redemption_failed",
			"blocked",
		];
		for (const outcome of failures) {
			expect(VALIDATION_MESSAGES[outcome]).toBeTruthy();
		}
	});

	it("never reveals whether an Order ID exists", () => {
		// A mismatch must read the same whether or not the order is real (domain rule 8).
		expect(VALIDATION_MESSAGES.mismatch).toBe("The two fields do not match");
		expect(VALIDATION_MESSAGES.mismatch.toLowerCase()).not.toContain("not found");
		expect(VALIDATION_MESSAGES.mismatch.toLowerCase()).not.toContain("exist");
	});

	it("has no message for success — the UI shows a confirmation screen instead", () => {
		expect(OUTCOMES).toContain("success");
		expect("success" in VALIDATION_MESSAGES).toBe(false);
	});
});
