// components/jotformMap.js
//
// Normalize Jotform submissions into uniform line items for cards + invoices
import {
  CC_SCHEMA,
  INVOICE_SCHEMA,
  getAns,
  getFiles,
  iterateCreditCardTxns,
  resolveInvoice,
} from "../components/formSchemas";

// ─────────── tiny helpers ───────────
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

const textify = (v) => (v == null ? "" : String(v).trim());

function toISO(s) {
  if (!s) return "";
  const str = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) return str.replace(" ", "T");
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?$/i);
  if (m) {
    let [, mm, dd, yyyy, hh="00", mi="00", ap] = m; let H = +hh;
    if (ap) { const u = ap.toUpperCase(); if (u==="PM"&&H<12) H+=12; if (u==="AM"&&H===12) H=0; }
    return `${yyyy}-${String(+mm).padStart(2,"0")}-${String(+dd).padStart(2,"0")}T${String(H).padStart(2,"0")}:${String(+mi).padStart(2,"0")}:00`;
  }
  const d = new Date(str); return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0,19);
}

// ──────────────────────────────────────────────────────────────────────────────
// CREDIT CARDS (form 251878265158166)
// Uses CC_SCHEMA + iterateCreditCardTxns; “order” only for blocking.
// CreatedAt = submission.created_at (return time can be buggy).
// If card identity (33) is blank (skipped workflow), we still record as “Card”.
// Entire submission isFlex = true if ANY txn toggled isFlexTxn (exposed as submissionIsFlex).
// ──────────────────────────────────────────────────────────────────────────────
function normalizeCreditCard(sub) {
  const answers = sub?.answers || {};
  const createdAt = toISO(sub?.created_at) || new Date().toISOString();

  const cardLabel = textify(getAns(answers, CC_SCHEMA.globals.cardChoice)) || "Card";
  const cardBucket = bucketCard(cardLabel);

  const items = [];
  let anyFlex = false;

  for (const t of iterateCreditCardTxns(answers)) {
    anyFlex = anyFlex || !!t.isFlexTxn;

    items.push({
      id: `${sub.id}-t${t.n}`,
      baseId: sub.id,
      source: "credit-card",
      createdAt, // per spec: prefer created_at for CC
      card: cardLabel,
      cardBucket,

      // normalized per-txn fields
      merchant: textify(t.merchant),
      expenseType: textify(t.expenseType),
      // program: whichever of Supportive Services / Program Operations is present (txn-scoped)
      program: textify(t.supportiveProgram || t.programOperations || ""),
      customer: textify(t.customer),
      amount: Number(t.amount || 0),
      files: Array.isArray(t.files) ? t.files : (t.files ? [t.files] : []),

      // txn-level flex (true only when this txn is Flex)
      isFlex: !!t.isFlexTxn,

      raw: sub,
    });
  }

  // If nothing parsed, emit a “visibility row” with best-effort fields from Tx1
  if (items.length === 0) {
    const t1 = CC_SCHEMA.transactions?.[0] || {};
    const cost = getAns(answers, t1.cost);
    const amount = Number(String(cost ?? "").replace(/[$,]/g, "")) || 0;

    const flexToggleVal = getAns(answers, t1.flexToggle);
    const isFlexTxn = /^y/i.test(String(flexToggleVal || ""));

    anyFlex = anyFlex || isFlexTxn;

    items.push({
      id: `${sub.id}-t1`,
      baseId: sub.id,
      source: "credit-card",
      createdAt,
      card: cardLabel,
      cardBucket,
      merchant: textify(getAns(answers, t1.merchant)),
      expenseType: textify(getAns(answers, t1.expenseType)),
      program: textify(getAns(answers, t1.supportiveProgram) || getAns(answers, t1.programOperations)),
      customer: textify(getAns(answers, t1.customerName)),
      amount,
      files: getFiles(answers, t1.files || []),
      isFlex: isFlexTxn,
      raw: sub,
    });
  }

  // Add submission-level flex awareness to each row (without losing txn flag)
  return items.map((r) => ({
    ...r,
    submissionIsFlex: anyFlex,
  }));
}

// ──────────────────────────────────────────────────────────────────────────────
// INVOICES (form 252674777246167)
// Uses resolveInvoice; supports Customer path (Project/Other) & Program path (Bill To / Other).
// Pairs splits by index; single path uses cost(17).
// createdAt priority: invoice(31) → submission(4) → submission.created_at
// ──────────────────────────────────────────────────────────────────────────────


function normalizeInvoice(sub) {
  const answers = sub?.answers || {};
  const soln = resolveInvoice(answers);
  const invRaw    = getAns(answers, INVOICE_SCHEMA.globals.invoiceDate);
  const subDate   = getAns(answers, INVOICE_SCHEMA.globals.submissionDate);
  const createdAt = toISO(invRaw) || toISO(subDate) || toISO(sub?.created_at) || new Date().toISOString();

  const vendor        = textify(getAns(answers, INVOICE_SCHEMA.globals.vendor));
  const expenseType   = textify(getAns(answers, INVOICE_SCHEMA.globals.expenseType));
  const purchaser     = textify(getAns(answers, INVOICE_SCHEMA.globals.purchaser));
  const paymentMethod = textify(getAns(answers, INVOICE_SCHEMA.globals.paymentMethod));
  const email         = textify(getAns(answers, INVOICE_SCHEMA.globals.email));
  const note          = textify(getAns(answers, INVOICE_SCHEMA.globals.note));
  const costSingleRaw = getAns(answers, INVOICE_SCHEMA.globals.costSingle);
  const costSingle    = Number(String(costSingleRaw ?? "").replace(/[$,]/g, "")) || 0;

  // Stronger flex: schema-derived OR any “flex funds” text anywhere
  const anyFlexText = /flex\s*fund/i.test(JSON.stringify(answers).toLowerCase());
  const isFlex = !!(soln.isFlex || anyFlexText);

  const common = {
    source: "invoice",
    createdAt,
    merchant: vendor,
    expenseType,
    program: soln.program || "",           // unified program field (for rollups)
    descriptor: soln.path === "customer" ? soln.serviceType || "" : "",
    project: soln.project || "",
    purchaser,
    customer: soln.customer || "",
    email,
    paymentMethod,
    note,
    files: soln.files_typed?.all || [],    // merge all files (typed buckets still accessible via soln.files_typed)
    isFlex,
    raw: sub,
  };

  const items = [];

  // If resolveInvoice provided indexed splits, emit one row per split (path-agnostic)
  if (Array.isArray(soln.splits) && soln.splits.length > 0) {
    soln.splits.forEach((s, i) => {
      const lineProgram = textify(s.program || common.program);
      const lineBilled  = textify(s.billedTo || (soln.path === "program" ? lineProgram : ""));
      items.push({
        id: `${sub.id}-${i}`,
        baseId: sub.id,
        ...common,
        program: lineProgram,
        billedTo: lineBilled,
        amount: Number(s.amount || 0),
      });
    });
    return items;
  }

  // Single-line invoice fallback
  const billedSingle = soln.path === "program" ? (common.program || "") : "";
  items.push({
    id: sub.id,
    baseId: sub.id,
    ...common,
    billedTo: billedSingle,
    amount: costSingle,
  });

  return items;
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
