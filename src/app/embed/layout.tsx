import type { ReactNode } from "react";
import { EMBED_BASE_PATH } from "@/config/constants";
import { OrderRoutesProvider, OrderScreenSkeleton } from "@/features/orders";
import { SessionGate } from "@/features/shell";
import { AuthProvider } from "@/providers/AuthProvider";
import { HostChannelProvider } from "@/providers/HostChannelProvider";
import { HostSync } from "@/providers/HostSync";

/**
 * The merchant's OMS: the order screens, rendered inside the Fonepoints Business portal's iframe.
 *
 * This is the only merchant surface. The portal supplies the sidebar, header and page chrome, so
 * this layout renders none of it and supplies only the page padding.
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
 */
export default function EmbedLayout({ children }: { children: ReactNode }) {
	return (
		<HostChannelProvider>
			<AuthProvider>
				<OrderRoutesProvider basePath={EMBED_BASE_PATH}>
					<HostSync />
					<div className="flex min-h-screen flex-col bg-fill1 p-4">
						<SessionGate fallback={<OrderScreenSkeleton />}>{children}</SessionGate>
					</div>
				</OrderRoutesProvider>
			</AuthProvider>
		</HostChannelProvider>
	);
}
