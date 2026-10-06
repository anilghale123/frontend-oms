import type { Table } from "@tanstack/react-table";
import type { ExportCell, ExportTable } from "@/lib/utils/export";

/**
 * Turns what the table shows into an export: every filtered + sorted row (all pages) and
 * every visible column, using each column's `meta.export` spec when present.
 */
export function tableToExport<TData>(table: Table<TData>): ExportTable {
	const specs = table.getVisibleLeafColumns().flatMap((column) => {
		const meta = column.columnDef.meta;
		if (meta?.export) return meta.export;
		if (!column.accessorFn) return [];
		return [
			{
				label: meta?.label ?? column.id,
				value: (row: TData) => {
					const value = column.accessorFn!(row, 0);
					return typeof value === "number" || typeof value === "string"
						? value
						: value == null
							? null
							: String(value);
				},
			},
		];
	});

	const rows = table.getPrePaginationRowModel().rows;
	return {
		headers: specs.map((spec) => spec.label),
		rows: rows.map((row) => specs.map((spec): ExportCell => spec.value(row.original))),
	};
}
