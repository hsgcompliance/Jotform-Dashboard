// pages/credit-cards.js
import React from "react";
import useSWR from "swr";
import { bucketCard, monthKey } from "../components/jotformMap";
import AnswerTable from "../components/AnswerTable";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Button,
  TextField,
  MenuItem,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const fetcher = (u) => fetch(u).then((r) => r.json());

// Limits in localStorage (SSR-safe)
function useCardLimits() {
  const [limits, setLimits] = React.useState({});
  React.useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("cc-limits") : null;
      if (raw) {
        setLimits(JSON.parse(raw));
      } else {
        const init = { Housing: 5000, Youth: 3000 };
        if (typeof window !== "undefined") localStorage.setItem("cc-limits", JSON.stringify(init));
        setLimits(init);
      }
    } catch {
      setLimits({ Housing: 5000, Youth: 3000 });
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

function MonthlyTable({ title, data, limit }) {
  return (
    <div style={{ flex: 1, minWidth: 320 }}>
      <h4 style={{ margin: "6px 0 8px" }}>{title}</h4>
      <div style={{ overflowX: "auto" }}>
        <table style={{ minWidth: 320, borderCollapse: "collapse" }}>
          <thead style={{ background: "#f7f7f7" }}>
            <tr>
              <th style={th}>Month</th>
              <th style={th}>Spent</th>
              <th style={th}>Remaining</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data)
              .sort(([a], [b]) => (a < b ? 1 : -1))
              .map(([m, spent]) => {
                const remain = Math.max(0, Number(limit || 0) - spent);
                return (
                  <tr key={m}>
                    <td style={tdBold}>{m}</td>
                    <td style={td}>${spent.toFixed(2)}</td>
                    <td style={{ ...td, color: remain === 0 ? "crimson" : undefined }}>
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
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Credit Card Tracker</h1>

      {/* Limits */}
      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px" }}>Card Limits</h3>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {["Housing", "Youth"].map((k) => (
            <label key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 90 }}>{k} limit</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={limits[k] ?? ""}
                onChange={(e) => setLimit(k, e.target.value)}
                style={{ width: 140, padding: "4px 6px" }}
              />
            </label>
          ))}
        </div>
      </section>

      {/* Filters */}
      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
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
            style={{ minWidth: 140 }}
          >
            <MenuItem value="desc">Newest first</MenuItem>
            <MenuItem value="asc">Oldest first</MenuItem>
          </TextField>

          <label style={{ marginLeft: "auto", fontSize: 13 }}>
            <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />{" "}
            Show raw JSON (dev)
          </label>
        </div>
      </section>

      {/* Monthly summaries: side-by-side Housing | Youth */}
      {!isLoading && !showRaw && (
        <section style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          <MonthlyTable title="Housing — Monthly Spend" data={byMonthHousing} limit={limits.Housing} />
          <MonthlyTable title="Youth — Monthly Spend" data={byMonthYouth} limit={limits.Youth} />
        </section>
      )}

      {error && <p style={{ color: "crimson" }}>Error: {String(error)}</p>}
      {isLoading && <p>Loading…</p>}
      {!isLoading && showRaw && <pre style={pre}>{JSON.stringify(rows, null, 2)}</pre>}

      {/* Line items */}
      {!isLoading && !showRaw && (
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Line Items</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 900, borderCollapse: "collapse" }}>
              <thead style={{ background: "#f7f7f7" }}>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Month</th>
                  <th style={th}>Card</th>
                  <th style={th}>Merchant</th>
                  <th style={th}>Expense Type</th>
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

      {/* Details dialog */}
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
                <b>Amount: </b>${detail.amount.toFixed(2)}
              </div>
              {/* Render full submission, including attachments */}
              <AnswerTable answers={detail.raw?.answers || {}} subId={detail.baseId} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const th = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #ddd", fontWeight: 600 };
const td = { padding: "8px 10px", borderBottom: "1px solid #eee", fontSize: 13, verticalAlign: "top" };
const tdBold = { ...td, fontWeight: 600 };
const pre = { fontSize: 12, background: "#fafafa", border: "1px solid #eee", borderRadius: 6, padding: 12, overflow: "auto" };
