/** The status popup asks one question and offers the confirm action and a Default Cancel. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfirmStatusDialog } from "./confirm-status-dialog";

afterEach(cleanup);

function renderDialog(to: "ready_for_delivery" | "failed", onConfirm = vi.fn(async () => {})) {
	const onOpenChange = vi.fn();
	render(
		<ConfirmStatusDialog
			open
			onOpenChange={onOpenChange}
			omsOrderId="OMS-1052"
			from="preparing"
			to={to}
			onConfirm={onConfirm}
		/>,
	);
	return { onConfirm, onOpenChange };
}

describe("ConfirmStatusDialog", () => {
	it("names the new status, with Change status and Cancel", () => {
		renderDialog("ready_for_delivery");
		expect(
			screen.getByRole("heading", { name: "Change OMS-1052 to Ready for delivery?" }),
		).toBeTruthy();
		expect(screen.getByRole("button", { name: "Change status" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
	});

	it("runs the change and closes", async () => {
		const { onConfirm, onOpenChange } = renderDialog("failed");
		fireEvent.click(screen.getByRole("button", { name: "Mark failed" }));
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(onConfirm).toHaveBeenCalledOnce();
	});

	it("closes from Cancel without changing anything", () => {
		const { onConfirm, onOpenChange } = renderDialog("ready_for_delivery");
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(onConfirm).not.toHaveBeenCalled();
	});
});
