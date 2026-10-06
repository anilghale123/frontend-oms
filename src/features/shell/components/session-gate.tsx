"use client";

import { Lock } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/feedback";
import { useAuth } from "@/providers/AuthProvider";

export interface SessionGateProps {
	children: React.ReactNode;
}

/**
 * Holds a surface back until there is an OMS session.
 *
 * The screens underneath assume a merchant: the sidebar shows their company, and every order
 * request is scoped by their token. Rendering them first and letting each one fail would mean a
 * flash of empty chrome followed by a row of error states — so the session is settled once, here.
 *
 * Three states, and the distinction between the last two is the useful part:
 *
 * - **loading** — a spinner. Normally one round trip to `/api/session`, which the cookie answers.
 * - **unauthenticated with a reason** — something went wrong and it is worth explaining: a
 *   rejected token, an ended portal session, an unreachable backend. Offers a retry, because most
 *   of these are transient.
 * - **unauthenticated because OMS was opened directly** — not an error at all. OMS is a surface of
 *   the Fonepoints Business portal, so the answer is where to open it from, not a retry.
 *
 * Not mounted on the rider portal. Riders have no account: the Order ID and voucher pair is the
 * credential, so `/deliver` must render for someone holding only a link.
 */
export function SessionGate({ children }: SessionGateProps) {
	const { status, reason, reasonKind, retry } = useAuth();

	if (status === "authenticated") {
		return <>{children}</>;
	}

	if (status === "loading") {
		return (
			<div
				className="flex min-h-96 flex-1 flex-col items-center justify-center gap-3"
				role="status"
			>
				<Spinner className="size-6 text-fg-secondary" />
				<p className="text-sm text-fg-secondary">Opening OMS…</p>
			</div>
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
