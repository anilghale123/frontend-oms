import type { ReactNode } from "react";
import { EMBED_BASE_PATH } from "@/config/constants";
import { OrderRoutesProvider } from "@/features/orders";
import { SessionGate } from "@/features/shell";
import { AuthProvider } from "@/providers/AuthProvider";
import { HostChannelProvider } from "@/providers/HostChannelProvider";
import { HostSync } from "@/providers/HostSync";

/**
 * Embedded surface: OMS rendered inside the Fonepoints Business portal's iframe.
 *
 * The host supplies the sidebar, header and page chrome, so this layout deliberately renders
 * none of it — no `AppShell`, no `AppSidebar`, no `ShellHeader`. That is the whole difference
 * between this surface and `(merchant)`, which is why all shell composition was kept in a single
 * layout file (omsImplementationPlan.md section 9.1).
 *
 * `AppShell` normally owns the page padding, so it is supplied here instead.
 *
 * `OrderRoutesProvider` prefixes every order link with `/embed`, so navigating inside the iframe
 * stays on the embedded surface rather than jumping to the standalone dashboard.
 *
 * The three providers are one conversation with the host, in the order it happens:
 *
 * - `HostChannelProvider` owns the single `postMessage` channel and posts `oms.ready`. It is the
 *   outermost of the three because it must announce *after* both consumers have subscribed, and
 *   React runs child effects before parent effects.
 * - `AuthProvider source="host"` waits for `host.auth.grant` and trades the token for an httpOnly
 *   cookie. This is the only surface where a real token arrives.
 * - `HostSync` follows the host's theme, which it applies transiently (see `auth.md` section 9).
 *
 * `HostSync` sits inside the gate's sibling position rather than under it: the theme should follow
 * the portal even while the session is still opening, so the spinner is not light inside a dark
 * portal.
 */
export default function EmbedLayout({ children }: { children: ReactNode }) {
	return (
		<HostChannelProvider>
			<AuthProvider source="host">
				<OrderRoutesProvider basePath={EMBED_BASE_PATH}>
					<HostSync />
					<div className="flex min-h-screen flex-col bg-fill1 p-4">
						<SessionGate>{children}</SessionGate>
					</div>
				</OrderRoutesProvider>
			</AuthProvider>
		</HostChannelProvider>
	);
}
