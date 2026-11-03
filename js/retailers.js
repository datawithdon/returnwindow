// Bundled US retailer return policies, checked 2026-11-02.
//
// Every number here comes from the retailer's own website. `verified` says how:
//   "page"   — the policy page itself was read.
//   "search" — the page blocked automated reading, so the figure comes from a
//              search restricted to the retailer's own domain. Treat as
//              "probably right, confirm before a close call".
// Nothing is filled in from memory. Where sources disagreed or were old, the
// shorter window was kept and a note says so: showing a deadline that is too
// early costs nothing, one that is too late costs a refund.
//
// Shape:
//   days      standard window in days (null + anytime:true = no stated limit)
//   clock     "purchase" | "delivery" — what starts the clock for online orders
//   categories[] { key, label, days?, final?, exchange?, match?[] }
//              final: not returnable; exchange: exchange only; match: keywords
//              used to guess the category from an item name on a receipt
//   members[] { key, label, days } — replaces the standard window only
//   holiday[] { from, to, returnBy?, startOn?, member?, excludes?[] }
//              purchases in [from, to] get until returnBy, or have the clock
//              start on startOn instead of the purchase date
//   aliases[] receipt header text that identifies the store (upper case)

export const CHECKED = "2026-11-02";

export const RETAILERS = [
  {
    id: "amazon", name: "Amazon", domain: "amazon.com", aliases: ["AMAZON.COM", "AMAZON"],
    days: 30, clock: "delivery", verified: "search",
    source: "https://www.amazon.com/gp/help/customer/display.html?nodeId=GKM69DUUYKQWKWX7",
    notes: ["Most items shipped from Amazon.com: 30 days of delivery. Items from third-party sellers follow the seller's policy.", "Some categories differ; check the return window shown in Your Orders."],
    categories: [], members: [], holiday: [],
  },
  {
    id: "walmart", name: "Walmart", domain: "walmart.com", aliases: ["WALMART", "WAL-MART", "WAL*MART", "SAVE MONEY. LIVE BETTER"],
    days: 90, clock: "purchase", verified: "search",
    source: "https://www.walmart.com/help/article/walmart-standard-return-policy/adc0dfb692954e67a4de206fb8d9e03a",
    notes: ["Marketplace (third-party) items: usually 30 days, set by the seller.", "Walmart has extended holiday returns in past years; the dates for 2026 were not confirmed, so none are applied here."],
    categories: [
      { key: "electronics", label: "Most consumer electronics", days: 30, match: ["TV", "LAPTOP", "TABLET", "IPAD", "HEADPHONE", "EARBUD", "AIRPODS", "CAMERA", "CONSOLE", "SPEAKER", "MONITOR", "PRINTER"] },
      { key: "phones", label: "Wireless phones", days: 14, match: ["PHONE", "IPHONE", "GALAXY", "PIXEL", "MOTO"] },
    ],
    members: [], holiday: [],
  },
  {
    id: "target", name: "Target", domain: "target.com", aliases: ["TARGET", "TARGET.COM", "EXPECT MORE. PAY LESS"],
    days: 90, clock: "purchase", verified: "page",
    source: "https://www.target.com/help/article/000061980",
    notes: ["Most unopened items in new condition: 90 days.", "Holiday 2026: for purchases Nov 1 – Dec 24 the return window starts Dec 26 (target.com/help/article/000088565)."],
    categories: [
      { key: "owned-brand", label: "Target Owned Brand items", days: 365, match: ["GOOD & GATHER", "UP&UP", "UP & UP", "THRESHOLD", "CAT & JACK", "ROOM ESSENTIALS", "UNIVERSAL THREAD", "A NEW DAY", "GOODFELLOW", "HEARTH & HAND", "MONDAY BODY", "ALL IN MOTION", "WONDERSHOP", "SMARTLY", "FAVORITE DAY"] },
      { key: "electronics", label: "Electronics & entertainment (not Apple/Beats)", days: 30, match: ["TV", "LAPTOP", "TABLET", "HEADPHONE", "EARBUD", "CAMERA", "CONSOLE", "SPEAKER", "MONITOR", "NINTENDO", "PLAYSTATION", "XBOX"] },
      { key: "apple", label: "Apple & Beats products, mobile phones", days: 14, match: ["APPLE", "IPHONE", "IPAD", "AIRPODS", "MACBOOK", "BEATS", "PHONE"] },
      { key: "media-opened", label: "Opened music, movies, games, software", exchange: true },
    ],
    members: [{ key: "circle-card", label: "Target Circle Card / Circle 360", days: 120 }],
    holiday: [{ from: "2026-11-01", to: "2026-12-24", startOn: "2026-12-26" }],
  },
  {
    id: "costco", name: "Costco", domain: "costco.com", aliases: ["COSTCO", "COSTCO WHOLESALE"],
    days: null, anytime: true, clock: "delivery", verified: "page",
    source: "https://customerservice.costco.com/app/answers/answer_view/a_id/1191",
    notes: ["Risk-free 100% satisfaction guarantee: no time limit stated for most merchandise.", "Electronics and major appliances: 90 days from the date you received them."],
    categories: [
      { key: "electronics", label: "Electronics (TVs, computers, tablets, phones, cameras, drones, wearables…)", days: 90, match: ["TV", "LAPTOP", "COMPUTER", "TABLET", "IPAD", "PHONE", "IPHONE", "CAMERA", "DRONE", "WATCH", "PROJECTOR", "MONITOR", "MACBOOK"] },
      { key: "appliances", label: "Major appliances", days: 90, match: ["REFRIGERATOR", "FRIDGE", "FREEZER", "WASHER", "DRYER", "DISHWASHER", "RANGE", "COOKTOP"] },
      { key: "gift-cards", label: "Gift cards & tickets", final: true, match: ["GIFT CARD", "TICKET"] },
    ],
    members: [], holiday: [],
  },
  {
    id: "bestbuy", name: "Best Buy", domain: "bestbuy.com", aliases: ["BEST BUY", "BESTBUY"],
    days: 15, clock: "delivery", verified: "page",
    source: "https://www.bestbuy.com/site/help-topics/return-exchange-policy/pcmcat260800050014.c",
    notes: ["Clock starts the day you receive the product.", "Restocking fees can apply to drones, cameras, lenses, camcorders and projectors if opened.", "Major appliances: call Best Buy for return options."],
    categories: [
      { key: "activatable", label: "Phones, cellular tablets & wearables, hotspots", days: 14, match: ["PHONE", "IPHONE", "GALAXY", "PIXEL", "CELLULAR", "HOTSPOT", "5G", "LTE"] },
      { key: "media-opened", label: "Opened software, movies, music, games, books", exchange: true },
    ],
    members: [{ key: "plus-total", label: "My Best Buy Plus / Total", days: 60 }],
    holiday: [
      { from: "2026-10-30", to: "2026-12-31", returnBy: "2027-01-15", excludes: ["activatable"] },
      { from: "2026-10-30", to: "2026-12-03", returnBy: "2027-01-31", member: "plus-total", excludes: ["activatable"] },
    ],
  },
  {
    id: "apple", name: "Apple", domain: "apple.com", aliases: ["APPLE STORE", "APPLE.COM", "APPLE INC"],
    days: 14, clock: "delivery", verified: "page",
    source: "https://www.apple.com/shop/open/salespolicies",
    notes: ["14 days from the date you receive the product, in original condition with all parts and packaging."],
    categories: [{ key: "gift-cards", label: "Apple Gift Cards", final: true, match: ["GIFT CARD"] }],
    members: [], holiday: [],
  },
  {
    id: "homedepot", name: "The Home Depot", domain: "homedepot.com", aliases: ["HOME DEPOT", "THE HOME DEPOT", "HOMEDEPOT.COM", "MORE SAVING. MORE DOING"],
    days: 90, clock: "purchase", verified: "search",
    source: "https://www.homedepot.com/c/Return_Policy",
    notes: ["Perennials, trees, roses and shrubs have a one-year guarantee (store credit)."],
    categories: [
      { key: "appliances", label: "Major appliances (48 hours)", days: 2, match: ["REFRIGERATOR", "FRIDGE", "WASHER", "DRYER", "RANGE", "DISHWASHER"] },
      { key: "seasonal-7", label: "Dehumidifiers, generators, AC units, pressure washers, pumps, portable heaters", days: 7, match: ["DEHUMIDIFIER", "GENERATOR", "AIR CONDITIONER", "PRESSURE WASHER", "PUMP", "HEATER"] },
    ],
    members: [{ key: "hd-card", label: "Home Depot Consumer / Pro Xtra Credit Card", days: 365 }],
    holiday: [],
  },
  {
    id: "lowes", name: "Lowe's", domain: "lowes.com", aliases: ["LOWE'S", "LOWES", "LOWE S", "LOWES.COM"],
    days: 90, clock: "purchase", verified: "search",
    source: "https://www.lowes.com/l/help/returns-policy",
    notes: ["Sources found were a few years old; confirm current terms with the store."],
    categories: [{ key: "appliances", label: "Major appliances (48 hours)", days: 2, match: ["REFRIGERATOR", "FRIDGE", "WASHER", "DRYER", "RANGE", "DISHWASHER"] }],
    members: [], holiday: [],
  },
  {
    id: "ikea", name: "IKEA", domain: "ikea.com", aliases: ["IKEA"],
    days: 365, clock: "purchase", verified: "search",
    source: "https://www.ikea.com/us/en/customer-service/returns-claims/return-policy/",
    notes: ["365 days applies to new and unopened products. Bring your receipt and a government-issued photo ID.", "Mattresses: one exchange within 90 days."],
    categories: [
      { key: "opened", label: "Opened products", days: 180 },
      { key: "no-return", label: "Plants, cut fabric, custom countertops, as-is items", final: true, match: ["PLANT", "FABRIC", "COUNTERTOP", "AS-IS", "AS IS"] },
    ],
    members: [], holiday: [],
  },
  {
    id: "kohls", name: "Kohl's", domain: "kohls.com", aliases: ["KOHL'S", "KOHLS", "KOHL S"],
    days: 90, clock: "purchase", verified: "search",
    source: "https://www.kohls.com/faq/article/893",
    notes: ["Kohl's used to allow 180 days; current pages say 90 (120 with a Kohl's Card).", "Baby registry items: up to 365 days."],
    categories: [
      { key: "electronics", label: "Premium electronics & watches", days: 30, match: ["WATCH", "TV", "HEADPHONE", "EARBUD", "SPEAKER", "TABLET", "CAMERA"] },
      { key: "sephora", label: "Sephora at Kohl's", days: 30, match: ["SEPHORA"] },
    ],
    members: [{ key: "kohls-card", label: "Paid with a Kohl's Card", days: 120 }],
    holiday: [],
  },
  {
    id: "macys", name: "Macy's", domain: "macys.com", aliases: ["MACY'S", "MACYS", "MACY S"],
    days: 30, clock: "delivery", verified: "search",
    source: "https://www.macys.com/customer-service/articles/what-is-macys-return-policy",
    notes: ["30 days of delivery or purchase.", "Holiday 2026: purchases Oct 5 – Dec 31 can be returned until Jan 31, 2027 (not Dyson or Mac Duggal).", "Furniture, mattresses and rugs have their own policy; Last Act items are final sale."],
    categories: [
      { key: "tech-acc", label: "Tech accessories", days: 14, match: ["CHARGER", "CABLE", "PHONE CASE", "EARBUD", "HEADPHONE"] },
      { key: "dyson", label: "Items sold by Dyson or Mac Duggal", days: 30, match: ["DYSON", "MAC DUGGAL"] },
      { key: "last-act", label: "Last Act (final sale)", final: true, match: ["LAST ACT"] },
    ],
    members: [{ key: "red-carpet", label: "Star Rewards Red Carpet", days: 90 }],
    holiday: [{ from: "2026-10-05", to: "2026-12-31", returnBy: "2027-01-31", excludes: ["dyson", "tech-acc"] }],
  },
  {
    id: "nordstrom", name: "Nordstrom", domain: "nordstrom.com", aliases: ["NORDSTROM"],
    days: null, anytime: true, clock: "purchase", verified: "page",
    source: "https://www.nordstrom.com/browse/services/return-policy",
    notes: ["\"There are no time limits for returns or exchanges\" — handled case by case.", "Marketplace sellers set their own window; special-occasion and some designer items must be unworn with tags."],
    categories: [], members: [], holiday: [],
  },
  {
    id: "rei", name: "REI", domain: "rei.com", aliases: ["REI", "REI CO-OP", "RECREATIONAL EQUIPMENT"],
    days: 90, clock: "purchase", verified: "search",
    source: "https://www.rei.com/membership",
    notes: ["Co-op members get one year on most items. Outlet, used gear and gift cards are excluded from the member benefit."],
    categories: [{ key: "outlet", label: "REI Outlet purchases", days: 30, match: ["OUTLET"] }],
    members: [{ key: "coop", label: "REI Co-op member", days: 365 }],
    holiday: [],
  },
  {
    id: "samsclub", name: "Sam's Club", domain: "samsclub.com", aliases: ["SAM'S CLUB", "SAMS CLUB", "SAM S CLUB", "SAMSCLUB"],
    days: null, anytime: true, clock: "purchase", verified: "search",
    source: "https://help.samsclub.com/app/answers/detail/a_id/4072/~/returns---sams-club",
    notes: ["Most items: returnable at any time under the Member Satisfaction Guarantee (active membership required)."],
    categories: [
      { key: "electronics", label: "Electronics & major appliances", days: 90, match: ["TV", "LAPTOP", "COMPUTER", "CAMERA", "MONITOR", "REFRIGERATOR", "WASHER", "DRYER", "CONSOLE"] },
      { key: "phones", label: "Phones, tablets & carrier-connected devices", days: 14, match: ["PHONE", "IPHONE", "TABLET", "IPAD", "GALAXY"] },
    ],
    members: [], holiday: [],
  },
  {
    id: "dicks", name: "DICK'S Sporting Goods", domain: "dickssportinggoods.com", aliases: ["DICK'S SPORTING", "DICKS SPORTING", "DICK S SPORTING", "GOLF GALAXY", "FIELD & STREAM"],
    days: 60, clock: "purchase", verified: "search",
    source: "https://www.dickssportinggoods.com/s/return-policy",
    notes: ["Also covers Golf Galaxy and Field & Stream. DICK'S Warehouse stores: 30 days.", "Opened baseball bats, e-scooters/bikes and Apple/Beats products can't be returned."],
    categories: [{ key: "opened-final", label: "Opened bats, e-scooters/bikes, Apple & Beats", final: true }],
    members: [], holiday: [],
  },
  {
    id: "ulta", name: "Ulta Beauty", domain: "ulta.com", aliases: ["ULTA", "ULTA BEAUTY"],
    days: 30, clock: "purchase", verified: "page",
    source: "https://www.ulta.com/returns",
    notes: ["Days 31–60: merchandise credit instead of a refund.", "Holiday 2026: purchases Nov 1 – Dec 31 can be returned through Jan 31, 2027."],
    categories: [{ key: "final", label: "Gift cards, salon wigs/extensions, intimate wellness devices", final: true, match: ["GIFT CARD", "WIG", "EXTENSION"] }],
    members: [],
    holiday: [{ from: "2026-11-01", to: "2026-12-31", returnBy: "2027-01-31", excludes: ["final"] }],
  },
  {
    id: "sephora", name: "Sephora", domain: "sephora.com", aliases: ["SEPHORA"],
    days: 30, clock: "purchase", verified: "search",
    source: "https://www.sephora.com/beauty/returns-exchanges",
    notes: ["Refund to original payment within 30 days with a receipt.", "Holiday 2026: purchases Oct 30 – Dec 31 can be returned or exchanged through Jan 31, 2027 (credit, not refund, for some returns)."],
    categories: [], members: [],
    holiday: [{ from: "2026-10-30", to: "2026-12-31", returnBy: "2027-01-31" }],
  },
  {
    id: "oldnavy", name: "Old Navy", domain: "oldnavy.gap.com", aliases: ["OLD NAVY", "OLDNAVY"],
    days: 30, clock: "delivery", verified: "search",
    source: "https://oldnavy.gap.com/customerService/info.do?cid=82724",
    notes: ["Online: 30 days from delivery; in store: 30 days from purchase.", "Old Navy Beauty: in-store returns only, unopened."],
    categories: [{ key: "final", label: "Final sale", final: true, match: ["FINAL SALE"] }],
    members: [], holiday: [],
  },
  {
    id: "gap", name: "Gap", domain: "gap.com", aliases: ["GAP", "GAP INC", "GAP.COM", "GAP FACTORY"],
    days: 30, clock: "delivery", verified: "search",
    source: "https://www.gap.com/customer-service/return-policy-faq?cid=1192370",
    notes: ["Online: 30 days from delivery; in store: 30 days from purchase.", "Encore members: returns after 30 days get a Merchandise Return Card.", "Gap has offered a holiday extension (Oct 15 – Dec 24 purchases through Jan 15); 2026 dates not confirmed, so not applied."],
    categories: [{ key: "final", label: "Final sale & Encore Market", final: true, match: ["FINAL SALE"] }],
    members: [
      { key: "encore-premier", label: "Encore Premier", days: 45 },
      { key: "all-access", label: "Encore All-Access Cardmember", days: 60 },
    ],
    holiday: [],
  },
  {
    id: "tjmaxx", name: "T.J. Maxx", domain: "tjmaxx.tjx.com", aliases: ["T.J.MAXX", "TJ MAXX", "T.J. MAXX", "TJMAXX", "T J MAXX"],
    days: 30, clock: "purchase", verified: "search",
    source: "https://tjmaxx.tjx.com/store/jump/topic/find-help/return-policy-for-items-purchased-in-stores/18400006p",
    notes: ["In store: 30 days with receipt for a refund; after that, merchandise credit only.", "Online orders: most pages say 40 days from the order date."],
    categories: [{ key: "online", label: "Online order (40 days from order)", days: 40 }],
    members: [], holiday: [],
  },
  {
    id: "wayfair", name: "Wayfair", domain: "wayfair.com", aliases: ["WAYFAIR"],
    days: 30, clock: "delivery", verified: "search",
    source: "https://www.wayfair.com/help-and-contact",
    notes: ["Most items: 30 days of delivery. Some items are non-returnable; check the product page.", "The help page found was a couple of years old."],
    categories: [], members: [], holiday: [],
  },
  {
    id: "staples", name: "Staples", domain: "staples.com", aliases: ["STAPLES"],
    days: 30, clock: "purchase", verified: "search",
    source: "https://www.staples.com/sbd/cre/help-center/returns-policy",
    notes: ["The 30-day general window comes from older Staples pages; technology's 14 days is consistent across sources.", "Opened boxed software and downloads can't be returned."],
    categories: [
      { key: "tech", label: "Technology, business machines & small appliances", days: 14, match: ["LAPTOP", "COMPUTER", "PRINTER", "TABLET", "CAMERA", "MONITOR", "SHREDDER", "CHROMEBOOK"] },
      { key: "software", label: "Unopened boxed software", days: 30, match: ["SOFTWARE"] },
    ],
    members: [], holiday: [],
  },
  {
    id: "nike", name: "Nike", domain: "nike.com", aliases: ["NIKE", "NIKE.COM"],
    days: 60, clock: "delivery", verified: "search",
    source: "https://www.nike.com/help/a/returns-policy",
    notes: ["Most purchases: 60 days, for any reason. Not at Nike Clearance stores.", "Nike By You custom shoes have their own rules."],
    categories: [], members: [], holiday: [],
  },
  {
    id: "lululemon", name: "lululemon", domain: "lululemon.com", aliases: ["LULULEMON"],
    days: 30, clock: "delivery", verified: "search",
    source: "https://shop.lululemon.com/help/returns-and-refunds/policy",
    notes: ["Unwashed, unworn, tags attached. Online: from delivery; in store: from purchase.", "Like New resale items: 14 days of delivery."],
    categories: [], members: [], holiday: [],
  },
  {
    id: "newegg", name: "Newegg", domain: "newegg.com", aliases: ["NEWEGG"],
    days: 30, clock: "delivery", verified: "search",
    source: "https://kb.newegg.com/knowledge-base/30-day-hassle-free-returns/",
    notes: ["Items sold and shipped by Newegg. Marketplace sellers set their own terms.", "Older Newegg pages listed 15 days for notebooks, monitors, tablets and desktops."],
    categories: [{ key: "final", label: "Open-box, opened software/games, consumables", final: true, match: ["OPEN BOX", "OPEN-BOX"] }],
    members: [], holiday: [],
  },
];

export const byId = (id) => RETAILERS.find((r) => r.id === id) || null;
