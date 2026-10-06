import { apiClient } from "@/lib/api/client";
import type {
	DevDeliveringOrderResponse,
	DevVoucherResponse,
	ValidateVoucherRequest,
	ValidateVoucherResponse,
} from "@/lib/api/contracts";

export function validateVoucher(body: ValidateVoucherRequest) {
	return apiClient.post<ValidateVoucherResponse>("/validate", body);
}

/** Dev only: the voucher the customer's QR would carry, for the simulated scanner. */
export function getDevVoucher(omsOrderId: string) {
	return apiClient.get<DevVoucherResponse>(`/dev/voucher/${encodeURIComponent(omsOrderId)}`);
}

/** Dev only: an order out for delivery and its voucher, for the "Simulate delivery" shortcut. */
export function getDevDeliveringOrder() {
	return apiClient.get<DevDeliveringOrderResponse>("/dev/delivering");
}
