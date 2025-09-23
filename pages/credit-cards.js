// pages/credit-cards.js
import React from "react";
import useSWR from "swr";
import { bucketCard, monthKey } from "../components/jotformMap";
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

// ---------- Cleaned detail renderer (strip HTML/empty/static) ----------
function stripHtml(s = "") {
  return String(s).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
function isEmptyValue(v) {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "" || v.trim() === "—";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;
  return false;
}
const STATIC_TYPES = new Set([
  "control_head",
  "control_text",
  "control_divider",
  "control_collapse",
  "control_button",
]);
function CleanSubmissionView({ answers = {}, subId }) {
  // turn answers obj into filtered list
  const entries = Object.values(answers)
    .filter((a) => a && !STATIC_TYPES.has(a.type))
    .map((a) => {
      let val = a.answer ?? a.prettyFormat ?? a.value ?? "";
      // file uploads: ensure array of links
      if (a.type === "control_fileupload") {
        const arr = Array.isArray(val) ? val : val ? [val] : [];
        return { label: a.text || a.name, value: arr };
      }
      if (typeof val === "string") {
        val = stripHtml(val);
      } else if (typeof val === "object" && !Array.isArray(val)) {
        // compact object answers (e.g., datetime parts) into key: value lines
        const compact = Object.entries(val)
          .filter(([, v]) => v != null && String(v).trim() !== "")
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · ");
        val = compact;
      }
      return { label: a.text || a.name, value: val };
    })
    .filter((e) => !isEmptyValue(e.value));

  if (entries.length === 0) {
    return <div style={{ fontSize: 13, opacity: 0.7 }}>No non-empty fields.</div>;
  }

  // group into blocks of ~6 rows for readability
  const blocks = [];
  for (let i = 0; i < entries.length; i += 6) blocks.push(entries.slice(i, i + 6));

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {blocks.map((block, bi) => (
        <div
          key={bi}
          style={{
            border: "1px solid #eee",
            borderRadius: 8,
            padding: 12,
            background: "#fafafa",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {block.map((e, i) => (
                <tr key={i}>
                  <td style={{ width: 220, padding: "6px 8px", fontWeight: 600, verticalAlign: "top" }}>
                    {e.label}
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    {Array.isArray(e.value)
                      ? e.value.map((u, idx) => (
                          <div key={idx} style={{ marginBottom: 4 }}>
                            <a href={u} target="_blank" rel="noreferrer">
                              {u.split("/").pop()}
                            </a>
                          </div>
                        ))
                      : e.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ---------- Monthly table (large, centered, clean colors) ----------
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
      {!isLoading && showRaw && (
        <pre style={pre}>{JSON.stringify(rows, null, 2)}</pre>
      )}

      {/* Line items + Filters (moved here, under monthly spend) */}
      {!isLoading && !showRaw && (
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            <h3 style={{ margin: 0, marginRight: 12 }}>Line Items</h3>
            <TextField
              label="From"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <TextField
              label="To"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
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
            <table style={{ minWidth: 1000, borderCollapse: "collapse" }}>
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
                    <td style={td}>
                      {r.email ? (
                        <a href={`mailto:${r.email}`}>{r.email}</a>
                      ) : (
                        <span style={{ opacity: 0.6 }}>—</span>
                      )}
                    </td>
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

      {/* Details dialog (cleaned view) */}
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
              <CleanSubmissionView answers={detail.raw?.answers || {}} subId={detail.baseId} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const th = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #ddd", fontWeight: 600 };
const td = { padding: "8px 10px", borderBottom: "1px solid #eee", fontSize: 13, verticalAlign: "top" };

const thLarge = { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e5e9f0", fontWeight: 700 };
const tdLarge = { padding: "10px 12px", borderBottom: "1px solid #f0f2f5", fontSize: 16 };
const tdLargeBold = { ...tdLarge, fontWeight: 700 };
const pre = { fontSize: 12, background: "#fafafa", border: "1px solid #eee", borderRadius: 6, padding: 12, overflow: "auto" };
