import type {
	ActivityLogEntry,
	Order,
	OrderCategory,
	OrderItem,
	OrderStatus,
	RiderDetails,
	DeliveryRequest,
} from "@/lib/domain/types";
import { MAX_VALIDATION_ATTEMPTS } from "@/lib/domain/types";
import { ORDER_STATUS_SEQUENCE } from "@/lib/domain/status";

const DAY = 24 * 60 * 60 * 1000;

/** Deterministic PRNG (mulberry32) so demo data is stable across restarts. */
function createRandom(seed: number) {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const random = createRandom(20260928);
const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
const between = (min: number, max: number) => Math.floor(min + random() * (max - min + 1));

/**
 * Delivery deals as listed in the Fonepoints app: "<Partner>-<offer>" titles, a deal photo, a
 * points price with optional cash on top, and the struck-through market price. Photos are
 * DummyJSON product shots standing in for the real deal images (they need network access).
 */
interface Deal {
	category: OrderCategory;
	name: string;
	image: string;
	points: number;
	/** Rs paid on top of the points; 0 for points-only deals. */
	cash: number;
	marketPrice: number;
}

const DEAL_IMAGE_BASE = "https://cdn.dummyjson.com/product-images";

const DEALS: Deal[] = [
	{
		category: "electronics",
		name: "Ultima Lifestyle-Grab Your Ultima Atom Buds 2 (Wireless Earbud)!",
		image: "mobile-accessories/beats-flex-wireless-earphones",
		points: 174,
		cash: 1923,
		marketPrice: 3499,
	},
	{
		category: "beauty_wellness",
		name: "Blush Rush Nepal-Essence Lash Princess Mascara",
		image: "beauty/essence-mascara-lash-princess",
		points: 350,
		cash: 0,
		marketPrice: 750,
	},
	{
		category: "electronics",
		name: "HiFuture-Get Sikenai SX 12 60W Braided Data Cable",
		image: "mobile-accessories/apple-iphone-charger",
		points: 55,
		cash: 555,
		marketPrice: 1500,
	},
	{
		category: "grocery",
		name: "Himalayan Bee-Pure Wild Honey Jar (500g)",
		image: "groceries/honey-jar",
		points: 600,
		cash: 0,
		marketPrice: 950,
	},
	{
		category: "shopping",
		name: "Watch Station-Brown Leather Belt Watch",
		image: "mens-watches/brown-leather-belt-watch",
		points: 200,
		cash: 2499,
		marketPrice: 4999,
	},
	{
		category: "electronics",
		name: "Ultima Lifestyle-Ultima Watch Magic Pro Smartwatch",
		image: "mobile-accessories/apple-watch-series-4-gold",
		points: 300,
		cash: 3499,
		marketPrice: 6999,
	},
	{
		category: "fitness",
		name: "Sports Arena-English Willow Cricket Bat",
		image: "sports-accessories/cricket-bat",
		points: 250,
		cash: 2999,
		marketPrice: 5500,
	},
	{
		category: "beauty_wellness",
		name: "Blush Rush Nepal-Eyeshadow Palette with Mirror",
		image: "beauty/eyeshadow-palette-with-mirror",
		points: 80,
		cash: 899,
		marketPrice: 1800,
	},
	{
		category: "electronics",
		name: "Hamro Mobile-MagSafe 5000mAh Power Bank",
		image: "mobile-accessories/apple-magsafe-battery-pack",
		points: 150,
		cash: 1899,
		marketPrice: 3200,
	},
	{
		category: "grocery",
		name: "Bhatbhateni Online-Nescafé Classic Coffee (200g)",
		image: "groceries/nescafe-coffee",
		points: 720,
		cash: 0,
		marketPrice: 1100,
	},
	{
		category: "shopping",
		name: "Sunglass Hub-Classic Polarised Sunglasses",
		image: "sunglasses/classic-sun-glasses",
		points: 100,
		cash: 1299,
		marketPrice: 2500,
	},
	{
		category: "electronics",
		name: "Gadget Ghar-15W Wireless Charging Pad",
		image: "mobile-accessories/apple-airpower-wireless-charger",
		points: 900,
		cash: 0,
		marketPrice: 1800,
	},
	{
		category: "fitness",
		name: "Sports Arena-Feather Shuttlecock (Tube of 12)",
		image: "sports-accessories/feather-shuttlecock",
		points: 800,
		cash: 0,
		marketPrice: 1450,
	},
	{
		category: "shopping",
		name: "Baltra-400W Hand Blender",
		image: "kitchen-accessories/hand-blender",
		points: 150,
		cash: 1799,
		marketPrice: 3200,
	},
	{
		category: "electronics",
		name: "HiFuture-Selfie Stick Monopod with Remote",
		image: "mobile-accessories/selfie-stick-monopod",
		points: 450,
		cash: 0,
		marketPrice: 1200,
	},
	{
		category: "beauty_wellness",
		name: "Bhatbhateni Online-Olay Ultra Moisture Body Wash",
		image: "skin-care/olay-ultra-moisture-shea-butter-body-wash",
		points: 650,
		cash: 0,
		marketPrice: 1300,
	},
	{
		category: "electronics",
		name: "Gadget Ghar-Echo Plus Smart Speaker",
		image: "mobile-accessories/amazon-echo-plus",
		points: 500,
		cash: 4999,
		marketPrice: 9500,
	},
];

function dealItem(deal: Deal): OrderItem {
	return {
		name: deal.name,
		quantity: 1,
		imageUrl: `${DEAL_IMAGE_BASE}/${deal.image}/thumbnail.webp`,
		marketPrice: deal.marketPrice,
	};
}

const FIRST_NAMES = [
	"Maria",
	"Juan",
	"Ana",
	"Liza",
	"Ramon",
	"Miguel",
	"Nora",
	"Grace",
	"Isko",
	"Ella",
	"Ferdie",
	"Carmela",
	"Paolo",
	"Bea",
	"Joshua",
	"Andrea",
	"Mark",
	"Patricia",
	"Kevin",
	"Angelica",
	"Rafael",
	"Kristine",
	"Jerome",
	"Camille",
	"Adrian",
	"Jasmine",
	"Nico",
	"Sofia",
	"Gabriel",
	"Bianca",
	"Enzo",
	"Trisha",
	"Marco",
	"Denise",
	"Luis",
	"Rica",
];
const LAST_NAMES = [
	"Santos",
	"Dela Cruz",
	"Reyes",
	"Gomez",
	"Cruz",
	"Torres",
	"Villanueva",
	"Aquino",
	"Domingo",
	"Navarro",
	"Ocampo",
	"Garcia",
	"Mendoza",
	"Bautista",
	"Ramos",
	"Castillo",
	"Flores",
	"Rivera",
	"Lim",
	"Tan",
	"Soriano",
	"Salazar",
	"Castro",
	"Mercado",
	"Pascual",
];
/** Delivery areas (shown in lists) with streets used to build the full address. */
const AREAS: { area: string; streets: string[] }[] = [
	{
		area: "Kathmandu",
		streets: ["Baneshwor", "Baluwatar", "Maharajgunj", "Thamel", "Koteshwor", "Chabahil"],
	},
	{ area: "Lalitpur", streets: ["Jhamsikhel", "Kupondole", "Pulchowk", "Sanepa", "Imadol"] },
	{ area: "Bhaktapur", streets: ["Suryabinayak", "Thimi", "Sallaghari"] },
	{ area: "Pokhara", streets: ["Lakeside", "Mahendrapul", "Chipledhunga"] },
	{ area: "Chitwan", streets: ["Bharatpur Height", "Narayangarh"] },
	{ area: "Butwal", streets: ["Traffic Chowk", "Golpark"] },
	{ area: "Biratnagar", streets: ["Main Road", "Bargachhi"] },
];
const LANDMARKS = [
	"near Bhatbhateni",
	"opposite Everest Bank",
	"behind the ward office",
	"next to the Shiva temple",
	"near the petrol pump",
	"above Himalayan Java",
];
const CHARGE_NOTES = [
	"Okay with the delivery charge.",
	"Will pay the delivery charge on arrival.",
	"Please confirm the charge by phone before sending.",
	"Understood, NPR 250 is fine.",
];
const REMARKS = [
	"Call before arriving, the gate stays locked.",
	"Deliver after 5 PM on weekdays.",
	"Leave it with the security guard if I am out.",
	"It's a gift, please don't include the bill.",
	"Second floor, blue gate.",
];
const RIDER_NAMES = [
	"Paolo Ramos",
	"Carlo Villanueva",
	"Eduardo Lim",
	"Jun Bautista",
	"Ricky Torres",
	"Mark Salazar",
	"Alvin Castro",
	"Dennis Ocampo",
	"Wilfredo Cruz",
	"Jomar Reyes",
	"Arnel Santos",
	"Rodel Garcia",
];
const EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com"];

/** Weighted status mix for generated orders — mostly in-flight or delivered. */
const STATUS_WEIGHTS: [OrderStatus, number][] = [
	["preparing", 22],
	["ready_for_delivery", 18],
	["delivering", 20],
	["delivered", 32],
	["failed", 8],
];

function pickStatus(): OrderStatus {
	let roll = random() * 100;
	for (const [status, weight] of STATUS_WEIGHTS) {
		roll -= weight;
		if (roll < 0) return status;
	}
	return "delivered";
}

function slug(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z]+/g, ".")
		.replace(/^\.|\.$/g, "");
}

