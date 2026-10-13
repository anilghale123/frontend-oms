/**
 * Portal sign-out on the OMS side: the hidden `/embed-signout` frame deletes the session cookies
 * and tells the portal, and does nothing at all when it is not framed.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { OMS_SOURCE, PROTOCOL_VERSION } from "@/lib/host";
import { forgetToken, readRememberedToken, rememberToken } from "@/lib/auth";
import { EmbedSignOut } from "./EmbedSignOut";

const HOST_ORIGIN = "http://localhost:4200";

function frameWindow() {
	const posted: unknown[] = [];
	const parent = {
		postMessage: (message: unknown, target: string) => {
			if (target === HOST_ORIGIN) posted.push(message);
		},
	};
	vi.spyOn(window, "parent", "get").mockReturnValue(parent as unknown as Window);
	return posted;
}

function stubDelete(status: number) {
	const fetchMock = vi.fn(
		async () => new Response(JSON.stringify({ ok: status === 200 }), { status }),
	);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	forgetToken();
});

describe("EmbedSignOut", () => {
	it("deletes the session and tells the portal", async () => {
		const posted = frameWindow();
		const fetchMock = stubDelete(200);
		rememberToken("oms_at_in_memory");

		render(<EmbedSignOut />);

		await waitFor(() =>
			expect(posted).toContainEqual({
				source: OMS_SOURCE,
				v: PROTOCOL_VERSION,
				type: "oms.auth.cleared",
			}),
		);
		expect(fetchMock).toHaveBeenCalledWith("/api/session", { method: "DELETE" });
		expect(readRememberedToken()).toBeNull();
	});

	it("does not report success when the cookies could not be deleted", async () => {
		const posted = frameWindow();
		const fetchMock = stubDelete(403);

		render(<EmbedSignOut />);

		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(posted).toHaveLength(0);
	});

	it("does nothing when opened outside a frame", async () => {
		// No `frameWindow()`: `window.parent === window`.
		const fetchMock = stubDelete(200);

		render(<EmbedSignOut />);

		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
