// pages/line-items.js
import React from "react";
import useSWR from "swr";
import { bucketCard } from "../components/jotformMap";
import {
  CC_SCHEMA,
  INVOICE_SCHEMA,
  getAns,
  iterateCreditCardTxns,
  resolveInvoice,
} from "../components/formSchemas";
import AdvancedBudgetEditorModal from "../components/AdvancedBudgetEditorModal"; // ← ad-hoc filter UI

import {
  Button,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Tabs,
  Tab,
  Chip,
  Tooltip,
  DialogActions,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FilterAltIcon from "@mui/icons-material/FilterAlt";

/* ---------------- fetch ---------------- */
const fetcher = (u) => fetch(u).then((r) => r.json());

/* ---------------- helpers ---------------- */
const stripHtml = (s = "") => String(s).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/** Decide if row represents an invoice */
function isInvoiceRow(row) {
  if ((row?.source || "").toLowerCase() === "invoice") return true;
  if (row?._type?.key === "invoice") return true;
  return false;
}

/** Robust-ish date getter used for display, filtering and sorting */
function rowDateStr(row) {
  // Invoices: prefer Invoice Date (31.prettyFormat) → createdAt → raw.created_at
  if (isInvoiceRow(row)) {
    const ans = row?.raw?.answers || {};
    const inv = ans?.[INVOICE_SCHEMA.globals.invoiceDate]?.prettyFormat || "";
    if (inv) return inv;
    return row?.createdAt || row?.raw?.created_at || "";
  }
  // Credit cards: createdAt (return time can be buggy)
  return row?.createdAt || row?.raw?.created_at || "";
}

/** Filtering helper uses rowDateStr (so UI + filter stay in sync) */
const within = (row, from, to) => {
  const s = rowDateStr(row);
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return false;
  if (from) {
    const f = new Date(from + "T00:00:00").getTime();
    if (t < f) return false;
  }
  if (to) {
    const tt = new Date(to + "T23:59:59").getTime();
    if (t > tt) return false;
  }
  return true;
};

function getSubmittedBy(row) {
  if (row.purchaser && String(row.purchaser).trim()) return row.purchaser;
  if (row.submitter && String(row.submitter).trim()) return row.submitter;
  const byId = row?.raw?.answers || {};
  const fromId = (id) => byId?.[id]?.answer ?? byId?.[id]?.prettyFormat ?? "";
  const ccName = fromId(CC_SCHEMA.globals.purchaserName);
  if (ccName) return String(ccName).trim();
  const invPurchaser = fromId(INVOICE_SCHEMA.globals.purchaser);
  if (invPurchaser) return String(invPurchaser).trim();
  return "";
}

function decideType(row) {
  if ((row.source || "").toLowerCase() === "invoice") return { key: "invoice", label: "Invoice" };
  const cardName = row.card || row.cardLabel || "";
  const bucket = bucketCard(cardName);
  if (bucket === "Youth") return { key: "youth", label: "Youth Card" };
  if (bucket === "Housing") return { key: "housing", label: "Housing Card" };
  return { key: "card", label: "Card" };
}

/** Single source of truth for displayed date */
function displayDate(row) {
  return rowDateStr(row);
}

/** Prefer normalized flag first; fallback to heuristic */
function isYHDPFlex(row) {
  if (row?.isFlex === true || row?.submissionIsFlex === true) return true;
  const s = (row.descriptor || row.serviceType || row.program || "").toLowerCase();
  return s.includes("flex") && s.includes("yhdp");
}

function saveAs(url, filename) {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    window.open(url, "_blank");
  }
}

/* ---------------- value-only search + bucket helpers ---------------- */
const _ansOnlyVal = (a) => {
  const v = a?.prettyFormat ?? a?.answer ?? a?.value ?? "";
  if (Array.isArray(v)) return v.map((x) => _ansOnlyVal({ answer: x })).join(" ");
  if (v && typeof v === "object") return Object.values(v).map((x) => String(x ?? "")).join(" ");
  return String(v ?? "");
};

const ans = (answers, id) => _ansOnlyVal(answers?.[id]);

