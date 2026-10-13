import type { OrderRider } from "@/lib/domain";
import { PanelHint } from "@/components/layout";
import { DetailField, EmptyValue } from "../detail-field";

export interface OrderRiderDetailsProps {
	rider: OrderRider | null;
}

/** Rider section body: the rider the backend has on record, or an empty hint. */
export function OrderRiderDetails({ rider }: OrderRiderDetailsProps) {
	if (!rider) {
		return <PanelHint>No rider assigned.</PanelHint>;
	}

	return (
		<dl className="grid gap-3">
			<DetailField label="Name">{rider.name || <EmptyValue />}</DetailField>
			<DetailField label="Phone" numeric>
				{rider.phone || <EmptyValue />}
			</DetailField>
			{rider.extra.map((field) => (
				<DetailField key={field.label} label={field.label}>
					{field.value}
				</DetailField>
			))}
		</dl>
	);
}
