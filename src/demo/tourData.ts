/**
 * Content of the two guided demo tours (salesman 12 steps, owner 22 steps).
 *
 * Titles, explanations, "good to know" tips and "do this" lines are the ones from the original SalesmanDemo and
 * OwnerDemo. `html` is a small, static drawing of the sample screen (trusted, hand-made markup that is never built
 * from user input). Sample data only: nothing here is read from or written to the real app.
 */
export type TourId = 'salesman' | 'owner';

export interface TourStep {
  title: string;
  chapter: string;
  what: string;
  tips: string[];
  /** The "Do this" line. */
  action: string;
  /** Title bar of the sample screen. */
  sample: string;
  /** Static markup of the sample screen body. */
  html: string;
  /** Where the yellow "tap here" circle sits (left in %, top in px of the 172px sample screen). */
  tap: { left: number; top: number } | null;
}

export interface TourMeta {
  id: TourId;
  title: string;
  short: string;
  blurb: string;
  startLabel: string;
  finishLabel: string;
  steps: TourStep[];
}

export const SALESMAN_STEPS: TourStep[] = [
  {
    title: "How the salesman app works",
    chapter: "Start",
    what: "A short walk through a normal day on the route: sign in, load the vehicle, bill a shop, collect an old balance, check stock and end the trip. Everything here is sample data. Nothing you tap is saved or sent anywhere.",
    tips: [],
    action: "Tap Start the demo.",
    sample: "Your day on the route",
    html: "<div style=\"display:flex;justify-content:space-between;text-align:center;font-size:9.5px;font-weight:700;margin:8px 0\"><div><div style=\"font-size:22px\">🔑</div>Sign in</div><div><div style=\"font-size:22px\">🚚</div>Load</div><div><div style=\"font-size:22px\">🧾</div>Bill</div><div><div style=\"font-size:22px\">💰</div>Collect</div><div><div style=\"font-size:22px\">📦</div>Stock</div><div><div style=\"font-size:22px\">🏁</div>End trip</div></div><div class=\"card\" style=\"text-align:center;font-weight:700\">Sample data only. Nothing is saved.</div>",
    tap: { left: 62, top: 110 },
  },
  {
    title: "Sign in",
    chapter: "Sign in",
    what: "Enter the mobile number and PIN the owner gave you. The PIN is 4 to 6 digits.",
    tips: ["Several wrong PINs in a row lock sign-in for a few minutes. Wait, then try again.", "If your PIN never works, ask the owner to save your PIN again in Settings."],
    action: "Tap Sign in to van route.",
    sample: "Salesman sign in",
    html: "<div class=\"in\"><small>MOBILE NUMBER</small><b>94370 12345</b></div><div class=\"pdt\" style=\"margin:4px 0\"><i class=\"f\"></i><i class=\"f\"></i><i class=\"f\"></i><i class=\"f\"></i></div><div class=\"btn hl\">Sign in to van route</div>",
    tap: { left: 70, top: 108 },
  },
  {
    title: "Your home screen",
    chapter: "Home",
    what: "Home shows the five things you do every day. The bar at the bottom moves between Home, Sale, Payment, Trips, Stock and My Bills.",
    tips: ["Starting a new shop on your route? Use Route Master to add it and bill it straight away."],
    action: "Start the day by tapping 3. Record Trip.",
    sample: "Home",
    html: "<div class=\"card\" style=\"padding:4px 10px\"><div class=\"rowi\"><div class=\"ico\">🧾</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">1. New Bill / Sale</b><div class=\"lbl\">Select retailer or add new customer</div></div><b style=\"font-size:11.5px\"></b></div><div class=\"rowi\"><div class=\"ico\">💰</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">2. Record Payment</b><div class=\"lbl\">Look up retailer dues &amp; collect cash/UPI</div></div><b style=\"font-size:11.5px\"></b></div><div class=\"rowi hl\"><div class=\"ico\">🚚</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">3. Record Trip</b><div class=\"lbl\">Load Vehicle Run</div></div><b style=\"font-size:11.5px\"></b></div><div class=\"rowi\"><div class=\"ico\">📦</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">4. Van Stock</b><div class=\"lbl\">Check remaining stock &amp; empty crates</div></div><b style=\"font-size:11.5px\"></b></div></div>",
    tap: { left: 84, top: 74 },
  },
  {
    title: "Load the vehicle",
    chapter: "Trips",
    what: "Set how much of each product goes on the vehicle, then load it. Van Stock then shows what is left as you sell.",
    tips: [],
    action: "Tap Load Vehicle Run.",
    sample: "Trips",
    html: "<div class=\"card\" style=\"padding:4px 10px\"><div class=\"rowi\"><div class=\"ico\">🫙</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">20 L water jar</b><div class=\"lbl\">₹60 each</div></div><b style=\"font-size:11.5px\"><div class=\"st2\" style=\"font-size:10.5px\"><span>−</span><span>40</span><span>＋</span></div></b></div><div class=\"rowi\"><div class=\"ico\">💧</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">1 L bottle, case of 12</b><div class=\"lbl\">₹130 per case</div></div><b style=\"font-size:11.5px\"><div class=\"st2\" style=\"font-size:10.5px\"><span>−</span><span>20</span><span>＋</span></div></b></div><div class=\"rowi\"><div class=\"ico\">🥤</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">500 ml bottle, case of 24</b><div class=\"lbl\">₹150 per case</div></div><b style=\"font-size:11.5px\"><div class=\"st2\" style=\"font-size:10.5px\"><span>−</span><span>15</span><span>＋</span></div></b></div></div><div class=\"btn hl\">Load Vehicle Run</div>",
    tap: { left: 70, top: 124 },
  },
  {
    title: "Pick the shop",
    chapter: "Sale",
    what: "Open Sale and choose the shop you are billing. Use the search box to find it by name.",
    tips: [],
    action: "Tap Sri Lakshmi Stores.",
    sample: "Sale",
    html: "<div class=\"search\" style=\"background:#fff;border:1px solid var(--line);padding:6px 10px;font-size:10.5px;margin-bottom:5px\">🔍 Search shop</div><div class=\"card\" style=\"padding:2px 10px\"><div class=\"rowi hl\"><div class=\"ico\">SL</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">Sri Lakshmi Stores</b><div class=\"lbl\">Main Road</div></div><b style=\"font-size:11.5px\">due ₹1,250</b></div><div class=\"rowi\"><div class=\"ico\">MT</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">Maa Tarini Kirana</b><div class=\"lbl\">Station Chowk</div></div><b style=\"font-size:11.5px\">₹0</b></div><div class=\"rowi\"><div class=\"ico\">HS</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">Hotel Sagar</b><div class=\"lbl\">Bus Stand</div></div><b style=\"font-size:11.5px\">due ₹480</b></div></div>",
    tap: { left: 74, top: 62 },
  },
  {
    title: "Add the products",
    chapter: "Sale",
    what: "Tap + for each product the shop buys. The total updates as you go. Tap minus to take one back.",
    tips: [],
    action: "Add at least one product, then tap Review & pay.",
    sample: "Sri Lakshmi Stores",
    html: "<div class=\"card\" style=\"padding:3px 10px\"><div class=\"rowi\"><div class=\"ico\">🫙</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">20 L water jar</b><div class=\"lbl\">₹60</div></div><b style=\"font-size:11.5px\"><div class=\"st2\" style=\"font-size:10.5px\"><span>−</span><span>4</span><span>＋</span></div></b></div><div class=\"rowi\"><div class=\"ico\">💧</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">1 L bottle, case of 12</b><div class=\"lbl\">₹130</div></div><b style=\"font-size:11.5px\"><div class=\"st2\" style=\"font-size:10.5px\"><span>−</span><span>2</span><span>＋</span></div></b></div></div><div class=\"card\"><div class=\"ln\"><b>Total</b><b>₹500</b></div></div><div class=\"btn hl\">Review &amp; pay</div>",
    tap: { left: 70, top: 124 },
  },
  {
    title: "Take the payment",
    chapter: "Sale",
    what: "Choose how the shop pays: Cash, UPI / QR, Credit (Due) or Cheque. Enter the amount received. Anything not paid now stays as the shop’s balance.",
    tips: ["Try Credit (Due) or a smaller amount and watch the balance remaining change."],
    action: "Tap Finalize Sale.",
    sample: "Payment",
    html: "<div class=\"pills\" style=\"grid-template-columns:repeat(4,1fr)\"><span class=\"on\">Cash</span><span>UPI / QR</span><span>Credit (Due)</span><span>Cheque</span></div><div class=\"in\"><small>AMOUNT RECEIVED</small><b>₹ 300</b></div><div class=\"ln\"><span class=\"lbl\">Balance remaining</span><b style=\"color:var(--red)\">₹200</b></div><div class=\"btn hl\">Finalize Sale</div>",
    tap: { left: 70, top: 128 },
  },
  {
    title: "Send the invoice",
    chapter: "Sale",
    what: "The invoice is ready. You can send it to the shop on WhatsApp from here, or open it to view or print. It also appears under My Bills.",
    tips: [],
    action: "Tap Done.",
    sample: "Invoice ready",
    html: "<div style=\"text-align:center\"><div style=\"font-size:24px;color:var(--grn)\">✓</div><b>₹500 · Sri Lakshmi Stores</b></div><div class=\"fx\" style=\"margin-top:6px\"><div class=\"btn\" style=\"background:#25a244\">WhatsApp</div><div class=\"btn o\" style=\"background:#fff\">View / Print</div></div><div class=\"btn hl\">Done</div>",
    tap: { left: 70, top: 132 },
  },
  {
    title: "Collect an old balance",
    chapter: "Payment",
    what: "When a shop pays what it owes, open Payment, look the shop up and record the cash or UPI you received. The balance goes down by that amount.",
    tips: [],
    action: "Tap Record payment.",
    sample: "Payment",
    html: "<div class=\"card\"><b>Sri Lakshmi Stores</b><div class=\"ln\"><span class=\"lbl\">Owes you</span><b style=\"color:var(--red)\">₹1,250</b></div></div><div class=\"in\"><small>RECEIVED (CASH)</small><b>₹ 500</b></div><div class=\"ln\"><span class=\"lbl\">Balance after</span><b>₹750</b></div><div class=\"btn hl\">Record payment</div>",
    tap: { left: 70, top: 132 },
  },
  {
    title: "Check the stock",
    chapter: "Stock",
    what: "Stock shows what is left on the vehicle after each sale. Use the filters to see All, Available, Loaded or sold-out (Empty) items.",
    tips: [],
    action: "Tap Trips in the bottom bar.",
    sample: "Stock",
    html: "<div class=\"chips\"><span class=\"chip on\">All</span><span class=\"chip\">Available</span><span class=\"chip\">Loaded</span><span class=\"chip\">Empty</span></div><div class=\"card\" style=\"padding:2px 10px\"><div class=\"rowi\"><div class=\"ico\">🫙</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">20 L water jar</b><div class=\"lbl\">sold 4</div></div><b style=\"font-size:11.5px\">36 left</b></div><div class=\"rowi\"><div class=\"ico\">💧</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">1 L bottle, case of 12</b><div class=\"lbl\">sold 2</div></div><b style=\"font-size:11.5px\">18 left</b></div><div class=\"rowi\"><div class=\"ico\">🥤</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">500 ml, case of 24</b><div class=\"lbl\">sold 0</div></div><b style=\"font-size:11.5px\">15 left</b></div></div>",
    tap: { left: 84, top: 2 },
  },
  {
    title: "End the trip",
    chapter: "Trips",
    what: "At the end of the route, open Trips and end the trip. Count what is left on the vehicle and return it to stock.",
    tips: ["If the signal drops, keep working. The app keeps your entries on the phone and sends them when the connection is back."],
    action: "Tap End Trip & Return Stock.",
    sample: "Trips",
    html: "<div class=\"card\"><div class=\"three\" style=\"border:0;margin:0;padding:0\"><div>Loaded<b>75</b></div><div>Sold<b>6</b></div><div>Left<b>69</b></div></div></div><div class=\"btn hl\">End Trip &amp; Return Stock</div>",
    tap: { left: 70, top: 112 },
  },
  {
    title: "That is the whole day",
    chapter: "Finish",
    what: "Sign in, load the vehicle, bill each shop, collect balances, check stock, end the trip. For anything else, ask the owner.",
    tips: [],
    action: "Close the demo or run it again.",
    sample: "Your day, in order",
    html: "<div style=\"line-height:1.9;font-size:11px;font-weight:600\"><div><span style=\"color:var(--grn)\">✓</span> Sign in</div><div><span style=\"color:var(--grn)\">✓</span> Load the vehicle</div><div><span style=\"color:var(--grn)\">✓</span> Bill each shop</div><div><span style=\"color:var(--grn)\">✓</span> Collect old balances</div><div><span style=\"color:var(--grn)\">✓</span> Check the stock</div><div><span style=\"color:var(--grn)\">✓</span> End the trip</div></div>",
    tap: null,
  },
];

