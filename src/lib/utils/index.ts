import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs.filter(Boolean)));
}

export {
	formatDate,
	formatDateTime,
	formatOrderValue,
	formatPhone,
	formatPoints,
	formatRs,
	initialsOf,
} from "./format";
