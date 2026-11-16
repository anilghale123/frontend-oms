/** Row density. Medium is the default. */
export type DataTableRowSize = "xs" | "sm" | "md" | "lg" | "xl";

/** Vertical padding per row size, applied to header and body cells. */
export const DATA_TABLE_ROW_SIZE_CLASS: Record<DataTableRowSize, string> = {
	xs: "py-1",
	sm: "py-1.5",
	md: "py-2",
	lg: "py-3",
	xl: "py-4",
};
