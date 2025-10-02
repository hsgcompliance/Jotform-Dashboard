// pages/credit-cards.js
import React from "react";
import useSWR from "swr";
import { bucketCard, monthKey } from "../components/jotformMap";
import PDFButton from "../components/PDFButton";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Button,
  TextField,
  MenuItem,
  Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const fetcher = (u) => fetch(u).then((r) => r.json());

// Limits in localStorage (SSR-safe) with defaults Housing:5000, Youth:3500
function useCardLimits() {
  const [limits, setLimits] = React.useState({});
  React.useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("cc-limits") : null;
      if (raw) {
        setLimits(JSON.parse(raw));
      } else {
        const init = { Housing: 5000, Youth: 3500 };
        if (typeof window !== "undefined") localStorage.setItem("cc-limits", JSON.stringify(init));
        setLimits(init);
      }
    } catch {
      setLimits({ Housing: 5000, Youth: 3500 });
    }
  }, []);
  const set = (k, v) => {
    const n = Number(v);
    setLimits((prev) => {
      const next = { ...prev, [k]: Number.isFinite(n) ? n : 0 };
      if (typeof window !== "undefined") localStorage.setItem("cc-limits", JSON.stringify(next));
      return next;
    });
  };
  return [limits, set];
}

function withinRange(iso, from, to) {
  if (!from && !to) return true;
  const t = new Date(iso).getTime();
  if (from) {
    const f = new Date(from + "T00:00:00").getTime();
    if (t < f) return false;
  }
  if (to) {
    const tt = new Date(to + "T23:59:59").getTime();
    if (t > tt) return false;
  }
  return true;
}

