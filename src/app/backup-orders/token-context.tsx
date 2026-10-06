"use client";

import { createContext, useContext, useEffect, useState } from "react";

// Message types shared with apps-frontend (src/app/(v2)/oms/page.jsx)
const MSG = {
	READY: "OMS_IFRAME_READY",
	TOKEN: "OMS_ACCESS_TOKEN",
};

// Origin of apps-frontend, the only page allowed to embed us and send the token.
const PARENT_ORIGIN =
	// process.env.NEXT_PUBLIC_APPS_ORIGIN ||
	"http://localhost:3001";
export const SALES_API_URL =
	// process.env.NEXT_PUBLIC_SALES_API_URL ||
	"https://dev-sales-api.providhy.com/api/";

const TokenContext = createContext("");

// Lives in the root layout, so the token survives navigation between pages.
export function TokenProvider({ children }: { children: React.ReactNode }) {
	const [token, setToken] = useState("");

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			if (event.origin !== PARENT_ORIGIN) return;
			if (event.source !== window.parent) return;
			if (event.data?.type === MSG.TOKEN) setToken(event.data.token);
		};
		window.addEventListener("message", onMessage);
		window.parent.postMessage({ type: MSG.READY }, PARENT_ORIGIN);
		return () => window.removeEventListener("message", onMessage);
	}, []);

	return <TokenContext.Provider value={token}>{children}</TokenContext.Provider>;
}

export const useToken = () => useContext(TokenContext);

// Call a path on the Providhy sales API with the bearer token.
async function salesRequest(path: string, token: string, init: RequestInit = {}) {
	const res = await fetch(`${SALES_API_URL}${path}`, {
		...init,
		headers: { ...init.headers, Authorization: `Bearer ${token}` },
	});
	if (!res.ok) {
		// Prefer the backend's own message when it sends one.
		const body = await res.json().catch(() => null);
		throw new Error(
			body?.message || body?.detail || body?.error || `Request failed (${res.status})`,
		);
	}
	return res.json().catch(() => null);
}

export const salesGet = (path: string, token: string, signal?: AbortSignal) =>
	salesRequest(path, token, { signal });

export const salesPost = (path: string, token: string, body: unknown) =>
	salesRequest(path, token, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