/** Invoice buckets: purpose/note/other (“Other” = project/bill-to others + service “Other” + WIOA scope) */
function buildInvoiceBuckets(answers) {
  const purpose = ans(answers, INVOICE_SCHEMA.globals.purposeDetail); // 75
  const note = ans(answers, INVOICE_SCHEMA.globals.note); // 111

  const projectOtherIds = ["154", "153", "152", "151", "150"]; // projectOther array
  const billToOtherIds = ["149", "148", "147", "146", "110"]; // billToOther array
  const otherPieces = [
    ans(answers, INVOICE_SCHEMA.globals.otherService), // 155, when Service Type = Other
    ...projectOtherIds.map((id) => ans(answers, id)),
    ...billToOtherIds.map((id) => ans(answers, id)),
    ans(answers, INVOICE_SCHEMA.globals.wioaScopeWex), // 134 (IS/OS; WEX/Non-WEX)
  ].filter(Boolean);

  return {
    purpose_text: purpose || "",
    note_text: note || "",
    other_text: otherPieces.join(" | "),
  };
}

/** Card buckets: purpose/note/other (Notes = all txn notes; Other = “What was purchased?”) */
function buildCardBuckets(answers) {
  const purposes = ["85", "106", "114", "122", "130"].map((id) => ans(answers, id)).filter(Boolean);
  const ccNotes = ["151", "145", "143", "147", "149"].map((id) => ans(answers, id)).filter(Boolean); // txn notes
  const otherPieces = [ans(answers, "167")].filter(Boolean); // “What was purchased?”

  return {
    purpose_text: purposes.join(" | "),
    note_text: ccNotes.join(" | "),
    other_text: otherPieces.join(" | "),
  };
}

/** Build a value-only haystack (no labels/keys) for search */
function answersHaystack(row) {
  const parts = [];
  const push = (v) => {
    if (v != null && String(v).trim()) parts.push(String(v));
  };

  // normalized values (derived from answers — safe to include)
  push(row.merchant);
  push(row.expenseType);
  push(row.program);
  push(row.billedTo);
  push(row.customer);
  push(row.card);
  push(row.cardBucket);
  push(row.purchaser);
  push(row.email);
  push(row.descriptor);
  push(row.purpose_text);
  push(row.note_text);
  push(row.other_text);

  // all raw answers' values (no labels)
  const answers = row?.raw?.answers || {};
  for (const a of Object.values(answers)) push(_ansOnlyVal(a));

  return parts.join(" ").toLowerCase();
}

/* --------- colors (chips) --------- */
const typeChipStyles = (key) => {
  switch (key) {
    case "invoice":
      return { bgcolor: "#e8f0fe", color: "#174ea6", borderColor: "#bcd0ff" };
    case "housing":
      return { bgcolor: "#fff4e5", color: "#8a3b00", borderColor: "#ffd8a8" };
    case "youth":
      return { bgcolor: "#efe2ff", color: "#5b21a2", borderColor: "#d1b3ff" };
    default:
      return { bgcolor: "#eef2f7", color: "#374151", borderColor: "#d7dde5" };
  }
};

