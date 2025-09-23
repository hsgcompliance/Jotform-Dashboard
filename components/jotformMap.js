// components/jotformMap.js
// Normalize a Jotform submission into line-items (one per transaction)

const asNumber = (val) => {
  if (val == null) return undefined;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const m = val.replace(/[$,]/g, "").match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : undefined;
  }
  return undefined;
};

const pick = (obj, labels) => {
  for (const key of labels) {
    const v = obj?.[key];
    if (v != null && v !== "") return v;
  }
};

// Build label and id maps for easy lookups
function buildMaps(sub) {
  const answers = sub?.answers || {};
  const byLabel = {};
  const byId = {};
  for (const qid of Object.keys(answers)) {
    const a = answers[qid];
    byId[qid] = a;
    const label = (a?.label || a?.text || a?.name || "").trim();
    const rawAns = a?.prettyFormat ?? a?.answer ?? a?.value ?? "";
    if (label) byLabel[label] = rawAns;
  }
  return { byLabel, byId };
}

// Return array of line items for this submission
export function normalizeSubmission(sub) {
  const { byLabel, byId } = buildMaps(sub);

  // Card — prefer explicit radio (33), fallback to summary text
  const cardLabel =
    byId?.["33"]?.answer ||
    pick(byLabel, [
      "Card charged",
      "Card being returned",
      "CREDIT CARD CHECKOUT SUMMARY Card charged",
    ]) ||
    "";

  // Email (id 56 in your schema)
  const email =
    byId?.["56"]?.answer ||
    pick(byLabel, ["Email", "Email address", "email"]) ||
    "";

  // Top-of-form “Transaction 1” fields also exist as plain Merchant/Expense/Cost
  const fallbackMerchant = pick(byLabel, [
    "Merchant",
    "Vendor",
    "What was purchased?",
    "Description",
  ]);
  const fallbackExpense = pick(byLabel, [
    "Expense Type",
    "Category",
    "Account / Category",
  ]);

  const createdAt = sub?.created_at || new Date().toISOString();

  // Known slots from your schema (IDs from your sample payload)
  // t1: Merchant(82)  Expense(84)  Cost(86)
  // t2: Merchant(182) Expense(183) Cost(107)
  // t3: Merchant(187) Expense(188) Cost(115)
  // t4: Merchant(192) Expense(193) Cost(123)
  // t5: Merchant(197) Expense(198) Cost(131)
  const slots = [
    { m: "82",  e: "84",  c: "86"  },
    { m: "182", e: "183", c: "107" },
    { m: "187", e: "188", c: "115" },
    { m: "192", e: "193", c: "123" },
    { m: "197", e: "198", c: "131" },
  ];

  const items = [];
  for (const s of slots) {
    const m = byId?.[s.m]?.answer ?? (s.m === "82" ? fallbackMerchant : "");
    const e = byId?.[s.e]?.answer ?? (s.e === "84" ? fallbackExpense : "");
    const c = asNumber(byId?.[s.c]?.answer);
    if (c != null && !Number.isNaN(c)) {
      items.push({
        id: sub?.id || sub?.submission_id,
        createdAt,
        merchant: String(m || "").trim(),
        expenseType: String(e || "").trim(),
        card: String(cardLabel || "").trim(),
        email: String(email || "").trim(),
        amount: c,
        raw: sub,
      });
    }
  }

  // If nothing matched, emit a single zero row so the submission is still visible (optional)
  if (items.length === 0) {
    items.push({
      id: sub?.id || sub?.submission_id,
      createdAt,
      merchant: String(fallbackMerchant || "").trim(),
      expenseType: String(fallbackExpense || "").trim(),
      card: String(cardLabel || "").trim(),
      email: String(email || "").trim(),
      amount: 0,
      raw: sub,
    });
  }

  return items;
}

// Collapse a card label down to "Housing" or "Youth"
export function bucketCard(cardLabel) {
  const s = (cardLabel || "").toLowerCase();
  if (s.includes("youth")) return "Youth";
  if (s.includes("housing")) return "Housing";
  return "Housing";
}

export function monthKey(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
