import type { RiderDetails } from "@/lib/domain";
import { PanelHint } from "@/components/layout";
import { DetailField } from "../detail-field";

export interface OrderRiderDetailsProps {
	rider: RiderDetails | null;
}

/** Rider section body: assigned rider details, or an empty hint. */
export function OrderRiderDetails({ rider }: OrderRiderDetailsProps) {
	if (!rider) {
		return (
			<PanelHint>No rider assigned yet. Assign one when the order is ready for delivery.</PanelHint>
		);
	}

	return (
		<dl className="grid gap-3">
			<DetailField label="Name">{rider.name}</DetailField>
			<DetailField label="Phone" numeric>
				{rider.phone}
			</DetailField>
			<DetailField label="Vehicle">{rider.vehicleNumber}</DetailField>
		</dl>
	);
}
