import { AuthProvider } from "@/providers/AuthProvider";
import { HostChannelProvider } from "@/providers/HostChannelProvider";
import { MerchantShell, SessionGate } from "@/features/shell";

/**
 * Merchant surface: the standalone dashboard, sidebar + header.
 *
 * There is no host here, so the session comes from `/api/session/dev` — development only (see
 * `AuthProvider`). In production this surface shows the gate's "open OMS from the portal" state,
 * because a merchant's access token can only be issued to the Fonepoints backend.
 *
 * `HostChannelProvider` is mounted even though nothing frames this surface: every method on the
 * channel is a no-op when OMS is not embedded, and having it here means `AuthProvider` takes the
 * same shape on both surfaces.
 *
 * The shell sits *inside* the gate, so the sidebar's merchant company is never rendered empty
 * while the session is still opening.
 */
export default function MerchantLayout({ children }: { children: React.ReactNode }) {
	return (
		<HostChannelProvider>
			<AuthProvider source="standalone">
				<SessionGate>
					<MerchantShell>{children}</MerchantShell>
				</SessionGate>
			</AuthProvider>
		</HostChannelProvider>
	);
}
