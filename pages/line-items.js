// pages/line-items.js
import React from "react";
import useSWR from "swr";
import { bucketCard } from "../components/jotformMap";
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

const within = (iso, from, to) => {
  const t = new Date(iso).getTime();
  if (from) { const f = new Date(from + "T00:00:00").getTime(); if (t < f) return false; }
  if (to)   { const tt = new Date(to   + "T23:59:59").getTime(); if (t > tt) return false; }
  return true;
};

/* ---------------- helpers ---------------- */
const stripHtml = (s = "") => String(s).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

function getSubmittedBy(row) {
  if (row.purchaser && String(row.purchaser).trim()) return row.purchaser;
  if (row.submitter && String(row.submitter).trim()) return row.submitter;
  const byId = row?.raw?.answers || {};
  const fromId = (id) => byId?.[id]?.answer ?? byId?.[id]?.prettyFormat ?? "";
  const ccName = fromId("55"); // CC form name (fallback)
  if (ccName) return String(ccName).trim();
  const invPurchaser = fromId("33"); // Invoice purchaser (fallback)
  if (invPurchaser) return String(invPurchaser).trim();
  return "";
}

function decideType(row) {
  if ((row.source || "").toLowerCase() === "invoice") return { key: "invoice", label: "Invoice" };
  const cardName = row.card || row.cardLabel || "";
  const bucket = bucketCard(cardName); // "Housing" | "Youth" | ""
  if (bucket === "Youth") return { key: "youth", label: "Youth Card" };
  if (bucket === "Housing") return { key: "housing", label: "Housing Card" };
  return { key: "card", label: "Card" };
}

/** Display date rules
 * Invoice: Invoice date (31.prettyFormat) || createdAt
 * CC: createdAt (we keep return time as a separate field in the structured section)
 */
function displayDate(row) {
  const answers = row?.raw?.answers || {};
  const pretty = (id) => answers?.[id]?.prettyFormat || "";
  if (row._type?.key === "invoice") {
    const inv = pretty("31");
    return inv || row.createdAt || row?.raw?.created_at || "";
  } else {
    return row.createdAt || row?.raw?.created_at || "";
  }
}

/** Prefer normalized flag first; fallback to heuristic */
function isYHDPFlex(row) {
  if (row?.isFlex === true) return true;
  const s = (row.descriptor || row.serviceType || row.program || "").toLowerCase();
  return s.includes("flex") && s.includes("yhdp");
}

