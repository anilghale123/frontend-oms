import { RiderShell } from "@/features/shell";

// Rider portal: mobile-first, single column, designed at 360px, no sidebar.
export default function RiderLayout({ children }: { children: React.ReactNode }) {
	return <RiderShell>{children}</RiderShell>;
}