function randomRider(): RiderDetails {
	return {
		name: pick(RIDER_NAMES),
		phone: nepalMobile(),
		vehicleNumber: `NBC-${between(1000, 9999)}`,
	};
}

/** Nepali mobile number, e.g. "+977 984 123 4567". */
function nepalMobile() {
	return `+977 98${between(0, 6)} ${between(100, 999)} ${String(between(0, 9999)).padStart(4, "0")}`;
}

/**
 * A location as a customer types it: sometimes just the area ("Sanepa, Lalitpur"), sometimes the
 * full address ("House 82, Sanepa, Lalitpur, behind the ward office").
 */
function randomAddress(street: string, area: string, fullChance: number) {
	if (random() >= fullChance) return `${street}, ${area}`;
	const house = `House ${between(1, 120)}, ${street}, ${area}`;
	return random() < 0.7 ? `${house}, ${pick(LANDMARKS)}` : house;
}

/**
 * Redeem-form answers. Most customers deliver to themselves at home, so name, number and area
 * usually match the profile; the rest order for someone else or somewhere else. The optional
 * text fields are often left blank.
 */
function randomDelivery(
	profile: { name: string; phone: string },
	home: { area: string; street: string },
): DeliveryRequest & { area: string } {
	const forSomeoneElse = !profile.name || random() < 0.2;
	const elsewhere = random() < 0.3;
	const { area, streets } = elsewhere ? pick(AREAS) : { area: home.area, streets: [home.street] };
	return {
		area,
		name: forSomeoneElse ? `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}` : profile.name,
		phone: forSomeoneElse ? nepalMobile() : profile.phone,
		// Delivery addresses are usually written out in full so the rider can find the door.
		address: randomAddress(pick(streets), area, 0.85),
		note: random() < 0.6 ? pick(CHARGE_NOTES) : "",
		remarks: random() < 0.5 ? pick(REMARKS) : "",
	};
}

