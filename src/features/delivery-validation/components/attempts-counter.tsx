import { ShieldAlert, ShieldCheck } from "lucide-react";
import { MAX_VALIDATION_ATTEMPTS } from "@/lib/domain";
import { cn } from "@/lib/utils";

export interface AttemptsCounterProps {
	/** Attempts left for the entered Order ID, from the last server response; null before the
	 * first attempt on this Order ID. */
	attemptsRemaining: number | null;
}

/** The rider always sees how many tries are left for the order (max 5). */
export function AttemptsCounter({ attemptsRemaining }: AttemptsCounterProps) {
	const known = attemptsRemaining !== null;
	const low = known && attemptsRemaining <= 1;
	const Icon = low ? ShieldAlert : ShieldCheck;

	let text = `${MAX_VALIDATION_ATTEMPTS} attempts per order`;
	if (known) {
		text =
			attemptsRemaining === 0
				? "No attempts left"
				: `${attemptsRemaining} of ${MAX_VALIDATION_ATTEMPTS} attempts left`;
	}

	return (
		<p
			aria-live="polite"
			className={cn(
				"flex items-center gap-1.5 text-sm",
				!known && "text-fg-secondary",
				known && !low && "text-fg",
				low && attemptsRemaining === 1 && "text-warning-text",
				attemptsRemaining === 0 && "text-error-text",
			)}
		>
			<Icon className="size-4 shrink-0" aria-hidden />
			{text}
		</p>
	);
}
