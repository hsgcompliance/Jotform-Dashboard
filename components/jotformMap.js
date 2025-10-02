// components/jotformMap.js
//
// Normalize Jotform submissions into uniform line items for cards + invoices

// ─────────── helpers ───────────
const asNumber = (val) => {
  if (val == null) return undefined;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const m = val.replace(/[$,]/g, "").match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : undefined;
  }
  return undefined;
};

const textify = (v) => (v == null ? "" : String(v).trim());
const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const truthy = (v) => {
  if (Array.isArray(v)) return v.length > 0; // checkbox with any selection
  const s = String(v ?? '').trim().toLowerCase();
  return ['y','yes','true','1','checked','on'].includes(s);
};

function findFlexFlag(byId) {
  // Accept labels like: "Is Flex Funds?", "Flex Funds", "YHDP Flex Funds?"
  for (const a of Object.values(byId || {})) {
    const label = String(a?.label || a?.text || a?.name || '').toLowerCase();
    if (label.includes('flex') && label.includes('fund')) {
      const val = a?.prettyFormat ?? a?.answer ?? a?.value ?? '';
      return truthy(val);
    }
  }
  return false;
}

function buildMaps(sub) {
  const ans = sub?.answers || {};
  const byId = {};
  const byLabel = {};
  for (const qid of Object.keys(ans)) {
    const a = ans[qid];
    byId[qid] = a;
    const label = (a?.label || a?.text || a?.name || "").trim();
    const rawAns = a?.prettyFormat ?? a?.answer ?? a?.value ?? "";
    if (label) byLabel[label] = rawAns;
  }
  return { byId, byLabel };
}

// ──────────────────────────────────────────────────────────────────────────────
// CREDIT CARDS (form 251878265158166)
// ──────────────────────────────────────────────────────────────────────────────
function normalizeCreditCard(sub) {
  const { byId } = buildMaps(sub);

  const createdAt = sub?.created_at || new Date().toISOString();
  const isFlex = findFlexFlag(byId);

  // Card label → infer bucket
  const cardLabel =
    textify(byId?.["33"]?.answer) ||
    // try to pull from the summary text if user typed it there
    (textify(byId?.["64"]?.text).match(/Card charged:\s*([^<\n]+)/i)?.[1] || "");

  const cardBucket = bucketCard(cardLabel);

  // per-transaction id slots (merchant/expense/program/customer/cost/file)
  const slots = [
    { m: "82",  e: "84",  p: "169", cName: "156", cost: "86",  file: "70"  }, // t1 (file 70 is global; keep on t1 too)
    { m: "182", e: "183", p: "184", cName: "185", cost: "107", file: "109" },
    { m: "187", e: "188", p: "189", cName: "190", cost: "115", file: "117" },
    { m: "192", e: "193", p: "194", cName: "195", cost: "123", file: "125" },
    { m: "197", e: "198", p: "199", cName: "200", cost: "131", file: "133" },
  ];

  const items = [];
  for (const s of slots) {
    const amount = asNumber(byId?.[s.cost]?.answer);
    if (amount == null || Number.isNaN(amount)) continue;

    const merchant = textify(byId?.[s.m]?.answer);
    const expenseType = textify(byId?.[s.e]?.answer);
    const program = textify(byId?.[s.p]?.answer);
    const customer = textify(byId?.[s.cName]?.answer);
    const fileList = [
      ...arr(byId?.[s.file]?.answer),
      ...(s === slots[0] ? arr(byId?.["70"]?.answer) : []), // include top-level upload on first txn too
    ].filter(Boolean);

    items.push({
      id: sub?.id,
      baseId: sub?.id,
      source: "credit-card",          // normalized lowercase
      createdAt,
      card: cardLabel || cardBucket,  // raw text if present; else bucket
      cardBucket,                     // "Housing" | "Youth" | ""
      merchant,
      expenseType,
      program,
      customer,
      amount,
      files: fileList,
      isFlex,
      raw: sub,
    });
  }

  // If nothing parsed but we want visibility, emit a zero row
  if (items.length === 0) {
    items.push({
      id: sub?.id,
      baseId: sub?.id,
      source: "credit-card",
      createdAt,
      card: cardLabel || cardBucket,
      cardBucket,
      merchant: textify(byId?.["82"]?.answer),
      expenseType: textify(byId?.["84"]?.answer),
      program: textify(byId?.["169"]?.answer),
      customer: textify(byId?.["156"]?.answer),
      amount: asNumber(byId?.["86"]?.answer) ?? 0,
      files: arr(byId?.["70"]?.answer),
      isFlex,
      raw: sub,
    });
  }

  return items;
}

