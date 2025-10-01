// components/jotformMap.js

// ---------- utils ----------
const asNumber = (val) => {
  if (val == null) return undefined;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const m = val.replace(/[$,]/g, "").match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : undefined;
  }
  return undefined;
};

export function monthKey(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function bucketCard(cardLabel) {
  const s = (cardLabel || "").toLowerCase();
  if (s.includes("youth")) return "Youth";
  if (s.includes("housing")) return "Housing";
  return "Housing";
}

const pick = (obj, labels) => {
  for (const key of labels) {
    const v = obj?.[key];
    if (v != null && v !== "") return v;
  }
};

// ---------- card submissions (existing) ----------
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

// Credit Card normalize (Transaction 1..5 costs)
export function normalizeSubmission(sub) {
  const { byLabel, byId } = buildMaps(sub);

  const createdAt = sub?.created_at || new Date().toISOString();
  const cardLabel =
    byId?.["33"]?.answer ||
    pick(byLabel, ["Card charged", "Card being returned"]) ||
    "";

  const email =
    byId?.["56"]?.answer ||
    pick(byLabel, ["Email", "Email address", "email"]) ||
    "";

  const fallbackMerchant = pick(byLabel, [
    "Merchant",
    "Vendor",
    "What was purchased?",
    "Description",
  ]);
  const fallbackExpense = pick(byLabel, ["Expense Type", "Category"]);

  const slots = [
    { m: "82",  e: "84",  c: "86",  cust: "156", files: "70",  notes: "151" },
    { m: "182", e: "183", c: "107", cust: "185", files: "109", notes: "143" },
    { m: "187", e: "188", c: "115", cust: "190", files: "117", notes: "147" },
    { m: "192", e: "193", c: "123", cust: "195", files: "125", notes: ""    },
    { m: "197", e: "198", c: "131", cust: "200", files: "133", notes: ""    },
  ];

  const items = [];
  for (const s of slots) {
    const m = byId?.[s.m]?.answer ?? (s.m === "82" ? fallbackMerchant : "");
    const e = byId?.[s.e]?.answer ?? (s.e === "84" ? fallbackExpense : "");
    const c = asNumber(byId?.[s.c]?.answer);
    if (c != null && !Number.isNaN(c)) {
      // files array
      const f = byId?.[s.files]?.answer;
      const files = Array.isArray(f) ? f : f ? [f] : [];
      items.push({
        id: sub?.id,
        source: "card",
        createdAt,
        merchant: String(m || "").trim(),
        expenseType: String(e || "").trim(),
        program: byId?.["169"]?.answer || "", // Supportive Services Program (top-level if present)
        card: String(cardLabel || "").trim(),
        email: String(email || "").trim(),
        customer: byId?.[s.cust]?.answer || "",
        amount: c,
        files,
        notes: s.notes ? (byId?.[s.notes]?.answer || "") : "",
        raw: sub,
      });
    }
  }

  if (items.length === 0) {
    items.push({
      id: sub?.id,
      source: "card",
      createdAt,
      merchant: String(fallbackMerchant || "").trim(),
      expenseType: String(fallbackExpense || "").trim(),
      program: byId?.["169"]?.answer || "",
      card: String(cardLabel || "").trim(),
      email: String(email || "").trim(),
      customer: byId?.["156"]?.answer || "",
      amount: 0,
      files: [],
      notes: "",
      raw: sub,
    });
  }
  return items;
}

// ---------- invoice submissions (new) ----------
/**
 * We extract: createdAt, merchant, expenseType/program (by labels),
 * amount, customer name, files.
 * You can refine the label IDs once you inspect the true invoice form JSON,
 * but this works off common Jotform patterns.
 */
export function normalizeInvoice(sub) {
  const { byLabel, byId } = buildMaps(sub);
  const createdAt = sub?.created_at || new Date().toISOString();

  // Likely labels in invoice form; adjust as needed after first run inspection
  const merchant =
    pick(byLabel, ["Merchant", "Vendor", "Payee", "Business Name"]) || "";
  const expenseType =
    pick(byLabel, ["Expense Type", "Category", "Reason"]) || "";
  const program =
    pick(byLabel, [
      "Supportive Services Program",
      "Program",
      "Bill To",
      "Funding Source",
    ]) || "";
  const customer =
    pick(byLabel, ["Customer Name", "Client Name", "Household", "Participant"]) || "";
  const email =
    pick(byLabel, ["Email", "Email address", "Requester Email"]) || "";

  // Try common amount labels, fall back to any numeric "Amount"/"Total"
  const amountRaw =
    pick(byLabel, ["Cost", "Amount", "Total", "Invoice Total", "Line Item Amount"]) || "";
  const amount = asNumber(amountRaw) ?? 0;

  // Attached invoice / receipts
  const fileGuess = (
    Object.values(byId)
      .filter(a => a?.type === "control_fileupload")
      .map(a => a?.answer)
      .flat()
      .filter(Boolean)
  ) || [];
  const files = Array.isArray(fileGuess) ? fileGuess : [fileGuess];

  return [
    {
      id: sub?.id,
      source: "invoice",
      createdAt,
      merchant: String(merchant).trim(),
      expenseType: String(expenseType).trim(),
      program: String(program).trim(),
      card: "", // not a card item
      email: String(email).trim(),
      customer: String(customer).trim(),
      amount: amount || 0,
      files,
      notes: pick(byLabel, ["Notes", "Justification", "Comments"]) || "",
      raw: sub,
    },
  ];
}

// ---------- budget classification ----------
/**
 * Turn an item into one or more budget buckets you care about.
 * This uses `program` and `expenseType` text matching.
 */
export function classifyProgram(item) {
  const p = (item.program || "").toLowerCase();
  const e = (item.expenseType || "").toLowerCase();

  const buckets = [];

  // WIOA
  if (p.includes("wioa") || e.includes("wioa")) {
    buckets.push("WIOA Supportive Services");
  }

  // Chafee
  if (p.includes("chafee") || e.includes("chafee")) {
    buckets.push("Chafee Supportive Services");
  }

  // YHDP SN & DIV
  if (p.includes("yhdp sn")) buckets.push("YHDP SN Supportive Service");
  if (p.includes("yhdp div")) buckets.push("YHDP DIV Supportive Service");

  // YHDP Flex (track clients list separately)
  if (p.includes("flex")) {
    buckets.push("YHDP FLEX");
  }
  if (/bill to bp.*flex/i.test(item.program || "")) {
    buckets.push("YHDP FLEX");
  }

  // PATH buckets
  if (p.includes("path") || e.includes("path")) {
    if (/direct/i.test(p) || /direct/i.test(e) || /supportive service/i.test(p+e)) {
      buckets.push("PATH: Direct Supportive Services");
    }
    if (/indirect/i.test(p) || /outreach supplies/i.test(p+e)) {
      buckets.push("PATH: Indirect Program Expenses (outreach supplies)");
    }
    if (/supplies.*staff/i.test(p+e)) {
      buckets.push("PATH: Supplies for staff");
    }
    if (/training|travel/i.test(p+e)) {
      buckets.push("PATH: Training & Travel");
    }
  }

  // If nothing matched but we have explicit program text, keep it as a generic bucket
  if (buckets.length === 0 && item.program) {
    buckets.push(item.program);
  }

  return buckets;
}