const pill = (text, hint, danger) => (
  <span
    title={hint || ""}
    style={{
      padding: "1px 8px",
      borderRadius: 999,
      border: "1px solid",
      borderColor: danger ? "#f5c2c7" : "#bcd0ff",
      background: danger ? "#fff5f5" : "#eef5ff",
      fontSize: 12,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </span>
);

/* ---------------- table row cell helpers ---------------- */
const thCell = {
  width: 220,
  padding: "6px 8px",
  fontWeight: 600,
  verticalAlign: "top",
  textAlign: "left",
  borderBottom: "1px solid #eee",
};
const tdCell = { padding: "6px 8px", verticalAlign: "top", borderBottom: "1px solid #f4f4f4" };
const Row = ({ label, value }) => {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null; // Hide blank fields
  return (
    <tr>
      <td style={thCell}>{label}</td>
      <td style={tdCell}>{typeof value === "string" ? value : <>{value}</>}</td>
    </tr>
  );
};

/* ---------------- CC Structured View (schema-driven) ---------------- */
function CCStructuredSubmissionView({ answers = {}, subId }) {
  const a = (id) => getAns(answers, id);

  // Header summary (card can be blank if workflow bypass)
  const card = a(CC_SCHEMA.globals.cardChoice) || "Card";
  const purchaser = a(CC_SCHEMA.globals.purchaserName);
  const email = a(CC_SCHEMA.globals.email);
  const whatPurchased = a("85") || a("167"); // legacy “purpose” helper
  const summaryLines = [
    purchaser ? `Purchaser: ${purchaser}` : "",
    card ? `Card charged: ${card}` : "",
    whatPurchased ? `What was purchased?: ${whatPurchased}` : "",
  ].filter(Boolean);

  const txns = Array.from(iterateCreditCardTxns(answers));
  const anyFlex = txns.some((t) => t.isFlexTxn);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, background: "#f9fbff" }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>
          Card Checkout Summary{" "}
          {anyFlex && pill("YHDP Flex (submission)", "At least one transaction marked Flex")}
        </div>
        {summaryLines.length ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {summaryLines.map((l, i) => (
              <li key={i} style={{ fontSize: 13 }}>
                {stripHtml(l)}
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.7 }}>No summary provided.</div>
        )}
        {email ? (
          <div style={{ marginTop: 6, fontSize: 13 }}>
            <b>Email:</b> {email}
          </div>
        ) : null}
      </div>

      {txns.length ? (
        txns.map((t, i) => {
          const programFieldUsed = t.supportiveProgram
            ? "Supportive Services Program"
            : t.programOperations
            ? "Program Operations for"
            : "Program";
          return (
            <div
              key={i}
              style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, background: "#fff" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>Transaction {t.n}</div>
                {t.isFlexTxn && pill("YHDP Flex", "Txn flagged Flex")}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  <Row label="Merchant" value={t.merchant} />
                  <Row label="Purpose" value={t.purpose} />
                  <Row label="Expense Type" value={t.expenseType} />
                  <Row label={programFieldUsed} value={t.supportiveProgram || t.programOperations} />
                  <Row label="Customer Name" value={t.customer} />
                  <Row label="Cost" value={t.amount ? `$${Number(t.amount).toFixed(2)}` : ""} />
                  {!!(t.files || []).length && (
                    <tr>
                      <td style={thCell}>Files</td>
                      <td style={tdCell}>
                        {(t.files || []).map((u, j) => (
                          <div
                            key={j}
                            style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}
                          >
                            <span>{String(u).split("/").pop()}</span>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => saveAs(u, `${subId}-t${t.n}-${j}.pdf`)}
                            >
                              Download
                            </Button>
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                  <Row label="Notes" value={getAns(answers, CC_SCHEMA.transactions[t.n - 1].notes)} />
                </tbody>
              </table>
            </div>
          );
        })
      ) : (
        <div style={{ fontSize: 13, opacity: 0.7 }}>No transactions found.</div>
      )}
    </div>
  );
}

/* ---------------- Invoice Structured View (schema-driven) ---------------- */
function InvoiceStructuredView({ row }) {
  const answers = row?.raw?.answers || {};
  const soln = resolveInvoice(answers);

  const a = (id) => getAns(answers, id);
  const first = a(INVOICE_SCHEMA.globals.firstName);
  const last = a(INVOICE_SCHEMA.globals.lastName);
  const vendor = a(INVOICE_SCHEMA.globals.vendor);
  const serviceType = soln.serviceType || "";
  const otherService = soln.otherService || "";
  const files = soln.files_typed?.all || [];

  const showWIOA = !!a(INVOICE_SCHEMA.globals.wioaScopeWex);
  const scope = soln.serviceScope || "";
  const wex = soln.wex || "";

  // Totals logic: Cost (17) should equal sum of splits when multi
  const cost17 =
    Number(String(a(INVOICE_SCHEMA.globals.costSingle) ?? "0").replace(/[$,]/g, "")) || 0;
  const splits = Array.isArray(soln.splits) ? soln.splits : [];
  const splitTotal = splits.reduce((acc, s) => acc + Number(s.amount || 0), 0);
  const isMulti = splits.length > 0 && soln.path === "program";
  const mismatch = isMulti && Math.abs(cost17 - splitTotal) > 0.009;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Summary top table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>
          <Row label="Invoice Date" value={displayDate(row)} />
          <Row label="Vendor" value={row.merchant || vendor || "—"} />
          <Row label="Expense Type" value={row.expenseType || "—"} />
          {soln.path === "customer" ? (
            <>
              <Row label="Project" value={soln.project || soln.projectOther || "—"} />
              <Row label="Program (resolved)" value={soln.program || "—"} />
              <Row
                label="Customer"
                value={row.customer || [first, last].filter(Boolean).join(" ") || "—"}
              />
              <Row label="Service Type" value={serviceType || "—"} />
              {/other/i.test(serviceType) && (
                <Row label="Other Service" value={otherService || "—"} />
              )}
              {showWIOA && (
                <Row
                  label="WIOA Scope / WEX"
                  value={[scope, wex].filter(Boolean).join(" • ") || "—"}
                />
              )}
              <Row
                label="Payment Method"
                value={row.paymentMethod || a(INVOICE_SCHEMA.globals.paymentMethod) || "—"}
              />
              <Row label="Amount" value={`$${Number(row.amount || 0).toFixed(2)}`} />
            </>
          ) : (
            <>
              <Row
                label="Bill to Multiple Grants?"
                value={a(INVOICE_SCHEMA.programPath.multiToggle) || "—"}
              />
              <Row label="Primary Program (resolved)" value={soln.program || "—"} />
              {showWIOA && (
                <Row
                  label="WIOA Scope / WEX"
                  value={[scope, wex].filter(Boolean).join(" • ") || "—"}
                />
              )}
              <Row
                label="Payment Method"
                value={row.paymentMethod || a(INVOICE_SCHEMA.globals.paymentMethod) || "—"}
              />
            </>
          )}
          <Row label="Purchaser" value={row.purchaser || getSubmittedBy(row) || "—"} />
          <Row label="Email" value={row.email || a(INVOICE_SCHEMA.globals.email) || "—"} />
          <Row label="Note" value={row.note || a(INVOICE_SCHEMA.globals.note) || ""} />
          {/* Totals section always visible */}
          <Row label="Total Cost (17)" value={`$${cost17.toFixed(2)}`} />
          {isMulti && (
            <Row
              label="Split Total"
              value={
                <>
                  ${splitTotal.toFixed(2)}{" "}
                  {mismatch && pill("Mismatch", "Sum of splits != Cost (17)", true)}
                </>
              }
            />
          )}
        </tbody>
      </table>

      {/* Splits table (Program path) */}
      {isMulti && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Grant Splits</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thCell}>Billed To</th>
                <th style={thCell}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {splits.map((s, i) => (
                <tr key={i}>
                  <td style={tdCell}>{s.billedTo || s.program || "—"}</td>
                  <td style={tdCell}>${Number(s.amount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Files */}
      {files.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Files</div>
          {files.map((u, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}
            >
              <span>{String(u).split("/").pop()}</span>
              <Button
                size="small"
                variant="outlined"
                onClick={() => saveAs(u, `${row.baseId}-file-${i}.pdf`)}
              >
                Download
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Rule matching (same semantics as Budgets) ---------------- */
const norm = (s) => String(s || "").toLowerCase().trim();
const valOf = (it, field) => {
  switch (field) {
    case "bucket_text":
      return String(it.bucket_text || "");
    case "program_raw":
      return String(it.program_raw || "");
    case "billed_to_raw":
      return String(it.billed_to_raw || "");
    case "project_raw":
      return String(it.project_raw || "");
    case "expense_type_raw":
      return String(it.expense_type_raw || "");
    case "card_bucket":
      return String(it.card_bucket || "");
    case "merchant":
      return String(it.merchant || "");
    case "billedTo":
      return String(it.billedTo || "");
    case "isFlex":
      return String(it.isFlex === true || it.submissionIsFlex === true);
    default:
      return String(it[field] ?? "");
  }
};
const matchLeaf = (it, r) => {
  const v = norm(valOf(it, r.field));
  const m = norm(r.match ?? "");
  const mode = r.mode || "icontains";
  let ok = m ? (mode === "equals" ? v === m : v.includes(m)) : false;
  return r.not ? !ok : ok;
};
const matchesRules = (it, node, op = "OR") => {
  if (!node) return false;
  const rules = node.rules || [];
  if (!rules.length) return false;
  const evalRule = (x) => (x.rules ? matchesRules(it, x, x.op || "OR") : matchLeaf(it, x));
  const isAnd = (op || "OR").toUpperCase() === "AND";
  return isAnd ? rules.every(evalRule) : rules.some(evalRule);
};

/* ---------------- Main page ---------------- */
export default function LineItems() {
  const { data, error, isLoading, mutate } = useSWR("/api/purchases", fetcher, {
    refreshInterval: 300000,
  });
  const items = (data?.items || []).filter((r) => {
    const st = String(r?.raw?.status || r?.rawStatus || "").toUpperCase();
    return st === "" || st === "ACTIVE";
  });

  const [q, setQ] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState("desc"); // 'asc' | 'desc'
  const [sortField, setSortField] = React.useState("date"); // 'date' | 'amount' | 'note_any'
  const [typeFilter, setTypeFilter] = React.useState("all");

  const [modalRow, setModalRow] = React.useState(null);
  const [modalTab, setModalTab] = React.useState(0); // 0 structured, 1 raw item, 2 raw submission

  // ---- Ad-hoc filter (front-end only) using AdvancedBudgetEditorModal ----
  const [adhocOpen, setAdhocOpen] = React.useState(false);
  const [adhoc, setAdhoc] = React.useState({
    key: "adhoc",
    label: "Custom",
    budget: 0,
    startSpent: 0,
    from: "",
    to: "",
    type: "standard",
    rulesOp: "OR",
    rules: [{ field: "program_raw", match: "", mode: "icontains" }],
  });
  const [adhocActive, setAdhocActive] = React.useState(false);

  // blur before opening to avoid aria-hidden warning (focused button becomes hidden by dialog)
  const openAdhoc = (e) => {
    try {
      e?.currentTarget?.blur?.();
    } catch {}
    // next tick → let focus leave the button before Dialog mounts
    setTimeout(() => setAdhocOpen(true), 0);
  };

  // Enrich rows so rule engine sees the same fields Budgets uses
  const enriched = React.useMemo(() => {
    return items.map((x) => {
      const isInvoice = (x.source || "").toLowerCase() === "invoice";
      const a = x?.raw?.answers || {};
      const buckets = isInvoice ? buildInvoiceBuckets(a) : buildCardBuckets(a);

      const exp = String(x.expenseType || "");
      const program_raw = isInvoice
        ? exp.toLowerCase().includes("program")
          ? x.billedTo || x.program || x.project || ""
          : x.project || x.program || ""
        : x.program || "";

      const card_bucket =
        (x.card || "").toLowerCase().includes("youth")
          ? "Youth"
          : (x.card || "").toLowerCase().includes("housing")
          ? "Housing"
          : x.cardBucket || "";

      const billed_to_raw = x.billedTo || "";
      const project_raw = x.project || "";
      const descriptor = x.descriptor || "";

      const isFlex =
        x.isFlex === true ||
        x.submissionIsFlex === true ||
        String(program_raw + " " + billed_to_raw).toLowerCase().includes("yhdp flex") ||
        String(program_raw + " " + billed_to_raw).toLowerCase().includes("flex");

      const bucket_text = [
        program_raw,
        billed_to_raw,
        project_raw,
        descriptor,
        exp,
        x.card || "",
        card_bucket,
        x.merchant || "",
        x.customer || "",
        buckets.purpose_text,
        buckets.note_text,
        buckets.other_text,
      ]
        .filter(Boolean)
        .join(" | ");

      const noteAny = [buckets.note_text, buckets.purpose_text, buckets.other_text]
        .filter(Boolean)
        .join(" | ")
        .toLowerCase();

      return {
        ...x,
        ...buckets, // purpose_text / note_text / other_text
        program_raw,
        billed_to_raw,
        project_raw,
        descriptor,
        expense_type_raw: exp,
        card_bucket,
        bucket_text,
        isFlex,
        _type: decideType(x),
        _displayDate: rowDateStr(x), // pretty for UI
        _sortTs: Date.parse(x.createdAt) || 0, // machine for date sorting
        _noteAny: noteAny,
        _amountNum: Number(x.amount || 0),
        _submittedBy: getSubmittedBy(x) || "—",
        _email:
          x.email ||
          (x?.raw?.answers?.[CC_SCHEMA.globals.email]?.answer ??
            x?.raw?.answers?.[INVOICE_SCHEMA.globals.email]?.answer ??
            "—"),
      };
    });
  }, [items]);

  // Totals for YHDP Flex by client (based on normalized flags when possible)
  const flexSpendByClient = React.useMemo(() => {
    const acc = new Map();
    for (const r of enriched) {
      if (!r?.customer) continue;
      if (!isYHDPFlex(r)) continue;
      const key = String(r.customer).trim().toLowerCase();
      acc.set(key, (acc.get(key) || 0) + Number(r.amount || 0));
    }
    return acc;
  }, [enriched]);

  // First apply type/date/search
  const baseRows = React.useMemo(() => {
    const txt = q.toLowerCase();
    return enriched
      .filter((r) => (typeFilter === "all" ? true : r._type.key === typeFilter))
      .filter((r) => within(r, from, to))
      .filter((r) => !txt || answersHaystack(r).includes(txt));
  }, [enriched, q, from, to, typeFilter]);

  // Then optional ad-hoc rules + sort
  const filtered = React.useMemo(() => {
    const root = adhocActive ? { op: adhoc.rulesOp || "OR", rules: adhoc.rules || [] } : null;
    const rows = root ? baseRows.filter((r) => matchesRules(r, root, root.op)) : baseRows;

    // comparator by selected field
    const cmp = (() => {
      switch (sortField) {
        case "amount":
          return (a, b) => a._amountNum - b._amountNum;
        case "note_any":
          return (a, b) => a._noteAny.localeCompare(b._noteAny);
        case "date":
        default:
          return (a, b) => a._sortTs - b._sortTs;
      }
    })();

    rows.sort(cmp);
    if (sortOrder === "desc") rows.reverse();
    return rows;
  }, [baseRows, adhocActive, adhoc.rulesOp, adhoc.rules, sortField, sortOrder]);

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", padding: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0 }}>Line Items</h1>
        <Button size="small" onClick={() => mutate()}>
          Reload
        </Button>
        <TextField size="small" label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <TextField
          size="small"
          type="date"
          label="From"
          slotProps={{ inputLabel: { shrink: true } }}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <TextField
          size="small"
          type="date"
          label="To"
          slotProps={{ inputLabel: { shrink: true } }}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <TextField
          size="small"
          select
          label="Sort by"
          value={sortField}
          onChange={(e) => setSortField(e.target.value)}
        >
          <MenuItem value="date">Date</MenuItem>
          <MenuItem value="amount">Amount</MenuItem>
          <MenuItem value="note_any">Note / Purpose / Other (A→Z)</MenuItem>
        </TextField>
        <TextField
          size="small"
          select
          label="Order"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        >
          <MenuItem value="desc">Desc</MenuItem>
          <MenuItem value="asc">Asc</MenuItem>
        </TextField>
        <TextField
          size="small"
          select
          label="Type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="invoice">Invoice</MenuItem>
          <MenuItem value="housing">Housing Card</MenuItem>
          <MenuItem value="youth">Youth Card</MenuItem>
        </TextField>

        {/* Ad-hoc (front-end) filter using AdvancedBudgetEditorModal */}
        <Tooltip title="Custom filter (nested rules)">
          <IconButton size="small" onClick={openAdhoc}>
            <FilterAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {adhocActive && (
          <Chip
            size="small"
            variant="outlined"
            label={`Filter: ${adhoc.label || "Custom"}`}
            onDelete={() => setAdhocActive(false)}
          />
        )}
      </div>

      {isLoading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>Error: {String(error)}</p>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ minWidth: 1400, borderCollapse: "collapse" }}>
          <thead style={{ background: "#f7f7f7" }}>
            <tr>
              <Th>Date</Th>
              <Th>Type</Th>
              <Th>Merchant</Th>
              <Th>Expense Type</Th>
              <Th>Program</Th>
              <Th>Card</Th>
              <Th>Client</Th>
              <Th>Amount</Th>
              <Th>Submitted By</Th>
              <Th>Email</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => {
              const rowId = `${r.id}-${idx}`;
              const typeStyle = typeChipStyles(r._type.key);
              return (
                <tr key={rowId}>
                  <Td title={displayDate(r)}>{r._displayDate}</Td>
                  <Td>
                    <Chip
                      size="small"
                      variant="outlined"
                      sx={{ ...typeStyle, borderWidth: 1 }}
                      label={r._type.label}
                    />
                  </Td>
                  <Td title={r.merchant || ""}>{r.merchant || "—"}</Td>
                  <Td title={r.expenseType || ""}>{r.expenseType || "—"}</Td>
                  <Td title={r.program || ""}>{r.program || "—"}</Td>
                  <Td title={r.card || ""}>{r.card || "—"}</Td>
                  <Td title={r.customer || ""}>{r.customer || "—"}</Td>
                  <Td>${Number(r.amount || 0).toFixed(2)}</Td>
                  <Td>{r._submittedBy}</Td>
                  <Td>{r._email}</Td>
                  <Td style={{ whiteSpace: "nowrap" }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setModalRow(r);
                        setModalTab(0);
                      }}
                    >
                      Open
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal with tabs + inbox link */}
      <Dialog open={!!modalRow} onClose={() => setModalRow(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 7 }}>
          {modalRow ? `Submission ${modalRow.baseId || modalRow.id}` : "Submission"}
          {!!modalRow?.customer &&
            isYHDPFlex(modalRow) &&
            (() => {
              const k = String(modalRow.customer || "").trim().toLowerCase();
              const spent = flexSpendByClient.get(k) || 0;
              return (
                <span
                  style={{
                    marginLeft: 8,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: spent >= 400 ? "#ffecec" : "#fffbe6",
                    border: "1px solid #f5c2c7",
                    fontSize: 12,
                  }}
                >
                  YHDP Flex to date for client: ${Number(spent).toFixed(2)}{" "}
                  {spent >= 400 ? "(review waiver)" : ""}
                </span>
              );
            })()}
          {modalRow?.raw?.form_id && (modalRow?.baseId || modalRow?.id) && (
            <Button
              size="small"
              sx={{ ml: 1 }}
              onClick={() =>
                window.open(
                  `https://www.jotform.com/inbox/${modalRow.raw.form_id}/${modalRow.baseId || modalRow.id}`,
                  "_blank"
                )
              }
            >
              Open in Jotform
            </Button>
          )}
          <IconButton
            aria-label="close"
            onClick={() => setModalRow(null)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {modalRow && (
            <>
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                <b>Date: </b>
                {displayDate(modalRow)} &nbsp; | &nbsp;
                <b>Type: </b>
                {modalRow._type?.label} &nbsp; | &nbsp;
                <b>Amount: </b>${Number(modalRow.amount || 0).toFixed(2)} &nbsp; | &nbsp;
                <b>Submitted By: </b>
                {getSubmittedBy(modalRow) || "—"}
                {isYHDPFlex(modalRow) && <span style={{ marginLeft: 8 }}>{pill("YHDP Flex")}</span>}
              </div>

              <Tabs
                value={modalTab}
                onChange={(_, v) => setModalTab(v)}
                aria-label="submission tabs"
                sx={{ mb: 1 }}
              >
                <Tab label="Structured" />
                <Tab label="Raw item JSON" />
                <Tab label="Raw submission JSON" />
              </Tabs>

              {modalTab === 0 &&
                (isInvoiceRow(modalRow) ? (
                  <InvoiceStructuredView row={modalRow} />
                ) : (
                  <CCStructuredSubmissionView
                    answers={modalRow.raw?.answers || {}}
                    subId={modalRow.baseId || modalRow.id}
                  />
                ))}

              {modalTab === 1 && <pre style={pre}>{JSON.stringify(modalRow, null, 2)}</pre>}

              {modalTab === 2 && <pre style={pre}>{JSON.stringify(modalRow.raw || {}, null, 2)}</pre>}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Ad-hoc filter editor (front-end only) */}
      <AdvancedBudgetEditorModal
        open={adhocOpen}
        budget={adhoc}
        onClose={() => setAdhocOpen(false)}
        onSave={(updated) => {
          // keep only rule bits; ignore budget numbers etc. for filtering
          setAdhoc({
            ...adhoc,
            label: updated.label || "Custom",
            rulesOp: updated.rulesOp || "OR",
            rules: Array.isArray(updated.rules) ? updated.rules : [],
          });
          setAdhocActive(true);
          setAdhocOpen(false);
        }}
      />
      {/* quick actions for ad-hoc */}
      {adhocOpen && (
        <DialogActions
          sx={{ position: "fixed", bottom: 8, right: 24, pointerEvents: "none" }}
        ></DialogActions>
      )}
    </div>
  );
}

/* ---------------- styles ---------------- */
const Th = ({ children }) => (
  <th
    style={{
      textAlign: "left",
      padding: "6px 8px",
      borderBottom: "1px solid #ddd",
      fontWeight: 600,
      fontSize: 13,
    }}
  >
    {children}
  </th>
);
const Td = ({ children, title }) => (
  <td
    title={title}
    style={{ padding: "6px 8px", borderBottom: "1px solid #eee", fontSize: 13, verticalAlign: "top" }}
  >
    {children}
  </td>
);
const pre = {
  fontSize: 12,
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 6,
  padding: 10,
  overflow: "auto",
};
