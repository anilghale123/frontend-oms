import { Lock } from "lucide-react";
import { EmptyState } from "@/components/feedback";

const PORTAL_GUIDANCE =
	"Sign in to Fonepoints Business and choose OMS. The portal is what grants this app access to your orders.";

export interface OpenFromPortalStateProps {
	/** Defaults to "OMS opens from the Fonepoints portal". */
	title?: string;
	/** Defaults to how to open OMS from the portal. */
	description?: string;
}

/**
 * Where to open OMS from, for anyone who reached it some other way: the home page, a direct visit to
 * an embedded screen, an address that does not exist. Guidance, not an error, so it is the neutral
 * empty state with no retry: retrying changes nothing.
 */
export function OpenFromPortalState({
	title = "OMS opens from the Fonepoints portal",
	description = PORTAL_GUIDANCE,
}: OpenFromPortalStateProps) {
	return <EmptyState icon={Lock} title={title} description={description} />;
}
