/**
 * The handoff, checked end to end.
 *
 * Run it with all four services up:
 *
 *   oms-backend          npm run dev   :3001
 *   fonepoints-backend   npm run dev   :4000
 *   oms-frontend         npm run dev   :3000
 *   fonepoints-business  npm start     :4200   (not needed by this script)
 *
 *   npm run verify:handoff
 *
 * It walks the chain in the order the portal walks it — portal sign-in, token request with the
 * company API key, the cookie exchange, a scoped order read — and then checks the properties that
 * are easy to lose in a refactor and hard to notice: the cookie flags the iframe depends on, that
 * one merchant cannot see another's orders, that a cross-merchant lookup answers 404 rather than
 * 403, that a revoked token stops working at once, and that the activity log records the token's
 * merchant rather than whatever the request claimed.
 *
 * The one hop it cannot cover is the browser delivering a `postMessage` between two documents.
 * That is covered by `src/providers/AuthProvider.test.tsx` in jsdom, and it is the same mechanism
 * the theme sync already uses on the same channel.
 *
 * Plain Node, no dependencies, so it runs from any of the four repos.
 */

const PORTAL_API = "http://localhost:4000";
const OMS_BACKEND = "http://localhost:3001";
const OMS_FRONTEND = "http://localhost:3000";

let failures = 0;