const AVATAR_BASE_URL =
	"https://cdn.jsdelivr.net/gh/Radian-os/radian-resources@v1.0.2/packages/avatars/src";
const AVATAR_COUNT = 200;
let avatarCounter = 0;

function baseOrder(
	overrides: Partial<Order> & Pick<Order, "omsOrderId" | "status">,
	index = 0,
): Order {
	const deal = DEALS[index % DEALS.length];
	const createdAt =
		overrides.createdAt ?? new Date(Date.now() - index * 3 * 60 * 60 * 1000).toISOString();
	const name = overrides.customerName ?? `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
	const emailLocal = name ? slug(name) : `guest${between(100, 999)}`;
	// Roughly 40% of customers have a profile photo; the rest get initials.
	const hasPhoto = random() < 0.4;
	const home = pick(AREAS);
	const homeStreet = pick(home.streets);
	const customerPhone = nepalMobile();
	const { area: deliveryArea, ...delivery } = randomDelivery(
		{ name, phone: customerPhone },
		{ area: home.area, street: homeStreet },
	);

	return {
		salesOrderId: `SO-${overrides.omsOrderId}`,
		fonepointsReferenceId: `FP-REF-${overrides.omsOrderId}`,
		merchantId: "merchant-a",
		customerName: name,
		customerEmail: `${emailLocal}@${pick(EMAIL_DOMAINS)}`,
		customerAvatarUrl: hasPhoto
			? `${AVATAR_BASE_URL}/${(avatarCounter++ % AVATAR_COUNT) + 1}.png`
			: null,
		customerPhone,
		// Profile locations are free text: about half are just the area, the rest a full address.
		customerLocation: randomAddress(homeStreet, home.area, 0.5),
		category: deal.category,
		location: deliveryArea,
		// Fonepoints quotes 4–5 business days inside the valley and 7–10 outside.
		deliveryDate: new Date(Date.parse(createdAt) + between(4, 10) * DAY).toISOString(),
		delivery,
		voucherCode: `VOUCHER-${overrides.omsOrderId}`,
		items: [dealItem(deal)],
		orderValue: deal.points,
		cashAmount: deal.cash,
		valueType: deal.cash > 0 ? "points_money" : "points",
		rider: null,
		validationAttemptsRemaining: MAX_VALIDATION_ATTEMPTS,
		voucherRedeemed: false,
		pendingStatusSync: false,
		createdAt,
		updatedAt: createdAt,
		...overrides,
	};
}

/**
 * Hand-written orders covering every lifecycle status plus the edge cases called
 * out in CLAUDE.md → "Mock layer": a duplicate reference ID, an order one
 * attempt from being blocked, a blocked order, an already-redeemed
 * voucher, a pending reconciliation, and a failed status sync.
 */
const scenarioOrders: Order[] = [
	baseOrder({ omsOrderId: "OMS-1001", status: "preparing", customerName: "Maria Santos" }, 0),
	baseOrder(
		{ omsOrderId: "OMS-1002", status: "ready_for_delivery", customerName: "Juan Dela Cruz" },
		1,
	),
	baseOrder(
		{
			omsOrderId: "OMS-1003",
			status: "delivering",
			customerName: "Ana Reyes",
			voucherCode: "VALID-CODE",
			rider: { name: "Paolo Ramos", phone: "+977 980 555 0110", vehicleNumber: "NBC-1234" },
		},
		2,
	),
	baseOrder(
		{
			omsOrderId: "OMS-1004",
			status: "delivered",
			customerName: "Liza Gomez",
			voucherRedeemed: true,
			validationAttemptsRemaining: MAX_VALIDATION_ATTEMPTS - 1,
			rider: { name: "Carlo Villanueva", phone: "+977 980 555 0111", vehicleNumber: "NBC-5678" },
		},
		3,
	),
	baseOrder(
		{
			omsOrderId: "OMS-1005",
			status: "failed",
			customerName: "Ramon Cruz",
			rider: { name: "Eduardo Lim", phone: "+977 980 555 0112", vehicleNumber: "NBC-9012" },
		},
		4,
	),
	baseOrder(
		{
			omsOrderId: "OMS-1006",
			status: "preparing",
			customerName: "Miguel Torres",
			merchantId: "merchant-b",
		},
		5,
	),
	baseOrder(
		{
			omsOrderId: "OMS-2001",
			status: "preparing",
			customerName: "Dupe Test Customer",
			fonepointsReferenceId: "FP-REF-DUPLICATE-001",
		},
		6,
	),
	baseOrder(
		{
			omsOrderId: "OMS-2002",
			status: "delivering",
			customerName: "Nora Villanueva",
			voucherCode: "MISMATCH-CODE",
			validationAttemptsRemaining: 1,
			rider: { name: "Jun Bautista", phone: "+977 980 555 0113", vehicleNumber: "NBC-3456" },
		},
		7,
	),
	baseOrder(
		{
			omsOrderId: "OMS-2003",
			status: "delivering",
			customerName: "Boy Fernandez",
			voucherCode: "MISMATCH-CODE",
			validationAttemptsRemaining: 0,
			rider: { name: "Ricky Torres", phone: "+977 980 555 0114", vehicleNumber: "NBC-7890" },
		},
		8,
	),
	baseOrder(
		{
			omsOrderId: "OMS-2004",
			status: "delivered",
			customerName: "Grace Aquino",
			voucherCode: "ALREADY-REDEEMED",
			voucherRedeemed: true,
			rider: { name: "Mark Salazar", phone: "+977 980 555 0115", vehicleNumber: "NBC-2345" },
		},
		9,
	),
	baseOrder(
		{
			omsOrderId: "OMS-2005",
			status: "delivering",
			customerName: "Isko Domingo",
			voucherCode: "VALID-CODE",
			voucherRedeemed: true,
			rider: { name: "Alvin Castro", phone: "+977 980 555 0116", vehicleNumber: "NBC-6789" },
		},
		10,
	),
	baseOrder(
		{
			omsOrderId: "OMS-2006",
			status: "delivered",
			customerName: "Ella Navarro",
			voucherRedeemed: true,
			pendingStatusSync: true,
			rider: { name: "Dennis Ocampo", phone: "+977 980 555 0117", vehicleNumber: "NBC-0123" },
		},
		11,
	),
	baseOrder(
		{
			omsOrderId: "OMS-2007",
			status: "delivering",
			customerName: "Ferdie Ocampo",
			voucherCode: "REDEMPTION-FAILS",
			rider: { name: "Wilfredo Cruz", phone: "+977 980 555 0118", vehicleNumber: "NBC-4567" },
		},
		12,
	),
];

/** Number of generated demo orders on top of the scenario orders. */
const DEMO_ORDER_COUNT = 240;

/**
 * Bulk demo orders for list screens: spread over the last ~60 days, mixed
 * categories and statuses, ~10% without a customer name, ~40% with a photo.
 * Every 8th order belongs to merchant-b so merchant scoping stays visible.
 */
const demoOrders: Order[] = Array.from({ length: DEMO_ORDER_COUNT }, (_, i) => {
	const index = i + scenarioOrders.length;
	const status = pickStatus();
	const inFlight = status === "delivering" || status === "delivered" || status === "failed";
	const createdAt = new Date(Date.now() - between(1, 60 * 24) * 60 * 60 * 1000).toISOString();
	return baseOrder(
		{
			omsOrderId: `OMS-${3001 + i}`,
			status,
			merchantId: i % 8 === 7 ? "merchant-b" : "merchant-a",
			createdAt,
			...(random() < 0.1 ? { customerName: "" } : {}),
			rider: inFlight ? randomRider() : null,
			voucherRedeemed: status === "delivered",
			validationAttemptsRemaining:
				status === "delivered" ? between(3, MAX_VALIDATION_ATTEMPTS) : MAX_VALIDATION_ATTEMPTS,
		},
		index,
	);
});

export const seedOrders: Order[] = [...scenarioOrders, ...demoOrders];

type HistoryStep = Omit<ActivityLogEntry, "id" | "omsOrderId" | "timestamp"> & {
	/** Minutes after the previous step. */
	gap: number;
};

function statusStep(from: OrderStatus, to: OrderStatus, actor: string, gap: number): HistoryStep {
	return {
		type: "status_changed",
		message: `Status changed from ${from} to ${to}`,
		actor,
		gap,
		metadata: { previousStatus: from, newStatus: to, override: false },
	};
}

/** A CS status override, audited like the status route records it (PRD §10). */
function overrideStep(from: OrderStatus, to: OrderStatus, gap: number): HistoryStep {
	return {
		type: "cs_override",
		message: `cs-agent overrode status from ${from} to ${to}`,
		actor: "cs-agent",
		gap,
		metadata: { previousStatus: from, newStatus: to, override: true, actorRole: "cs-agent" },
	};
}

/**
 * The activity an order would have logged to reach its seeded state: creation, mark ready, rider
 * assignment, delivering, failed validation attempts, then delivered or failed. Mirrors what the
 * mock routes append, so seeded and live orders read the same in the Activity card and tracker.
 */
function orderHistory(order: Order): ActivityLogEntry[] {
	const { status, rider, merchantId } = order;
	const steps: HistoryStep[] = [
		{
			type: "order_created",
			message: `Order created from Sales Order ${order.salesOrderId}`,
			actor: "system",
			gap: 0,
		},
	];
	const failedAt: OrderStatus =
		status !== "failed"
			? status
			: rider
				? "delivering"
				: random() < 0.5
					? "ready_for_delivery"
					: "preparing";
	const reached = (target: OrderStatus) => {
		const at = status === "failed" ? failedAt : status;
		return ORDER_STATUS_SEQUENCE.indexOf(at) >= ORDER_STATUS_SEQUENCE.indexOf(target);
	};

	if (reached("ready_for_delivery")) {
		steps.push(statusStep("preparing", "ready_for_delivery", merchantId, between(30, 120)));
	}
	if (reached("delivering") && rider) {
		steps.push({
			type: "rider_assigned",
			message: `Rider ${rider.name} assigned`,
			actor: merchantId,
			gap: between(10, 40),
			metadata: { ...rider },
		});
		steps.push(statusStep("ready_for_delivery", "delivering", merchantId, 1));
	}
	const failedAttempts = MAX_VALIDATION_ATTEMPTS - order.validationAttemptsRemaining;
	for (let i = 0; i < failedAttempts; i++) {
		steps.push({
			type: "validation_attempt",
			message: "Validation attempt failed: mismatch",
			actor: "rider",
			gap: between(5, 20),
			metadata: { outcome: "mismatch" },
		});
	}
	if (status === "delivered") {
		steps.push({
			type: "validation_attempt",
			message: "Voucher validated — order marked delivered",
			actor: "rider",
			gap: between(20, 90),
			metadata: { outcome: "success" },
		});
		steps.push(statusStep("delivering", "delivered", "system", 0));
	}
	if (status === "failed") {
		// Some failures are CS calls (e.g. the customer cancelled by phone); OMS-1005 always is.
		const byCs = order.omsOrderId === "OMS-1005" || random() < 0.4;
		steps.push(
			byCs
				? overrideStep(failedAt, "failed", between(30, 120))
				: statusStep(failedAt, "failed", "system", between(30, 120)),
		);
	}

	// Squeeze the history into the time since creation for recent orders so nothing is in the future.
	const created = Date.parse(order.createdAt);
	const total = steps.reduce((sum, step) => sum + step.gap, 0) * 60_000;
	const room = Math.max(0, Date.now() - created - 60_000);
	const scale = total > room ? room / total : 1;

	let elapsed = 0;
	return steps.map(({ gap, ...step }, index) => {
		elapsed += gap * 60_000 * scale;
		return {
			...step,
			id: `seed-activity-${order.omsOrderId}-${index}`,
			omsOrderId: order.omsOrderId,
			timestamp: new Date(created + elapsed).toISOString(),
		};
	});
}

export const seedActivityLog: ActivityLogEntry[] = seedOrders.flatMap(orderHistory);
