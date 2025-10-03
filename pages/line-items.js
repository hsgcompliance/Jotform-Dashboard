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
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

/* ---------------- fetch ---------------- */
const fetcher = (u) => fetch(u).then((r) => r.json());

/* ---------------- helpers ---------------- */
const stripHtml = (s = "") => String(s).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/** Decide if row represents an invoice */
function isInvoiceRow(row) {
  if ((row?.source || "").toLowerCase() === "invoice") return true;
  if (row?._type?.key === "invoice") return true;
  // fallback heuristic
  return false;
}

/** Robust-ish date getter used for display, filtering and sorting */
function rowDateStr(row) {
  // Invoices: prefer Invoice Date (31.prettyFormat) → createdAt → raw.created_at
  if (isInvoiceRow(row)) {
    const ans = row?.raw?.answers || {};
    const pretty = (id) => ans?.[id]?.prettyFormat || "";
    const inv = pretty(INVOICE_SCHEMA.globals.invoiceDate);
    if (inv) return inv; // e.g., "MM/DD/YYYY"
    return row?.createdAt || row?.raw?.created_at || "";
  }
  // Credit cards: createdAt (return time can be buggy)
  return row?.createdAt || row?.raw?.created_at || "";
}

/** Filtering helper uses rowDateStr */
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

