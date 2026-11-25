import type { ReactNode } from "react";
import { EMBED_BASE_PATH } from "@/config/constants";
import { OrderRoutesProvider, OrderScreenSkeleton, OrderTopBar } from "@/features/orders";
import { SessionGate } from "@/features/shell";
import { AuthProvider } from "@/providers/AuthProvider";
import { HostChannelProvider } from "@/providers/HostChannelProvider";
import { HostSync } from "@/providers/HostSync";

/**
 * The merchant's OMS: the order screens, rendered inside the Fonepoints Business portal's iframe.
 *
 * This is the only merchant surface. The portal supplies only its sidebar; OMS draws its own
 * "Order Management" top bar (`OrderTopBar`, with a back arrow on an order) across the frame, then the page padding.
 *
 * `OrderRoutesProvider` prefixes every order link with `/embed`, so navigating inside the iframe
 * stays on this surface.
 *
 * The three providers are one conversation with the host, in the order it happens:
 *
 * - `HostChannelProvider` owns the single `postMessage` channel and posts `oms.ready`. It is the
 *   outermost of the three because it must announce *after* both consumers have subscribed, and
 *   React runs child effects before parent effects.
 * - `AuthProvider` checks OMS's own cookie and, only when there is none, asks the portal for a
 *   token and trades it for an httpOnly cookie (`docs/auth-handoff.md`).
 * - `HostSync` follows the host's theme, which it applies transiently (see `auth.md` section 9).
 *
 * `HostSync` sits outside the gate: the theme should follow the portal even while the session is
 * still opening, so the skeleton is not light inside a dark portal. While it opens, the gate draws
 * the order screen being opened in its loading state (`OrderScreenSkeleton`), not a spinner.
 *
 * The content area is exactly the frame's height (`h-dvh`), so the screens scroll inside it: the
 * queue's rows between its fixed toolbar and pagination, the detail page beside its order list.
 * It still scrolls as a whole when a screen's minimum height does not fit a very short frame.
 */
export default function EmbedLayout({ children }: { children: ReactNode }) {
	return (
		<HostChannelProvider>
			<AuthProvider>
				<OrderRoutesProvider basePath={EMBED_BASE_PATH}>
					<HostSync />
					<div className="flex h-dvh flex-col bg-fill1">
						<OrderTopBar />
						<div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
							<SessionGate fallback={<OrderScreenSkeleton />}>{children}</SessionGate>
						</div>
					</div>
				</OrderRoutesProvider>
			</AuthProvider>
		</HostChannelProvider>
	);
}
