/**
 * The rider can only confirm a delivery once the Cloudflare Turnstile check has succeeded, and
 * loses that permission again whenever the token is gone: expired, failed, or spent.
 */

import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeliveryValidationForm } from "./delivery-validation-form";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

// The real component injects Cloudflare's script; here it is "loaded" as soon as it mounts.
vi.mock("next/script", () => ({
	default: function ScriptStub({ onReady }: { onReady?: () => void }) {
		useEffect(() => onReady?.(), [onReady]);
		return null;
	},
}));

type Callbacks = {
	callback: (token: string) => void;
	"expired-callback": () => void;
	"error-callback": () => void;
};

let widget: Callbacks;
const turnstile = {
	render: vi.fn((_container: HTMLElement, options: Callbacks) => {
		widget = options;
		return "widget-1";
	}),
	reset: vi.fn(),
	remove: vi.fn(),
};

function renderForm() {
	const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
	render(
		<QueryClientProvider client={client}>
			<DeliveryValidationForm />
		</QueryClientProvider>,
	);
	return screen.getByRole("button", { name: "Confirm delivery" });
}

function fillIn() {
	fireEvent.change(screen.getByLabelText("Order ID"), { target: { value: "OMS-0427" } });
	fireEvent.change(screen.getByLabelText("Voucher code"), { target: { value: "V-1234" } });
}

const passCheck = (token = "0.token") => act(() => widget.callback(token));

beforeEach(() => {
	vi.stubGlobal("turnstile", turnstile);
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

describe("DeliveryValidationForm security check", () => {
	it("keeps Confirm delivery disabled until the check succeeds", async () => {
		const button = renderForm();
		await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(1));
		fillIn();

		expect(button).toBeDisabled();
		expect(screen.getByText("Complete the security check to confirm delivery.")).toBeVisible();

		passCheck();

		expect(button).toBeEnabled();
		expect(screen.queryByText("Complete the security check to confirm delivery.")).toBeNull();
	});

	it("does not submit on Enter before the check succeeds", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		renderForm();
		await waitFor(() => expect(turnstile.render).toHaveBeenCalled());
		fillIn();

		fireEvent.submit(screen.getByLabelText("Voucher code").closest("form")!);

		await act(async () => {});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("disables Confirm delivery again when the token expires or the check errors", async () => {
		const button = renderForm();
		await waitFor(() => expect(turnstile.render).toHaveBeenCalled());
		fillIn();

		passCheck();
		expect(button).toBeEnabled();
		act(() => widget["expired-callback"]());
		expect(button).toBeDisabled();

		passCheck("0.second");
		expect(button).toBeEnabled();
		act(() => widget["error-callback"]());
		expect(button).toBeDisabled();

		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(turnstile.reset).toHaveBeenCalledWith("widget-1");
		expect(button).toBeDisabled();
	});

	it("sends the token, then needs a new check after a refused attempt", async () => {
		const fetchMock = vi.fn(async () =>
			Response.json(
				{ error: { code: "invalid_order", message: "Invalid order id or voucher code." } },
				{ status: 400 },
			),
		);
		vi.stubGlobal("fetch", fetchMock);
		const button = renderForm();
		await waitFor(() => expect(turnstile.render).toHaveBeenCalled());
		fillIn();
		passCheck("0.first");

		fireEvent.click(button);

		await screen.findByText("Invalid order id or voucher code.");
		const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(JSON.parse(String(init.body))).toEqual({
			order_id: "OMS-0427",
			voucher_code: "V-1234",
			turnstileToken: "0.first",
		});
		// The spent token's widget is replaced by a new check.
		expect(turnstile.remove).toHaveBeenCalledWith("widget-1");
		await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(2));
		expect(button).toBeDisabled();
		expect(screen.getByLabelText("Voucher code")).toHaveValue("");

		passCheck("0.second");
		expect(button).toBeEnabled();
	});

	it("tells a refused security check apart from a wrong voucher", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json(
					{ error: { code: "verification_failed", message: "Verification failed. Try again." } },
					{ status: 400 },
				),
			),
		);
		const button = renderForm();
		await waitFor(() => expect(turnstile.render).toHaveBeenCalled());
		fillIn();
		passCheck();

		fireEvent.click(button);

		await screen.findByText("Verification failed. Try again.");
		expect(
			screen.getByText("Complete the security check again, then confirm delivery."),
		).toBeVisible();
		// The voucher was never checked, so the rider keeps what they typed.
		expect(screen.getByLabelText("Voucher code")).toHaveValue("V-1234");
		await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(2));
		expect(button).toBeDisabled();
	});
});