// ──────────────────────────────────────────────────────────────────────────────
// INVOICES (form 252674777246167)
// Handles: For a Client, For a Program, single and multi-grant splits
// ──────────────────────────────────────────────────────────────────────────────
function invoiceGrantSplits(byId) {
  // billTo ids & amount ids are paired by index if present
  const billToIds = ["112", "116", "117", "118", "119"];
  const amountIds = ["124", "125", "126", "127", "128", "129", "130", "131", "132", "133"];

  const billVals = billToIds.map((id) => textify(byId?.[id]?.answer)).filter((x) => x !== "");
  const amtVals = amountIds
    .map((id) => {
      const n = asNumber(byId?.[id]?.answer);
      return n != null && !Number.isNaN(n) ? n : null;
    })
    .filter((x) => x != null);

  const rows = [];
  const n = Math.min(billVals.length, amtVals.length);
  for (let i = 0; i < n; i++) rows.push({ billedTo: billVals[i], amount: amtVals[i] });
  return rows;
}

function normalizeInvoice(sub) {
  const { byId } = buildMaps(sub);
  const isFlex = findFlexFlag(byId);
 // official spend date priority: invoice(31) → submission(4) → created_at
 const createdAt =
   byId?.["31"]?.prettyFormat ||
   byId?.["4"]?.prettyFormat ||
   sub?.created_at ||
   new Date().toISOString();

  // Primary fields
  const vendor        = textify(byId?.["74"]?.answer); // Vendor Receiving Payment (merchant)
  const expenseType   = textify(byId?.["34"]?.answer); // For a Client | For a Program
  const serviceType   = textify(byId?.["53"]?.answer); // Program-ish (e.g., YHDP Flex Funds)
  const billedTo112   = textify(byId?.["112"]?.answer); // Bill To
  const purchaser     = textify(byId?.["33"]?.answer); // Purchaser
  const projectTop    = textify(byId?.["55"]?.answer); // Project (top-level)
  const paymentMethod = textify(byId?.["95"]?.answer); // Payment Method
  const note          = textify(byId?.["111"]?.answer); // Note
  const email         = textify(byId?.["25"]?.answer); // Hidden email
  const firstName     = textify(byId?.["84"]?.answer);
  const lastName      = textify(byId?.["85"]?.answer);
  const customer      = [firstName, lastName].filter(Boolean).join(" ").trim(); // may be blank for Program

  // Billing target + descriptor rules (your spec)
  const isCustomer = /^for a customer/i.test(expenseType);
  // Where $$ is billed:
  // - For Customer: use Project
  // - For Program: use Bill To
  const billingTarget = isCustomer ? (projectTop || "") : (billedTo112 || "");
  // 'program' field we expose for rollups: the billing target (deterministic)
  const program = billingTarget || projectTop || billedTo112 || "";
  // descriptor (optional) for UI display
  const descriptor = isCustomer ? serviceType : "";

  const isMulti = (textify(byId?.["114"]?.answer) || "").toLowerCase().startsWith("y"); // “Bill to Multiple Grants?” Yes

  const common = {
    source: "invoice",
    createdAt,
    merchant: vendor || "",
    expenseType,
    program,
    descriptor,
    project: projectTop || "",
    purchaser,
    customer, // blank when not applicable
    email,
    paymentMethod,
    note,
    files: [
      ...arr(byId?.["7"]?.answer),   // itemized receipt
      ...arr(byId?.["28"]?.answer),  // Chafee/PATH/required docs
      ...arr(byId?.["29"]?.answer),  // training/conference agenda
    ].filter(Boolean),
    isFlex,
    raw: sub,
  };

  const items = [];

  if (isMulti) {
    const splits = invoiceGrantSplits(byId); // pairs billTo*** with amountTo***
    if (splits.length) {
      splits.forEach((s, i) => {
        items.push({
          id: `${sub.id}-${i}`,
          baseId: sub.id,
          ...common,
          billedTo: s.billedTo || billingTarget,
          amount: s.amount ?? 0,
        });
      });
      return items;
    }
    // If “multiple” selected but no pairs found, fall through to single
  }

  // Single-line invoice: amount from Cost (17), billedTo prefer 112 then project
  const amount = asNumber(byId?.["17"]?.answer) ?? 0;
  const billedTo = billingTarget;

  items.push({
    id: sub.id,
    baseId: sub.id,
    ...common,
    billedTo,
    amount,
  });

  return items;
}

// ─────────── utilities we export for callers ───────────
export function bucketCard(cardLabel = "") {
  const s = String(cardLabel).toLowerCase();
  if (s.includes("youth")) return "Youth";
  if (s.includes("housing")) return "Housing";
  return "";
}

export function monthKey(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────
export function normalizeSubmission(sub) {
  const formId = String(sub?.form_id || "");
  if (formId === "251878265158166") return normalizeCreditCard(sub);
  if (formId === "252674777246167") return normalizeInvoice(sub);

  // Unknown form: pass through as one row
  return [
    {
      id: sub?.id,
      baseId: sub?.id,
      source: "unknown",
      createdAt: sub?.created_at || new Date().toISOString(),
      amount: 0,
      raw: sub,
    },
  ];
}