export const OWNER_STEPS: TourStep[] = [
  {
    title: "How the owner app works",
    chapter: "Start",
    what: "This tour walks through the whole app in the order you will really use it, one screen at a time. Every shop, product, price and number is made up. Nothing you tap is saved or sent anywhere.",
    tips: ["The menu on the left of the sample screen is the real menu. Tap any item to look around whenever you like.", "Lost? Use Jump to topic to go straight to a part, or Back to repeat a step."],
    action: "Tap Start the tour.",
    sample: "The whole app, in order",
    html: "<div class=\"chp\"><i class=\"on\">SET UP</i><i>STOCK IN</i><i>SELL</i><i>DELIVER</i><i>COLLECT</i><i>CHECK</i></div><div class=\"card\" style=\"margin-top:8px;text-align:center;font-weight:700;line-height:1.5\">Set up once.<br/>Then every day: stock in, sell, send trips, collect, check.</div>",
    tap: { left: 62, top: 118 },
  },
  {
    title: "Home: your day at a glance",
    chapter: "Set up once",
    what: "Home shows today’s sales, money collected, money still to receive and low stock. The four big buttons jump to New sale, Inventory, Collect and Trips. On a new setup a Get started list tells you where to begin.",
    tips: ["Needs attention lists things to act on, such as trips with a stock difference or expiry returns."],
    action: "Tap 1. Fill your company & GSTIN.",
    sample: "Home",
    html: "<div class=\"card\"><b>Get started</b><div class=\"rowi hl\" style=\"padding:3px 4px\"><b style=\"font-size:11px;color:var(--blue)\">1. Fill your company &amp; GSTIN</b></div><div style=\"color:var(--blue);font-weight:700;padding:3px 4px\">2. Add products</div><div style=\"color:var(--blue);font-weight:700;padding:3px 4px\">3. Add suppliers &amp; customers</div></div><div class=\"fx\"><div class=\"card\" style=\"flex:1;margin:0\"><span class=\"lbl\">Sales today</span><b style=\"display:block\">₹21,040</b></div><div class=\"card\" style=\"flex:1;margin:0\"><span class=\"lbl\">To receive</span><b style=\"display:block;color:var(--red)\">₹1.86L</b></div></div>",
    tap: { left: 70, top: 56 },
  },
  {
    title: "Settings: your business",
    chapter: "Set up once",
    what: "Enter your company name, address and GSTIN once. They print on every invoice you send.",
    tips: ["Check the GSTIN carefully. A wrong number prints on every GST invoice."],
    action: "Tap Save business details.",
    sample: "Settings · Business",
    html: "<div class=\"in\"><small>COMPANY NAME</small><b>Shree Beverages</b></div><div class=\"in\"><small>ADDRESS</small><b>Plot 14, MIDC, Pune</b></div><div class=\"in\"><small>GSTIN</small><b>27AAKCS1234F1Z5</b></div><div class=\"btn hl\">Save business details</div>",
    tap: { left: 72, top: 122 },
  },
  {
    title: "Settings: godowns, beats and staff",
    chapter: "Set up once",
    what: "Add each godown and vehicle under Warehouses & Fleet. Group shops into routes under Beats. Add your salesmen under Staff & Roles, each with a mobile number and a PIN.",
    tips: ["Use a 6-digit PIN for salesmen.", "Take a backup now and then under Backups."],
    action: "Tap each tab on the sample screen to see what it holds, then tap Next.",
    sample: "Settings",
    html: "<div class=\"chips\"><span class=\"chip\">Warehouses &amp; Fleet</span><span class=\"chip\">Beats</span><span class=\"chip on\">Staff &amp; Roles</span><span class=\"chip\">Backups</span></div><div class=\"card\" style=\"padding:2px 10px\"><div class=\"rowi\"><div class=\"ico\">S</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">Sunil Das</b><div class=\"lbl\">94370 12345 · PIN set</div></div><b style=\"font-size:11.5px\">Salesman</b></div><div class=\"rowi\"><div class=\"ico\">A</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">Anita</b><div class=\"lbl\">94370 99887 · PIN set</div></div><b style=\"font-size:11.5px\">Salesman</b></div></div>",
    tap: { left: 18, top: 30 },
  },
  {
    title: "Products: what you sell",
    chapter: "Set up once",
    what: "Add every item with its price and GST rate, and say whether the bottle or crate comes back. Stock and billing both use this list.",
    tips: ["Add a product only once. Edit it later if the price changes."],
    action: "Tap New product, then tap Save product.",
    sample: "Products",
    html: "<div class=\"in\"><small>PRODUCT</small><b>1 L bottle, case of 12</b></div><div class=\"in\"><small>PRICE · GST</small><b>₹130 · 18%</b></div><div class=\"rowsw\" style=\"padding:2px 0;font-size:11px\"><span>Returnable crates / bottles</span><div class=\"sw\" style=\"width:34px;height:19px\"></div></div><div class=\"btn hl\">Save product</div>",
    tap: { left: 72, top: 122 },
  },
  {
    title: "Parties: shops and suppliers",
    chapter: "Set up once",
    what: "Every shop you sell to and every supplier you buy from is a party. Open a party to see its bills, its payments and what it owes you.",
    tips: ["Shops are matched by name first. The phone number is only a second check."],
    action: "Tap Sri Lakshmi Stores to open its ledger.",
    sample: "Parties",
    html: "<div class=\"card\" style=\"padding:2px 10px\"><div class=\"rowi hl\"><div class=\"ico\">SL</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">Sri Lakshmi Stores</b><div class=\"lbl\">Shop · Main Road</div></div><b style=\"font-size:11.5px\">₹1,250</b></div><div class=\"rowi\"><div class=\"ico\">MT</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">Maa Tarini Kirana</b><div class=\"lbl\">Shop · Station Chowk</div></div><b style=\"font-size:11.5px\">₹0</b></div><div class=\"rowi\"><div class=\"ico\">AF</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">AquaFresh Beverages</b><div class=\"lbl\">Supplier</div></div><b style=\"font-size:11.5px\"></b></div></div><div class=\"lbl\" style=\"padding:0 4px\">Ledger: bills, payments, what it owes</div>",
    tap: { left: 74, top: 46 },
  },
  {
    title: "Stock in: upload the supplier invoice",
    chapter: "Stock in",
    what: "When stock arrives, open Inventory, then Inward, then New purchase. Upload or scan the supplier’s invoice. The app reads the products, quantities, schemes and taxes for you.",
    tips: ["If the invoice cannot be read, use Open Review (Manual Entry) and type the lines.", "A reader can make mistakes. Always check the lines in the next step."],
    action: "Tap Upload / Scan invoice.",
    sample: "Inventory › Inward › New purchase",
    html: "<div style=\"border:2px dashed #b8c0cc;border-radius:10px;padding:14px;text-align:center;background:#fff;font-size:10.5px;color:var(--mut)\">📄 Supplier invoice (photo, PDF or Excel)</div><div class=\"btn hl\">Upload / Scan invoice</div><div class=\"lnk\" style=\"font-size:10.5px\">Open Review (Manual Entry)</div>",
    tap: { left: 70, top: 102 },
  },
  {
    title: "Check every line",
    chapter: "Stock in",
    what: "Review lines shows what was read. A line with no expiry date or a zero rate is marked. Fix it, and choose the godown the stock is going into.",
    tips: [],
    action: "Tap Set expiry on the marked line.",
    sample: "Review lines",
    html: "<div class=\"rowi\"><div class=\"ico\">💧</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">1 L bottle · 200 cs</b><div class=\"lbl\">exp 12 Mar 2027</div></div><b style=\"font-size:11.5px\">✓</b></div><div class=\"rowi hl\"><div class=\"ico\">🥤</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">500 ml · 60 cs</b><div class=\"lbl\" style=\"color:var(--red)\">No expiry date</div></div><span class=\"tag y\" style=\"font-size:10px\">Set expiry</span></div><div class=\"in\"><small>GODOWN</small><b>Main godown ⌄</b></div>",
    tap: { left: 78, top: 60 },
  },
  {
    title: "Confirm and post",
    chapter: "Stock in",
    what: "Confirm & Post adds the stock to the godown you chose and saves the purchase. Stock only changes at this moment, not before.",
    tips: [],
    action: "Tap Confirm & Post.",
    sample: "Confirm purchase",
    html: "<div class=\"card\"><div class=\"ln\"><span class=\"lbl\">Supplier</span><b>AquaFresh</b></div><div class=\"ln\"><span class=\"lbl\">Lines</span><b>2 · 260 cases</b></div><div class=\"ln\"><span class=\"lbl\">Into</span><b>Main godown</b></div></div><div class=\"btn hl\">Confirm &amp; Post</div>",
    tap: { left: 70, top: 116 },
  },
  {
    title: "Stock: what you have and where",
    chapter: "Stock in",
    what: "The Stock tab shows each product in each godown. Compare with the last step: the new quantities are added, and each batch keeps its own expiry date. Low stock turns amber.",
    tips: [],
    action: "Tap Audit.",
    sample: "Inventory",
    html: "<div class=\"chips\"><span class=\"chip on\">Stock</span><span class=\"chip\">Inward</span><span class=\"chip\">Audit</span></div><div class=\"card\" style=\"padding:2px 10px\"><div class=\"rowi\"><div class=\"ico\">💧</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">1 L bottle</b><div class=\"lbl\">Main · exp 12 Mar 2027</div></div><b style=\"font-size:11.5px\">260 cs</b></div><div class=\"rowi\"><div class=\"ico\">🥤</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">500 ml bottle</b><div class=\"lbl\">Main · exp 20 May 2027</div></div><b style=\"font-size:11.5px\"><span style=\"color:#c77d00\">9 cs · low</span></b></div></div>",
    tap: { left: 46, top: 28 },
  },
  {
    title: "Audit: count the godown",
    chapter: "Stock in",
    what: "Start a count, type what is really on the shelf, and the app shows the difference from the book stock. Do this regularly to catch loss or mistakes early.",
    tips: ["Stock audit is for checking. Fix mistakes through a purchase, a return or a bill, so the history stays clear."],
    action: "Tap Start a count, then Finish count.",
    sample: "Audit",
    html: "<div class=\"card\"><div class=\"three\" style=\"border:0;margin:0;padding:0\"><div>Book<b>260</b></div><div>Counted<b>258</b></div><div>Diff<b style=\"color:var(--red)\">−2</b></div></div></div><div class=\"btn hl\">Start a count</div><div class=\"lbl\" style=\"text-align:center;margin-top:4px\">then Finish count</div>",
    tap: { left: 70, top: 100 },
  },
  {
    title: "Sell 1 of 3: choose the customer",
    chapter: "Sell",
    what: "Open Sell. The three pills at the top are Customer, Products and Save bill. First pick the shop, check the date, choose where the stock comes from, and choose the document: a Non-GST Retail Bill or a GST Tax Invoice.",
    tips: ["Choose a GST Tax Invoice only for shops with a GSTIN."],
    action: "Pick the shop, then tap Continue to Beverages & Crates.",
    sample: "Sell",
    html: "<div class=\"chips\"><span class=\"chip on\">1 Customer</span><span class=\"chip\">2 Products</span><span class=\"chip\">3 Save bill</span></div><div class=\"in\"><small>SHOP</small><b>Sri Lakshmi Stores</b></div><div class=\"pills\" style=\"grid-template-columns:repeat(2,1fr)\"><span>Non-GST Retail Bill</span><span class=\"on\">GST Tax Invoice</span></div><div class=\"btn hl\">Continue to Beverages &amp; Crates</div>",
    tap: { left: 70, top: 124 },
  },
  {
    title: "Sell 2 of 3: add products",
    chapter: "Sell",
    what: "Tap + for each product. The total updates as you go, and any promotion that matches is applied by itself. The grey number is the stock left.",
    tips: ["Try 10 jars. A free jar is added by the sample promotion."],
    action: "Add at least one product, then tap Review & save.",
    sample: "Sell · Products",
    html: "<div class=\"card\" style=\"padding:3px 10px\"><div class=\"rowi\"><div class=\"ico\">🫙</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">20 L water jar</b><div class=\"lbl\">₹60 · <span style=\"color:#9aa1ab\">40 left</span></div></div><b style=\"font-size:11.5px\"><div class=\"st2\" style=\"font-size:10.5px\"><span>−</span><span>10</span><span>＋</span></div></b></div><div class=\"lbl\" style=\"color:var(--grn);font-weight:700;padding:2px 36px\">🎁 1 free jar added by promotion</div></div><div class=\"btn hl\">Review &amp; save</div>",
    tap: { left: 70, top: 124 },
  },
  {
    title: "Sell 3 of 3: save the bill",
    chapter: "Sell",
    what: "Choose how the shop pays: Cash, UPI / QR, Credit (Due) or Cheque. Enter the amount received. Whatever is not paid now stays on the shop’s account. Then save the bill and send it.",
    tips: ["Try Credit (Due) or a smaller amount and watch the Credit Balance Remaining change."],
    action: "Tap Save bill, then tap Done.",
    sample: "Sell · Save bill",
    html: "<div class=\"pills\" style=\"grid-template-columns:repeat(4,1fr)\"><span class=\"on\">Cash</span><span>UPI / QR</span><span>Credit (Due)</span><span>Cheque</span></div><div class=\"in\"><small>AMOUNT RECEIVED</small><b>₹ 300</b></div><div class=\"ln\"><span class=\"lbl\">Credit balance remaining</span><b style=\"color:var(--red)\">₹300</b></div><div class=\"btn hl\">Save bill</div>",
    tap: { left: 70, top: 128 },
  },
  {
    title: "Trips: send a vehicle out",
    chapter: "Deliver",
    what: "Tap New trip. Choose the vehicle, the route, the salesman and the stock to load from the godown. Then assign the day’s bills to the trip.",
    tips: ["Loading takes stock out of the godown, so you always know what is on the vehicle."],
    action: "Tap Create trip.",
    sample: "Trips · New trip",
    html: "<div class=\"in\"><small>VEHICLE · ROUTE</small><b>OD-02-AB-4471 · Old Town</b></div><div class=\"in\"><small>SALESMAN</small><b>Sunil Das</b></div><div class=\"ln\"><span class=\"lbl\">Load from godown</span><b>75 cases</b></div><div class=\"btn hl\">Create trip</div>",
    tap: { left: 70, top: 124 },
  },
  {
    title: "Close the trip: record returned stock",
    chapter: "Deliver",
    what: "When the vehicle comes back, open the trip and tap Record returned stock & close trip. Enter what came back. If something is short, you must give a reason, so nothing disappears quietly.",
    tips: ["Try returning fewer jars than expected and see the reason box appear."],
    action: "Tap Close trip.",
    sample: "Close trip",
    html: "<div class=\"card\"><div class=\"ln\"><span class=\"lbl\">Jars expected back</span><b>36</b></div><div class=\"ln\"><span class=\"lbl\">Jars returned</span><b style=\"color:var(--red)\">34</b></div></div><div class=\"in\"><small>REASON FOR SHORT STOCK</small><b>Broken in transit</b></div><div class=\"btn hl\">Close trip</div>",
    tap: { left: 72, top: 132 },
  },
  {
    title: "Payments: collect what shops owe",
    chapter: "Collect",
    what: "When a shop pays an old balance, open Payments, choose the shop and record the cash or UPI you received. The balance goes down by that amount. You can send the shop a WhatsApp receipt straight away.",
    tips: ["You can also record a payment from the shop’s own page under Parties."],
    action: "Tap Record receipt, then Continue.",
    sample: "Payments",
    html: "<div class=\"in\"><small>SHOP</small><b>Sri Lakshmi Stores · owes ₹1,250</b></div><div class=\"in\"><small>RECEIVED</small><b>₹ 500 · Cash</b></div><div class=\"btn hl\">Record receipt</div><div class=\"lbl\" style=\"text-align:center;margin-top:3px\">then send a WhatsApp receipt</div>",
    tap: { left: 70, top: 112 },
  },
  {
    title: "Crates & deposits",
    chapter: "Collect",
    what: "Crates and bottles that go out must come back. This screen shows how many each party still holds, and the deposits you hold. Record empties returned, empties issued, a deposit collected or a deposit refunded.",
    tips: [],
    action: "Tap Save record, then Continue.",
    sample: "Crates & deposits",
    html: "<div class=\"card\"><div class=\"ln\"><b>Sri Lakshmi Stores</b><span class=\"lbl\">holds 24 crates</span></div><div class=\"ln\"><span class=\"lbl\">Deposit held</span><b>₹3,600</b></div></div><div class=\"chips\"><span class=\"chip on\">Empties returned</span><span class=\"chip\">Empties issued</span><span class=\"chip\">Deposit collected</span><span class=\"chip\">Deposit refunded</span></div><div class=\"btn hl\">Save record</div>",
    tap: { left: 72, top: 128 },
  },
  {
    title: "Promotions: offers for your shops",
    chapter: "Offers & credits",
    what: "Set up offers once and billing applies them for you. There are six kinds. Tap each kind below to see an example.",
    tips: [],
    action: "Tap a few kinds, then tap Next.",
    sample: "Promotions",
    html: "<div class=\"chips\"><span class=\"chip on\">Buy X Get X</span><span class=\"chip\">Buy A Get B Free</span><span class=\"chip\">Group Buy N Get M</span></div><div class=\"chips\"><span class=\"chip\">Combo Bundle</span><span class=\"chip\">Percent off</span><span class=\"chip\">Flat off</span></div><div class=\"card\"><b>Buy X Get X</b><div class=\"lbl\">Buy 10 jars, get 1 jar of the same item free.</div></div>",
    tap: { left: 62, top: 30 },
  },
  {
    title: "Supplier credits",
    chapter: "Offers & credits",
    what: "Keep track of what your suppliers owe you: Schemes they announced, Credit notes they issue, and the Monthly volume incentive. Use Record receipt when a supplier pays or adjusts.",
    tips: [],
    action: "Tap each tab, then tap Next.",
    sample: "Supplier credits",
    html: "<div class=\"chips\"><span class=\"chip\">Schemes</span><span class=\"chip\">Credit notes</span><span class=\"chip on\">Monthly</span></div><div class=\"card\"><b>Monthly volume incentive</b><div class=\"lbl\">Target 300 cases · done 262</div><div class=\"meter\"><i style=\"width:87%\"></i></div></div><div class=\"btn\">Record receipt</div>",
    tap: { left: 76, top: 28 },
  },
  {
    title: "Reports: see how the business is doing",
    chapter: "Check",
    what: "Twelve reports cover sales, profit, purchases, stock, trips, GST and more. Most can be filtered by date and downloaded as a file for your accountant.",
    tips: ["Open Party Credit & Receivables every week to see who owes you money."],
    action: "Tap Party Credit & Receivables, then tap Next.",
    sample: "Reports",
    html: "<div class=\"card\" style=\"padding:2px 10px\"><div class=\"rowi\"><div class=\"ico\">📈</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">Profit &amp; Loss</b><div class=\"lbl\">Sales, cost, expenses and net profit</div></div><b style=\"font-size:11.5px\"></b></div><div class=\"rowi hl\"><div class=\"ico\">⏳</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">Party Credit &amp; Receivables</b><div class=\"lbl\">Who owes you money, and how much</div></div><b style=\"font-size:11.5px\"></b></div><div class=\"rowi\"><div class=\"ico\">🧾</div><div style=\"flex:1\"><b style=\"font-size:11.5px\">GST</b><div class=\"lbl\">Tax summary for your accountant</div></div><b style=\"font-size:11.5px\"></b></div></div>",
    tap: { left: 74, top: 74 },
  },
  {
    title: "Your day, in order",
    chapter: "Finish",
    what: "That is the whole app. Set up once. Then every day: stock in, sell, send trips, collect payments and check the numbers. Come back to this tour any time from the sign-in screen.",
    tips: [],
    action: "Close the demo and sign in.",
    sample: "Set up once, then every day",
    html: "<div style=\"line-height:1.9;font-size:11px;font-weight:600\"><div><span style=\"color:var(--blue)\">●</span> Stock in (upload the supplier invoice)</div><div><span style=\"color:var(--blue)\">●</span> Sell (bill the shops)</div><div><span style=\"color:var(--blue)\">●</span> Send trips and close them</div><div><span style=\"color:var(--blue)\">●</span> Collect payments</div><div><span style=\"color:var(--blue)\">●</span> Check the reports</div></div>",
    tap: null,
  },
];