/* --------- colors (chips) --------- */
const typeChipStyles = (key) => {
  switch (key) {
    case "invoice": return { bgcolor: "#e8f0fe", color: "#174ea6", borderColor: "#bcd0ff" };
    case "housing": return { bgcolor: "#fff4e5", color: "#8a3b00", borderColor: "#ffd8a8" };
    case "youth":   return { bgcolor: "#efe2ff", color: "#5b21a2", borderColor: "#d1b3ff" };
    default:        return { bgcolor: "#eef2f7", color: "#374151", borderColor: "#d7dde5" };
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
          Card Checkout Summary {anyFlex && pill("YHDP Flex (submission)", "At least one transaction marked Flex")}
        </div>
        {summaryLines.length ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {summaryLines.map((l, i) => (
              <li key={i} style={{ fontSize: 13 }}>{stripHtml(l)}</li>
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

      {txns.length ? txns.map((t, i) => {
        const programFieldUsed = t.supportiveProgram ? "Supportive Services Program" :
                                 t.programOperations ? "Program Operations for" : "Program";
        return (
          <div key={i} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, background: "#fff" }}>
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
                        <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span>{String(u).split("/").pop()}</span>
                          <Button size="small" variant="outlined" onClick={() => saveAs(u, `${subId}-t${t.n}-${j}.pdf`)}>
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
      }) : (
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
  const cost17 = Number(String(a(INVOICE_SCHEMA.globals.costSingle) ?? "0").replace(/[$,]/g, "")) || 0;
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
              <Row label="Customer" value={row.customer || [first, last].filter(Boolean).join(" ") || "—"} />
              <Row label="Service Type" value={serviceType || "—"} />
              {/other/i.test(serviceType) && <Row label="Other Service" value={otherService || "—"} />}
              {showWIOA && (
                <Row label="WIOA Scope / WEX" value={[scope, wex].filter(Boolean).join(" • ") || "—"} />
              )}
              <Row label="Payment Method" value={row.paymentMethod || a(INVOICE_SCHEMA.globals.paymentMethod) || "—"} />
              <Row label="Amount" value={`$${Number(row.amount || 0).toFixed(2)}`} />
            </>
          ) : (
            <>
              <Row label="Bill to Multiple Grants?" value={a(INVOICE_SCHEMA.programPath.multiToggle) || "—"} />
              <Row label="Primary Program (resolved)" value={soln.program || "—"} />
              {showWIOA && (
                <Row label="WIOA Scope / WEX" value={[scope, wex].filter(Boolean).join(" • ") || "—"} />
              )}
              <Row label="Payment Method" value={row.paymentMethod || a(INVOICE_SCHEMA.globals.paymentMethod) || "—"} />
            </>
          )}
          <Row label="Purchaser" value={row.purchaser || getSubmittedBy(row) || "—"} />
          <Row label="Email" value={row.email || a(INVOICE_SCHEMA.globals.email) || "—"} />
          <Row label="Note" value={row.note || a(INVOICE_SCHEMA.globals.note) || ""} />
          {/* Totals section always visible */}
          <Row label="Total Cost" value={`$${cost17.toFixed(2)}`} />
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
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
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

/* ---------------- table row cell helpers ---------------- */
const thCell = { width: 220, padding: "6px 8px", fontWeight: 600, verticalAlign: "top", textAlign: "left", borderBottom: "1px solid #eee" };
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

/* ---------------- Main page ---------------- */
export default function LineItems() {
  const { data, error, isLoading, mutate } = useSWR("/api/purchases", fetcher, { refreshInterval: 300000 });

  const [q, setQ] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [sort, setSort] = React.useState("desc");
  const [typeFilter, setTypeFilter] = React.useState("all");

  const [modalRow, setModalRow] = React.useState(null);
  const [modalTab, setModalTab] = React.useState(0); // 0 structured, 1 raw item, 2 raw submission

  const items = data?.items || [];

  // Totals for YHDP Flex by client (based on normalized flags when possible)
  const flexSpendByClient = React.useMemo(() => {
    const acc = new Map();
    for (const r of items) {
      if (!r?.customer) continue;
      if (!isYHDPFlex(r)) continue;
      const key = String(r.customer).trim().toLowerCase();
      acc.set(key, (acc.get(key) || 0) + Number(r.amount || 0));
    }
    return acc;
  }, [items]);

  const filtered = React.useMemo(() => {
    const txt = q.toLowerCase();

    return items
      .map((r) => {
        const type = decideType(r);
        const submittedBy = getSubmittedBy(r);
        const email =
          r.email ||
          (r?.raw?.answers?.[CC_SCHEMA.globals.email]?.answer ??
           r?.raw?.answers?.[INVOICE_SCHEMA.globals.email]?.answer ??
           "");
        return {
          ...r,
          _type: type, // {key,label}
          _submittedBy: submittedBy || "—",
          _email: email || "—",
          _displayDate: rowDateStr(r), // cache for sort/filter/table cell
        };
      })
      .filter((r) => (typeFilter === "all" ? true : r._type.key === typeFilter))
      .filter((r) => within(r, from, to))
      .filter((r) => !txt || JSON.stringify(r).toLowerCase().includes(txt))
      .sort((a, b) => {
        const ta = new Date(a._displayDate).getTime();
        const tb = new Date(b._displayDate).getTime();
        const delta = (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
        return sort === "desc" ? delta : -delta;
      });
  }, [items, q, from, to, sort, typeFilter]);

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Line Items</h1>
        <Button size="small" onClick={() => mutate()}>Reload</Button>
        <TextField size="small" label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <TextField size="small" type="date" label="From" slotProps={{ inputLabel: { shrink: true } }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField size="small" type="date" label="To"   slotProps={{ inputLabel: { shrink: true } }} value={to}   onChange={(e) => setTo(e.target.value)} />
        <TextField size="small" select label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
          <MenuItem value="desc">Newest first</MenuItem>
          <MenuItem value="asc">Oldest first</MenuItem>
        </TextField>
        <TextField size="small" select label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="invoice">Invoice</MenuItem>
          <MenuItem value="housing">Housing Card</MenuItem>
          <MenuItem value="youth">Youth Card</MenuItem>
        </TextField>
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
                    <Chip size="small" variant="outlined" sx={{ ...typeStyle, borderWidth: 1 }} label={r._type.label} />
                  </Td>
                  <Td>{r.merchant || "—"}</Td>
                  <Td>{r.expenseType || "—"}</Td>
                  <Td>{r.program || "—"}</Td>
                  <Td>{r.card || "—"}</Td>
                  <Td>{r.customer || "—"}</Td>
                  <Td>${Number(r.amount || 0).toFixed(2)}</Td>
                  <Td>{r._submittedBy}</Td>
                  <Td>{r._email}</Td>
                  <Td style={{ whiteSpace: "nowrap" }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => { setModalRow(r); setModalTab(0); }}
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
          {!!modalRow?.customer && isYHDPFlex(modalRow) && (() => {
            const k = String(modalRow.customer || "").trim().toLowerCase();
            const spent = (flexSpendByClient.get(k) || 0);
            return (
              <span style={{
                marginLeft: 8,
                padding: "2px 8px",
                borderRadius: 999,
                background: spent >= 400 ? "#ffecec" : "#fffbe6",
                border: "1px solid #f5c2c7",
                fontSize: 12
              }}>
                YHDP Flex to date for client: ${spent.toFixed(2)} {spent>=400 ? "(review waiver)" : ""}
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
                <b>Date: </b>{displayDate(modalRow)} &nbsp; | &nbsp;
                <b>Type: </b>{modalRow._type?.label} &nbsp; | &nbsp;
                <b>Amount: </b>${Number(modalRow.amount || 0).toFixed(2)} &nbsp; | &nbsp;
                <b>Submitted By: </b>{getSubmittedBy(modalRow) || "—"}
                {isYHDPFlex(modalRow) && <span style={{ marginLeft: 8 }}>{pill("YHDP Flex")}</span>}
              </div>

              <Tabs value={modalTab} onChange={(_, v) => setModalTab(v)} aria-label="submission tabs" sx={{ mb: 1 }}>
                <Tab label="Structured" />
                <Tab label="Raw item JSON" />
                <Tab label="Raw submission JSON" />
              </Tabs>

              {modalTab === 0 && (
                (isInvoiceRow(modalRow))
                  ? <InvoiceStructuredView row={modalRow} />
                  : <CCStructuredSubmissionView answers={modalRow.raw?.answers || {}} subId={modalRow.baseId || modalRow.id} />
              )}

              {modalTab === 1 && (
                <pre style={pre}>{JSON.stringify(modalRow, null, 2)}</pre>
              )}

              {modalTab === 2 && (
                <pre style={pre}>{JSON.stringify(modalRow.raw || {}, null, 2)}</pre>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- styles ---------------- */
const Th = ({ children }) =>
  <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #ddd", fontWeight: 600, fontSize: 13 }}>{children}</th>;
const Td = ({ children, title }) =>
  <td title={title} style={{ padding: "6px 8px", borderBottom: "1px solid #eee", fontSize: 13, verticalAlign: "top" }}>{children}</td>;
const pre = { fontSize: 12, background: "#fff", border: "1px solid #eee", borderRadius: 6, padding: 10, overflow: "auto" };