function check(label, ok, detail = "") {
	console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? " — " + detail : ""}`);
	if (!ok) failures++;
}

/** Collects Set-Cookie into a single Cookie header, since fetch has no cookie jar. */
function jar() {
	const cookies = new Map();
	return {
		absorb(res) {
			for (const raw of res.headers.getSetCookie?.() ?? []) {
				const [pair] = raw.split(";");
				const index = pair.indexOf("=");
				cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
			}
			return res;
		},
		header() {
			return [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
		},
		raw: cookies,
	};
}

async function main() {
	console.log("\n=== 1. The merchant signs in to the Fonepoints portal ===");
	const portal = jar();
	const login = portal.absorb(
		await fetch(`${PORTAL_API}/api/auth/login`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "merchant@fonepoints.local" }),
		}),
	);
	const loginBody = await login.json();
	check(
		"portal issues a session",
		login.ok && portal.raw.has("fp_session"),
		`merchantRef ${loginBody.user?.omsMerchantRef}`,
	);

	console.log("\n=== 2. The portal frontend asks ITS backend for an OMS access token ===");
	const grantRes = await fetch(`${PORTAL_API}/api/oms/token`, {
		method: "POST",
		headers: { cookie: portal.header() },
	});
	const grant = await grantRes.json();
	check(
		"token issued",
		grantRes.ok && typeof grant.accessToken === "string",
		`${String(grant.accessToken).slice(0, 20)}… for ${grant.merchant?.companyName}`,
	);
	check("no expiry on the token", grant.expiresAt === undefined, "it never expires, by design");
	check("the API key is not in the response", !JSON.stringify(grant).includes("oms_ck"));

	console.log("\n=== 3. OMS trades the token for an httpOnly cookie ===");
	const oms = jar();
	const sessionRes = oms.absorb(
		await fetch(`${OMS_FRONTEND}/api/session`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ token: grant.accessToken }),
		}),
	);
	const session = await sessionRes.json();
	const setCookie = (sessionRes.headers.getSetCookie?.() ?? []).join(" ");
	check("session established", sessionRes.ok, `merchant ${session.merchant?.companyName}`);
	check("cookie is HttpOnly", /HttpOnly/i.test(setCookie));
	check("cookie is Secure", /Secure/i.test(setCookie));
	check("cookie is SameSite=None (required in the iframe)", /SameSite=None/i.test(setCookie));
	check("cookie is Partitioned (CHIPS)", /Partitioned/i.test(setCookie));

	console.log("\n=== 4. A screen asks for orders; the proxy attaches the token ===");
	const ordersRes = await fetch(`${OMS_FRONTEND}/api/oms/orders`, {
		headers: { cookie: oms.header() },
	});
	const orders = await ordersRes.json();
	const merchants = [...new Set(orders.map?.((o) => o.merchantId) ?? [])];
	check("orders returned", Array.isArray(orders) && orders.length > 0, `${orders.length} orders`);
	check("scoped to one merchant", merchants.length === 1, merchants.join(","));
	check("scoped to the token's merchant", merchants[0] === grant.merchant.merchantId);

	console.log("\n=== 5. The other merchant's token sees a different set ===");
	const other = jar();
	other.absorb(
		await fetch(`${PORTAL_API}/api/auth/login`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "gadget@fonepoints.local" }),
		}),
	);
	const otherGrant = await (
		await fetch(`${PORTAL_API}/api/oms/token`, {
			method: "POST",
			headers: { cookie: other.header() },
		})
	).json();
	const otherOrders = await (
		await fetch(`${OMS_BACKEND}/api/v1/orders`, {
			headers: { authorization: `Bearer ${otherGrant.accessToken}` },
		})
	).json();
	const otherMerchants = [...new Set(otherOrders.map((o) => o.merchantId))];
	check(
		"different merchant, different orders",
		otherMerchants[0] !== merchants[0] && otherOrders.length !== orders.length,
		`${otherGrant.merchant.companyName}: ${otherOrders.length} orders (${otherMerchants.join(",")})`,
	);

	console.log("\n=== 6. One merchant cannot read the other's order by id ===");
	const victimId = orders[0].omsOrderId;
	const crossRes = await fetch(`${OMS_BACKEND}/api/v1/orders/${victimId}`, {
		headers: { authorization: `Bearer ${otherGrant.accessToken}` },
	});
	const crossBody = await crossRes.json();
	check(
		"answers 404, not 403",
		crossRes.status === 404,
		`${crossRes.status} ${crossBody.error?.code} — a 403 would confirm the id is real`,
	);

	console.log("\n=== 7. A revoked token stops working immediately ===");
	const throwaway = await (
		await fetch(`${OMS_BACKEND}/api/v1/auth/token`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-api-key": "oms_ck_dev_fonepoints_replace_me",
			},
			body: JSON.stringify({ merchantRef: "fp-hamro-mobile" }),
		})
	).json();
	const beforeRevoke = await fetch(`${OMS_BACKEND}/api/v1/auth/me`, {
		headers: { authorization: `Bearer ${throwaway.accessToken}` },
	});
	await fetch(`${OMS_BACKEND}/api/v1/auth/revoke`, {
		method: "POST",
		headers: { authorization: `Bearer ${throwaway.accessToken}` },
	});
	const afterRevoke = await fetch(`${OMS_BACKEND}/api/v1/auth/me`, {
		headers: { authorization: `Bearer ${throwaway.accessToken}` },
	});
	check("accepted before revoke", beforeRevoke.ok);
	check(
		"refused after revoke",
		afterRevoke.status === 401,
		"no signature to trust — the record is re-read",
	);

	console.log("\n=== 8. A merchant cannot forge the audit trail or jump the lifecycle ===");
	// Minting a fresh token re-issues for merchant-a, so re-fetch an order it owns.
	const freshGrant = await (
		await fetch(`${PORTAL_API}/api/oms/token`, {
			method: "POST",
			headers: { cookie: portal.header() },
		})
	).json();
	const auth = { authorization: `Bearer ${freshGrant.accessToken}` };
	const mine = await (await fetch(`${OMS_BACKEND}/api/v1/orders`, { headers: auth })).json();

	const preparing = mine.find((o) => o.status === "preparing");
	const deliveredDirect = await fetch(
		`${OMS_BACKEND}/api/v1/orders/${preparing.omsOrderId}/status`,
		{
			method: "PATCH",
			headers: { ...auth, "content-type": "application/json" },
			body: JSON.stringify({ status: "delivered" }),
		},
	);
	check(
		"cannot set Delivered by hand",
		deliveredDirect.status === 400,
		"only a rider's voucher redemption reaches it",
	);

	const overrideAttempt = await fetch(
		`${OMS_BACKEND}/api/v1/orders/${preparing.omsOrderId}/status`,
		{
			method: "PATCH",
			headers: { ...auth, "content-type": "application/json" },
			body: JSON.stringify({ status: "failed", override: true }),
		},
	);
	check("cannot claim a CS override", overrideAttempt.status === 403);

	const ready = await fetch(`${OMS_BACKEND}/api/v1/orders/${preparing.omsOrderId}/status`, {
		method: "PATCH",
		headers: { ...auth, "content-type": "application/json" },
		body: JSON.stringify({ status: "ready_for_delivery" }),
	});
	check("the legal transition is allowed", ready.ok);

	const detail = await (
		await fetch(`${OMS_BACKEND}/api/v1/orders/${preparing.omsOrderId}`, { headers: auth })
	).json();
	const last = detail.activity.at(-1);
	check(
		"the activity entry names the token's merchant",
		last.actor === freshGrant.merchant.merchantId,
		`actor "${last.actor}" — derived from the token, not the request body`,
	);

	console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
	process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
	console.error("verification crashed:", error);
	process.exit(1);
});