function stripHtml(s = "") {
  return String(s).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/* ---------------- Structured, cleaned submission view ---------------- */
function StructuredSubmissionView({ answers = {}, subId }) {
  // index by id for direct lookups
  const byId = answers || {};

  // helpers
  const ans = (id) => byId?.[id]?.answer ?? byId?.[id]?.prettyFormat ?? "";
  const text = (id) => byId?.[id]?.text || byId?.[id]?.label || byId?.[id]?.name || "";

  const nonEmpty = (v) => {
    if (v == null) return false;
    if (typeof v === "string") return v.trim() !== "";
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return true;
  };

  // ---- Header summary (no junk HTML) ----
  const card = ans("33"); // Card being returned
  const purchaser = ans("55") || ans("185"); // try "Name" then t2 customer fallback
  const email = ans("56") || ""; // Email address
  const whatPurchased = ans("85") || ans("167"); // Purpose or "What was purchased?"
  const returnTime = byId?.["28"]?.prettyFormat || ""; // Return date & time (pretty)
  // restore "Card Checkout Summary" as clean text
  const summaryLines = [
    purchaser ? `Purchaser: ${purchaser}` : "",
    card ? `Card charged: ${card}` : "",
    whatPurchased ? `What was purchased?: ${whatPurchased}` : "",
    returnTime ? `Card return time: ${returnTime}` : "",
  ].filter(Boolean);

  // ---- Transaction slot maps (from your schema) ----
  const slots = [
    { n: 1, m: "82",  p: "85",  e: "84",  sup: "169", cust: "156", cost: "86",  files: "70",  notes: "151" },
    { n: 2, m: "182", p: "106", e: "183", sup: "184", cust: "185", cost: "107", files: "109", notes: "143" /* or 145 near t2 */ },
    { n: 3, m: "187", p: "114", e: "188", sup: "189", cust: "190", cost: "115", files: "117", notes: "147" },
    { n: 4, m: "192", p: "122", e: "193", sup: "194", cust: "195", cost: "123", files: "125", notes: "—" },
    { n: 5, m: "197", p: "130", e: "198", sup: "199", cust: "200", cost: "131", files: "133", notes: "—" },
  ];

  // Build transaction sections in preferred order:
  // Header (Transaction N) → Merchant → Purpose → Expense Type → Supportive Services → Customer → Cost → Files → Notes
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

    // only show the section if it has meaningful content (esp. cost)
    const hasCost = nonEmpty(cost);
    const hasAny = rows.length > 0;
    return { n: s.n, rows, show: hasAny && hasCost };
  });

  // filter out static/HTML guidance blocks (e.g., 90) by simply not including
  const hasAnySection = sections.some((sec) => sec.show);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Header block */}
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 10,
          padding: 12,
          background: "#f9fbff",
        }}
      >
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

      {/* Transactions */}
      {hasAnySection ? (
        sections
          .filter((sec) => sec.show)
          .map((sec) => (
            <div
              key={sec.n}
              style={{
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 12,
                background: "#fff",
              }}
            >
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
                                <span>{u.split("/").pop()}</span>
                                {/* Save button uses your PDFButton for any file URL */}
                                <PDFButton url={u} name={`${subId}-t${sec.n}-${i}`} />
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

/* ---------------- Monthly table (large, centered, clean colors) ---------------- */
function MonthlyTable({ title, data, limit, accent }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 360,
        borderRadius: 16,
        border: "1px solid #e6e6e6",
        background: "#ffffff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Chip size="small" label={accent} sx={{ bgcolor: "#eef5ff" }} />
        <h3 style={{ margin: 0, fontSize: 20 }}>{title}</h3>
      </div>
      <div style={{ overflowX: "auto", padding: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
          <thead>
            <tr style={{ background: "#f6f8fb" }}>
              <th style={thLarge}>Month</th>
              <th style={thLarge}>Spent</th>
              <th style={thLarge}>Remaining</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data)
              .sort(([a], [b]) => (a < b ? 1 : -1))
              .map(([m, spent]) => {
                const remain = Math.max(0, Number(limit || 0) - spent);
                return (
                  <tr key={m}>
                    <td style={tdLargeBold}>{m}</td>
                    <td style={tdLarge}>${spent.toFixed(2)}</td>
                    <td style={{ ...tdLarge, color: remain === 0 ? "crimson" : "#0b7" }}>
                      ${remain.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Main Page ---------------- */
export default function CreditCards() {
  const [showRaw, setShowRaw] = React.useState(false);
  const [limits, setLimit] = useCardLimits();
  const [fromDate, setFromDate] = React.useState(""); // YYYY-MM-DD
  const [toDate, setToDate] = React.useState(""); // YYYY-MM-DD
  const [sortDir, setSortDir] = React.useState("desc"); // 'desc' or 'asc'
  const [detail, setDetail] = React.useState(null); // selected line item

  const { data, error, isLoading } = useSWR("/api/card-tracker?id=251878265158166", fetcher);

  // Flatten to rows and apply date filter
  const rows = React.useMemo(() => {
    const items = data?.items || [];
    const mapped = items.map((r, idx) => ({
      id: `${r.id}-${idx}`, // ensure uniqueness
      baseId: r.id,
      date: r.createdAt,
      month: monthKey(r.createdAt),
      card: bucketCard(r.card),
      cardLabel: r.card,
      merchant: r.merchant,
      expenseType: r.expenseType,
      email: r.email || "",
      amount: Number(r.amount || 0),
      raw: r.raw,
    }));
    const filtered = mapped.filter((r) => withinRange(r.date, fromDate, toDate));
    const sorted = filtered.sort((a, b) =>
      sortDir === "desc"
        ? new Date(b.date) - new Date(a.date)
        : new Date(a.date) - new Date(b.date)
    );
    return sorted;
  }, [data, fromDate, toDate, sortDir]);

  // Build per-card monthly aggregates
  const byMonthHousing = React.useMemo(() => {
    const out = {};
    for (const r of rows) {
      if (r.card !== "Housing") continue;
      out[r.month] = (out[r.month] || 0) + r.amount;
    }
    return out;
  }, [rows]);

  const byMonthYouth = React.useMemo(() => {
    const out = {};
    for (const r of rows) {
      if (r.card !== "Youth") continue;
      out[r.month] = (out[r.month] || 0) + r.amount;
    }
    return out;
  }, [rows]);

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginTop: 0, textAlign: "center" }}>Credit Card Tracker</h1>

      {/* Limits */}
      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          margin: "0 auto 18px",
          maxWidth: 800,
          background: "#fff",
        }}
      >
        <h3 style={{ margin: "0 0 10px" }}>Card Limits</h3>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          {["Housing", "Youth"].map((k) => (
            <label key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 90 }}>{k} limit</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={limits[k] ?? ""}
                onChange={(e) => setLimit(k, e.target.value)}
                style={{ width: 160, padding: "6px 8px" }}
              />
            </label>
          ))}
        </div>
      </section>

      {/* Monthly summaries: centered Housing | Youth (large cards) */}
      {!isLoading && !showRaw && (
        <section
          style={{
            display: "flex",
            gap: 20,
            margin: "0 auto 18px",
            maxWidth: 1100,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <MonthlyTable
            title="Housing — Monthly Spend"
            data={byMonthHousing}
            limit={limits.Housing}
            accent="Housing"
          />
          <MonthlyTable
            title="Youth — Monthly Spend"
            data={byMonthYouth}
            limit={limits.Youth}
            accent="Youth"
          />
        </section>
      )}

      {error && <p style={{ color: "crimson" }}>Error: {String(error)}</p>}
      {isLoading && <p>Loading…</p>}
      {!isLoading && showRaw && <pre style={pre}>{JSON.stringify(rows, null, 2)}</pre>}

      {/* Line items + Filters (below monthly spend) */}
      {!isLoading && !showRaw && (
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            <h3 style={{ margin: 0, marginRight: 12 }}>Line Items</h3>
            <TextField
              label="From"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              size="small"
            />
            <TextField
              label="To"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              size="small"
            />
            <TextField
              select
              label="Sort"
              size="small"
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
              style={{ minWidth: 160 }}
            >
              <MenuItem value="desc">Newest first</MenuItem>
              <MenuItem value="asc">Oldest first</MenuItem>
            </TextField>

            <label style={{ marginLeft: "auto", fontSize: 13 }}>
              <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />{" "}
              Show raw JSON (dev)
            </label>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 1100, borderCollapse: "collapse" }}>
              <thead style={{ background: "#f7f7f7" }}>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Month</th>
                  <th style={th}>Card</th>
                  <th style={th}>Merchant</th>
                  <th style={th}>Expense Type</th>
                  <th style={th}>Email</th>
                  <th style={th}>Amount</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={td}>{new Date(r.date).toLocaleString()}</td>
                    <td style={td}>{r.month}</td>
                    <td style={td} title={r.cardLabel}>{r.card}</td>
                    <td style={td}>{r.merchant}</td>
                    <td style={td}>{r.expenseType}</td>
                    <td style={td}>{r.email || "—"}</td>
                    <td style={td}>${r.amount.toFixed(2)}</td>
                    <td style={td}>
                      <Button size="small" variant="outlined" onClick={() => setDetail(r)}>
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Details dialog (structured, cleaned) */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 5 }}>
          Submission {detail?.baseId}
          <IconButton
            aria-label="close"
            onClick={() => setDetail(null)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {detail && (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontSize: 13 }}>
                <b>Date: </b>{new Date(detail.date).toLocaleString()} &nbsp; | &nbsp;
                <b>Card: </b>{detail.card} <span style={{ opacity: 0.7 }}>({detail.cardLabel})</span> &nbsp; | &nbsp;
                <b>Merchant: </b>{detail.merchant} &nbsp; | &nbsp;
                <b>Amount: </b>${detail.amount.toFixed(2)} &nbsp; | &nbsp;
                <b>Email: </b>{detail.email || "—"}
              </div>
              <StructuredSubmissionView answers={detail.raw?.answers || {}} subId={detail.baseId} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Styles ---------------- */
const th = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #ddd", fontWeight: 600 };
const td = { padding: "8px 10px", borderBottom: "1px solid #eee", fontSize: 13, verticalAlign: "top" };

const thLarge = { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e5e9f0", fontWeight: 700 };
const tdLarge = { padding: "10px 12px", borderBottom: "1px solid #f0f2f5", fontSize: 16 };
const tdLargeBold = { ...tdLarge, fontWeight: 700 };
const pre = { fontSize: 12, background: "#fafafa", border: "1px solid #eee", borderRadius: 6, padding: 12, overflow: "auto" };
