# Fonepoints: the customer side

Background for anyone building OMS screens. Sources: fonepoints.com (home, How it works,
FAQs, Terms) as read on 2026-09-29, plus screenshots of the Fonepoints mobile app shared
by the team. The public site is thin on redemption mechanics, so the app screenshots are the
main source for the redeem flow. Check this file against the live product before relying on
details.

## What Fonepoints is
- A loyalty platform in **Nepal**. Customers earn points on digital payments (Fonepay QR
  and online payments, utility bills paid through mobile banking) and redeem them at
  partner merchants ("redemption partners"). Currency is NPR ("Rs").
- Points can come from **Fonepay** (imported in the Fonepoints app) and **eSewa** (transferred
  after consent in the eSewa app). Accounts that use the same phone number on both are
  combined into one Fonepoints account.
- Customers sign up through a partner mobile app. **The login identity is the mobile
  number.** OMS therefore always has the customer's name, photo (if set), email and phone from
  the account.
- Earning has a standard monthly limit, and partners can set their own limits.
- There are 800+ deals: discounts, freebies, products, experiences. Partner examples on the site:
  Bajeko Sekuwa and Ghar ko Achar (food), Ultima watches and earbuds, Webor TVs (electronics),
  Blush Rush Nepal (beauty).
- There are no fees for users (per the Terms).

## Offer types seen in the app
- **In-Store:** the customer shows a QR or voucher code at the counter before billing. This is
  not an OMS order.
- **Delivery:** the customer fills in a delivery form while redeeming. **This is what creates
  an OMS order.**

## Deal listing (what an order's item is)
An order's item is a Fonepoints **deal**, not a shop product line. From the app's deal page
(e.g. Ultima Atom Buds 2, Sikenai 60W data cable):
- A large **deal photo**.
- A **title** in the form "<Partner>-<offer>", e.g. "Ultima Lifestyle-Grab Your Ultima Atom Buds 2
  (Wireless Earbud)!" or "HiFuture-Get Sikenai SX 12 60W Braided Data Cable".
- A **price** of points, optionally plus cash: "Rs 1,923 + 174pts" or "Rs 555 + 55pts". Some deals
  are points only.
- A struck-through **Market price** (e.g. Rs. 3,499), offers left, an "Available till" date, and
  partner locations.
- An **Overview** with a channel chip (e.g. "Online") and redemption instructions, often including
  "Delivery Charge Applicable!" and "Redemption Channel: Online Delivery".
- One redemption is one unit (quantity 1).

In OMS: `items[0]` holds `name` (deal title), `imageUrl`, `marketPrice` and `quantity`. The order holds
`orderValue` (points) and `cashAmount` (Rs, 0 when points only), and `formatOrderValue` renders
them like the app: "Rs 1,923 + 174 pts". The mock uses DummyJSON product photos as stand-ins.

## Redemption success screen (in-store example)
- "Redemption successful" with a QR code and a **voucher code** (e.g. `8VMI05`) that can be copied.
- Shows **Redeemed points** (e.g. 2 points) and **You saved** (e.g. Rs 200).
- Offer card: merchant logo, offer title (e.g. "Blush Rush Nepal-Flat 15% Off On Skin…"),
  **Valid till** date and time, and the redemption type label (e.g. "In-Store").
- "View vouchers" opens the customer's voucher wallet.

In OMS the voucher code stays hidden from the merchant UI. The rider enters it at the door to
validate delivery (see docs/domain-rules.md → Rider validation).

## Redeem form for delivery offers
The fields, in the order the app shows them:

| App label | Input | OMS field |
|---|---|---|
| Name | text ("Your Name") | `delivery.name` |
| Contact Number | text ("Your Number") | `delivery.phone` |
| Location | multi-line ("Your Address") | `delivery.address` (+ short area in `location`) |
| Delivery date | date picker | `deliveryDate` |
| (under the delivery charge notice) | multi-line ("Enter long text") | `delivery.note` |
| Remarks | multi-line | `delivery.remarks` |

Then **Next** (the redemption confirmation follows).

Copy the customer sees on the form:
- Delivery timeframe: **4–5 business days inside the valley, 7–10 days outside the valley**.
- "Delivery charges are estimated at **NPR 250 within the Kathmandu Valley** and **from NPR 500
  outside the valley**, and may vary depending on the delivery location, as well as the size
  and weight of the product."

What this means for OMS:
- The customer provides everything, and the merchant only sees it. The order detail page shows
  two read-only cards. **Customer** holds the profile from login (name, phone, location).
  **Delivery details** holds this form (name, phone, location, date, note, remarks). The name
  and number on the form can differ from the profile.
- Blank optional answers are normal. Show "Not provided" instead of hiding the field.

## Useful links
- https://fonepoints.com/ (home)
- https://fonepoints.com/get-started (how it works)
- https://fonepoints.com/faqs
- https://fonepoints.com/campaigns
- https://fonepoints.com/terms-conditions
- https://fonepoints.com/privacy-policy