function docStatus(row) {
  const ans = row?.raw?.answers || {};
  const hasArray = (id) => Array.isArray(ans[id]?.answer) && ans[id].answer.length > 0;
  const isInvoice = /^invoice$/i.test(row._type?.key);
  if (isInvoice) {
    const hasReceipt = hasArray("7");
    const okCore = !!row.merchant && !!row.amount && !!row.program && !!(row.purchaser || getSubmittedBy(row));
    return { complete: okCore && hasReceipt, missing: { receipt: !hasReceipt } };
  } else {
    // Credit card uploads: first txn 70, others 109/117/125/133
    const uploadIds = ["70","109","117","125","133"];
    const hasAny = uploadIds.some(hasArray);
    const okCore = !!row.merchant && !!row.amount && !!row.expenseType;
    return { complete: okCore && hasAny, missing: { receipt: !hasAny } };
  }
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

/** Heuristic: cleanly separate Program vs Billed To for invoices, with normalized fields first */
function splitProgramAndBilledTo(row) {
  // Prefer normalized first
  let billedTo = row.billedTo || "";
  let program = row.program || row.project || "";

  // If only one is present, try to infer from raw text patterns
  const looksLikeBillTo = (s) => /bill(?:ed)?\s*to\s*:?/i.test(String(s || ""));
  if (!billedTo && looksLikeBillTo(program)) {
    billedTo = String(program).replace(/bill(?:ed)?\s*to\s*:?\s*/i, "").trim();
    program = row.project || ""; // shift program to project when available
  }

  // De-dupe if identical
  if (program && billedTo && program.trim().toLowerCase() === billedTo.trim().toLowerCase()) {
    // Keep program, drop duplicate billedTo
    billedTo = "";
  }

  return {
    program: program || "—",
    billedTo: billedTo || "—",
  };
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

const expenseChipStyles = (label = "") => {
  const s = String(label).toLowerCase();
  if (s.includes("client")|| s.includes("customer"))  return { bgcolor: "#e6f4ea", color: "#0b5", borderColor: "#bde5cc" };
  if (s.includes("program")) return { bgcolor: "#e8f0fe", color: "#174ea6", borderColor: "#bcd0ff" };
  if (s.includes("flex"))    return { bgcolor: "#fff0f6", color: "#b00063", borderColor: "#ffc2db" };
  return { bgcolor: "#eef2f7", color: "#374151", borderColor: "#d7dde5" };
};

/* ---------------- CC Structured View ---------------- */
/** Keep your multi-transaction layout, but be tolerant with missing answers/files */
function CCStructuredSubmissionView({ answers = {}, subId }) {
  const byId = answers || {};
  const ans = (id) => byId?.[id]?.answer ?? byId?.[id]?.prettyFormat ?? "";

  const nonEmpty = (v) => {
    if (v == null) return false;
    if (typeof v === "string") return v.trim() !== "";
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return true;
  };

  // summary
  const card = ans("33");
  const purchaser = ans("55") || ans("185");
  const email = ans("56") || "";
  const whatPurchased = ans("85") || ans("167");
  const returnTime = byId?.["28"]?.prettyFormat || "";
  const summaryLines = [
    purchaser ? `Purchaser: ${purchaser}` : "",
    card ? `Card charged: ${card}` : "",
    whatPurchased ? `What was purchased?: ${whatPurchased}` : "",
    returnTime ? `Card return time: ${returnTime}` : "",
  ].filter(Boolean);

  // five slots, consistent with existing CC form
  const slots = [
    { n: 1, m: "82",  p: "85",  e: "84",  sup: "169", cust: "156", cost: "86",  files: "70",  notes: "151" },
    { n: 2, m: "182", p: "106", e: "183", sup: "184", cust: "185", cost: "107", files: "109", notes: "143" },
    { n: 3, m: "187", p: "114", e: "188", sup: "189", cust: "190", cost: "115", files: "117", notes: "147" },
    { n: 4, m: "192", p: "122", e: "193", sup: "194", cust: "195", cost: "123", files: "125", notes: "—" },
    { n: 5, m: "197", p: "130", e: "198", sup: "199", cust: "200", cost: "131", files: "133", notes: "—" },
  ];

  const sections = slots.map((s) => {
    const merchant = ans(s.m);
    const purpose = ans(s.p);
    const expenseType = ans(s.e);
    const supportive = ans(s.sup);
    const customer = ans(s.cust);
    const cost = ans(s.cost);
    const fileAns = ans(s.files);
    const files = Array.isArray(fileAns) ? fileAns : fileAns ? [fileAns] : [];
    const notes = s.notes !== "—" ? ans(s.notes) : "";

    const rows = [
      { label: "Merchant", value: merchant },
      { label: "Purpose", value: purpose },
      { label: "Expense Type", value: expenseType },
      { label: "Supportive Services Program", value: supportive },
      { label: "Customer Name", value: customer },
      { label: "Cost", value: cost },
      { label: "Files", value: files },
      { label: "Notes", value: notes },
    ].filter((r) => nonEmpty(r.value));

    const hasCost = nonEmpty(cost);
    const hasAny = rows.length > 0;
    return { n: s.n, rows, show: hasAny && hasCost };
  });

  const hasAnySection = sections.some((sec) => sec.show);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, background: "#f9fbff" }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Card Checkout Summary</div>
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

      {hasAnySection ? (
        sections.filter((sec) => sec.show).map((sec) => (
          <div key={sec.n} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, background: "#fff" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{`Transaction ${sec.n}`}</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {sec.rows.map((r, idx) => (
                  <tr key={idx}>
                    <td style={{ width: 220, padding: "6px 8px", fontWeight: 600, verticalAlign: "top" }}>
                      {r.label}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {Array.isArray(r.value)
                        ? r.value.map((u, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <span>{String(u).split("/").pop()}</span>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => saveAs(u, `${subId}-t${sec.n}-${i}.pdf`)}
                              >
                                Download
                              </Button>
                            </div>
                          ))
                        : r.label === "Cost"
                        ? `$${Number(r.value).toFixed(2)}`
                        : String(r.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      ) : (
        <div style={{ fontSize: 13, opacity: 0.7 }}>No transactions found.</div>
      )}
    </div>
  );
}

/* ---------------- Invoice Structured View ---------------- */
function InvoiceStructuredView({ row }) {
  const { program, billedTo } = splitProgramAndBilledTo(row);

  // Prefer normalized fields where available; fall back to raw answers
  const byId = row?.raw?.answers || {};
  const a = (id) => byId?.[id]?.answer ?? byId?.[id]?.prettyFormat ?? "";

  const fields = [
    ["Invoice Date", displayDate(row)],
    ["Vendor", row.merchant || a("30") || "—"],
    ["Expense Type", row.expenseType || "—"],
    ["Program", program],
    ["Billed To", billedTo],
    ["Customer", row.customer || "—"],
    ["Purchaser", row.purchaser || getSubmittedBy(row) || "—"],
    ["Email", row.email || a("25") || "—"],
    ["Payment Method", row.paymentMethod || "—"],
    ["Amount", `$${Number(row.amount || 0).toFixed(2)}`],
  ];

  const files = Array.isArray(row.files) ? row.files : [];

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>
          {fields.map(([label, value]) => (
            <tr key={label}>
              <td style={{ width: 220, padding: "6px 8px", fontWeight: 600, verticalAlign: "top" }}>{label}</td>
              <td style={{ padding: "6px 8px" }}>{String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>

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
          (r?.raw?.answers?.["56"]?.answer ?? r?.raw?.answers?.["25"]?.answer ?? ""); // CC email(56) | Invoice email(25)
        return {
          ...r,
          _type: type, // {key,label}
          _submittedBy: submittedBy || "—",
          _email: email || "—",
        };
      })
      .filter((r) => (typeFilter === "all" ? true : r._type.key === typeFilter))
      .filter((r) => within(r.createdAt, from, to))
      .filter((r) => !txt || JSON.stringify(r).toLowerCase().includes(txt))
      .sort((a, b) =>
        sort === "desc"
          ? new Date(b.createdAt) - new Date(a.createdAt)
          : new Date(a.createdAt) - new Date(b.createdAt)
      );
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
              const expStyle = expenseChipStyles(r.expenseType);
              return (
                <tr key={rowId}>
                  <Td title={displayDate(r)}>{displayDate(r)}</Td>
                  <Td>
                    <Chip size="small" variant="outlined" sx={{ ...typeStyle, borderWidth: 1 }} label={r._type.label} />
                  </Td>
                  <Td>{r.merchant || "—"}</Td>
                  <Td>
                    {r.expenseType
                      ? <Chip size="small" variant="outlined" sx={{ ...expStyle, borderWidth: 1 }} label={r.expenseType} />
                      : "—"}
                  </Td>
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
              </div>

              <Tabs value={modalTab} onChange={(_, v) => setModalTab(v)} aria-label="submission tabs" sx={{ mb: 1 }}>
                <Tab label="Structured" />
                <Tab label="Raw item JSON" />
                <Tab label="Raw submission JSON" />
              </Tabs>

              {modalTab === 0 && (
                (modalRow._type?.key === "invoice")
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
