/**
 * Error envelope for the mock backend: `{ error: { code, message } }`, matching
 * `.claude/rules/mock-api.md`. The design repo emitted three different shapes
 * (`{ message }`, `{ error: string }`, and this one); routing every failure through here keeps
 * the mock honest about the contract the real API is expected to honor.
 *
 * `@/lib/api/errors` still parses the other shapes defensively, because a real backend may not
 * be this tidy.
 */
import { NextResponse } from "next/server";

export type MockErrorCode =
	| "not_found"
	| "invalid_body"
	| "invalid_transition"
	| "forbidden"
	| "rider_required"
	| "no_delivering_order";

export function mockError(code: MockErrorCode, message: string, status: number) {
	return NextResponse.json({ error: { code, message } }, { status });
}
