import type { Metadata } from "next";
import { EmbedSignOut } from "@/providers/EmbedSignOut";

export const metadata: Metadata = { title: "Signing out of OMS", robots: { index: false } };

/**
 * Loaded by the portal in a hidden iframe when the merchant signs out there. Outside `/embed` on
 * purpose: the embed layout would start a session, and this page only ends one.
 */
export default function EmbedSignOutPage() {
	return <EmbedSignOut />;
}
