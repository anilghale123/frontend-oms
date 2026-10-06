import { TokenProvider } from "./token-context";

/**
 * Preserved spike: the first OMS pass against the real Providhy Sales API, kept for reference
 * while OMS is rebuilt from the design repo on mock data.
 *
 * `TokenProvider` used to sit in the root layout. The root layout now belongs to OMS proper, so
 * these pages carry their own provider and stay self-contained — nothing outside this folder
 * depends on the postMessage token handshake.
 *
 * See omsImplementationPlan.md -> Step 0, and the auth notes in section 2.
 */
export default function BackupOrdersLayout({ children }: LayoutProps<"/backup-orders">) {
	return <TokenProvider>{children}</TokenProvider>;
}
