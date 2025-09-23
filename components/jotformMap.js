// components/jotformMap.js
// Normalize one Jotform submission → { id, createdAt, merchant, expenseType, card, amount, raw }

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

export function normalizeSubmission(sub) {
  // Build a label → answer map, using the friendliest properties first
  const answers = sub?.answers || {};
  const byLabel = {};
  for (const qid of Object.keys(answers)) {
    const a = answers[qid];
    const label = (a?.label || a?.text || a?.name || "").trim();
    // prefer prettyFormat, then answer, then value
    const rawAns = a?.prettyFormat ?? a?.answer ?? a?.value ?? "";
    if (label) byLabel[label] = rawAns;
  }

  // Heuristics based on your PDF/CSV descriptions
  const card = pick(byLabel, [
    "Card charged",
    "Card being returned",
    "CREDIT CARD CHECKOUT SUMMARY Card charged",
  ]);

  const merchant = pick(byLabel, [
    "Merchant",
    "Vendor",
    "What was purchased?",
    "Description",
  ]);

  const expenseType = pick(byLabel, [
    "Expense Type",
    "Category",
    "Account / Category",
  ]);

  // Amount (try multiple labels; fallback to parsing any numeric)
  let amount =
    asNumber(pick(byLabel, ["Amount", "Total", "Charge amount", "Total Amount"])) ??
    0;

  // Timestamp: prefer JF created_at; otherwise now
  const createdAt = sub?.created_at || new Date().toISOString();

  return {
    id: sub?.id || sub?.submission_id,
    createdAt,
    merchant: String(merchant || "").trim(),
    expenseType: String(expenseType || "").trim(),
    card: String(card || "").trim(), // e.g., "Info-Only Card: Housing (B-4079)"
    amount,
    raw: sub,
  };
}

// Bucket the card to {Housing|Youth} with conservative defaults
export function bucketCard(cardLabel) {
  const s = (cardLabel || "").toLowerCase();
  if (s.includes("youth")) return "Youth";
  if (s.includes("housing")) return "Housing";
  // fallback: treat unknowns as Housing unless you want a separate "Unknown"
  return "Housing";
}

export function monthKey(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
