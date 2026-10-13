"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/feedback";
import { useAuth } from "@/providers/AuthProvider";

export interface SessionGateProps {
	children: ReactNode;
	/**
	 * What to show while the session opens: the screen's own loading state (the embed layout passes
	 * `OrderScreenSkeleton`), so opening OMS reads as skeleton → content with no spinner between.
	 */
	fallback: ReactNode;
}

/**
 * Holds a surface back until there is an OMS session.
 *
 * The screens underneath assume a merchant: every order request is scoped by their token.
 * Rendering them first and letting each one fail would mean a row of error states — so the
 * session is settled once, here.
 *
 * Three states, and the distinction between the last two is the useful part:
 *
 * - **loading** — `fallback`, the screen's skeleton. Normally one round trip to `/api/session`,
 *   which the cookie answers. It also covers the handshake when there is no session, or Sales
 *   refused the token: OMS has asked the portal for a token and is waiting for it.
 * - **unauthenticated with a reason** — something went wrong and it is worth explaining: a token
 *   refused straight after it was handed over, an ended portal session, an unreachable backend.
 *   Offers a retry, because most of these are transient.
 * - **unauthenticated because OMS was opened directly** — not an error at all. OMS is a surface of
 *   the Fonepoints Business portal, so the answer is where to open it from, not a retry.
 *
 * Not mounted on the rider portal. Riders have no account: the Order ID and voucher pair is the
 * credential, so `/deliver` must render for someone holding only a link.
 */
export function SessionGate({ children, fallback }: SessionGateProps) {
	const { status, reason, reasonKind, retry } = useAuth();

	if (status === "authenticated") {
		return <>{children}</>;
	}

	if (status === "loading") {
		return (
			<>
				{/* The skeleton is a silent picture; this says what is happening to a screen reader. */}
				<p className="sr-only" role="status">
					Opening OMS…
				</p>
				{fallback}
			</>
		);
	}

	// "Open it from the portal" is guidance, not a failure, so it gets the neutral empty state
	// rather than the error one — and no retry, since retrying changes nothing.
	const isDirectVisit = reasonKind === "direct-visit";

	return (
		<div className="flex min-h-96 flex-1 flex-col justify-center p-4">
			{isDirectVisit ? (
				<EmptyState
					icon={Lock}
					title="OMS opens from the Fonepoints portal"
					description="Sign in to Fonepoints Business and choose OMS. The portal is what grants this app access to your orders."
				/>
			) : (
				<ErrorState
					title="Couldn’t start your OMS session"
					description={reason ?? "Something went wrong while signing you in."}
					onRetry={retry}
				/>
			)}
			{!isDirectVisit && (
				<p className="mt-3 text-center text-xs text-fg-tertiary">
					If this keeps happening, reopen OMS from the Fonepoints portal.
				</p>
			)}
		</div>
	);
}