/** "Jump to topic" list for the owner tour (step numbers are 1-based). */
export const OWNER_JUMP: { group: string; items: { label: string; step: number }[] }[] = [
  { group: 'Set up once', items: [
    { label: 'Home', step: 2 }, { label: 'Your business', step: 3 }, { label: 'Godowns, beats and staff', step: 4 },
    { label: 'Products', step: 5 }, { label: 'Parties', step: 6 } ] },
  { group: 'Stock in', items: [
    { label: 'Upload the supplier invoice', step: 7 }, { label: 'Stock and audit', step: 10 } ] },
  { group: 'Sell', items: [ { label: 'Choose, add, save the bill', step: 12 } ] },
  { group: 'Deliver', items: [ { label: 'Send and close a trip', step: 15 } ] },
  { group: 'Collect', items: [ { label: 'Payments', step: 17 }, { label: 'Crates & deposits', step: 18 } ] },
  { group: 'Offers & credits', items: [ { label: 'Promotions', step: 19 }, { label: 'Supplier credits', step: 20 } ] },
  { group: 'Check', items: [ { label: 'Reports', step: 21 }, { label: 'Your day, in order', step: 22 } ] },
];

export const OWNER_CHAPTERS = ['Set up', 'Stock in', 'Sell', 'Deliver', 'Collect', 'Check'];

export const TOURS: Record<TourId, TourMeta> = {
  salesman: {
    id: 'salesman',
    title: 'How the salesman app works',
    short: 'Salesman demo',
    blurb: 'A normal day on the route: sign in, load the vehicle, bill a shop, collect, check stock, end the trip.',
    startLabel: 'Start the demo',
    finishLabel: 'Run it again',
    steps: SALESMAN_STEPS,
  },
  owner: {
    id: 'owner',
    title: 'How the owner app works',
    short: 'Owner demo',
    blurb: 'The whole app in the order you will use it: set up, stock in, sell, deliver, collect, check.',
    startLabel: 'Start the tour',
    finishLabel: 'Close and sign in',
    steps: OWNER_STEPS,
  },
};
