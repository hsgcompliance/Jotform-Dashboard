// pages/credit-cards.js
import React from "react";
import useSWR from "swr";
import { bucketCard, monthKey } from "../components/jotformMap";

const fetcher = (u) => fetch(u).then((r) => r.json());

// Limits stored locally (per user) — SSR safe
function useCardLimits() {
  const [limits, setLimits] = React.useState({});
  // hydrate on client
  React.useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("cc-limits") : null;
      if (raw) {
        setLimits(JSON.parse(raw));
      } else {
        const init = { Housing: 5000, Youth: 3000 };
        if (typeof window !== "undefined") {
          localStorage.setItem("cc-limits", JSON.stringify(init));
        }
        setLimits(init);
      }
    } catch {
      // ignore
    }
  }, []);
  const set = (k, v) => {
    const n = Number(v);
    setLimits((prev) => {
      const next = { ...prev, [k]: Number.isFinite(n) ? n : 0 };
      if (typeof window !== "undefined") {
        localStorage.setItem("cc-limits", JSON.stringify(next));
      }
      return next;
    });
  };
  return [limits, set];
}

export default function CreditCards() {
  const [showRaw, setShowRaw] = React.useState(false);
  const [limits, setLimit] = useCardLimits();

  const { data, error, isLoading } = useSWR(
    "/api/card-tracker?id=251878265158166",
    fetcher
  );

  const rows = React.useMemo(() => {
    const subs = data?.submissions || [];
    return subs.map((s) => ({
      id: s.id,
      date: s.createdAt,
      month: monthKey(s.createdAt),
      card: bucketCard(s.card),
      cardLabel: s.card,
      merchant: s.merchant,
      expenseType: s.expenseType,
      amount: Number(s.amount || 0),
      raw: s.raw,
    }));
  }, [data]);

  const byMonth = React.useMemo(() => {
    const out = {};
    for (const r of rows) {
      out[r.month] ||= { Housing: 0, Youth: 0, total: 0 };
      out[r.month][r.card] += r.amount;
      out[r.month].total += r.amount;
    }
    return out;
  }, [rows]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Credit Card Tracker</h1>

      {/* Limits */}
      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px" }}>Card Limits</h3>
        <div style={{ display: "flex", gap: 16 }}>
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

      {/* Monthly summary */}
      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ margin: 0 }}>Monthly Spend</h3>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />{" "}
            Show raw JSON (dev)
          </label>
        </div>

        {error && <p style={{ color: "crimson" }}>Error: {String(error)}</p>}
        {isLoading && <p>Loading…</p>}

        {!isLoading && !showRaw && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 700, borderCollapse: "collapse" }}>
              <thead style={{ background: "#f7f7f7" }}>
                <tr>
                  <th style={th}>Month</th>
                  <th style={th}>Housing Spent</th>
                  <th style={th}>Housing Remaining</th>
                  <th style={th}>Youth Spent</th>
                  <th style={th}>Youth Remaining</th>
                  <th style={th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byMonth)
                  .sort(([a], [b]) => (a < b ? 1 : -1))
                  .map(([m, v]) => {
                    const hLimit = Number(limits.Housing || 0);
                    const yLimit = Number(limits.Youth || 0);
                    const hRemain = Math.max(0, hLimit - v.Housing);
                    const yRemain = Math.max(0, yLimit - v.Youth);
                    return (
                      <tr key={m}>
                        <td style={tdBold}>{m}</td>
                        <td style={td}>${v.Housing.toFixed(2)}</td>
                        <td style={{ ...td, color: hRemain === 0 ? "crimson" : undefined }}>
                          ${hRemain.toFixed(2)}
                        </td>
                        <td style={td}>${v.Youth.toFixed(2)}</td>
                        <td style={{ ...td, color: yRemain === 0 ? "crimson" : undefined }}>
                          ${yRemain.toFixed(2)}
                        </td>
                        <td style={td}>${v.total.toFixed(2)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && showRaw && (
          <pre style={pre}>{JSON.stringify(rows, null, 2)}</pre>
        )}
      </section>

      {/* Line items */}
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
              </tr>
            </thead>
            <tbody>
              {rows
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((r) => (
                  <tr key={r.id}>
                    <td style={td}>{new Date(r.date).toLocaleString()}</td>
                    <td style={td}>{r.month}</td>
                    <td style={td} title={r.cardLabel}>{r.card}</td>
                    <td style={td}>{r.merchant}</td>
                    <td style={td}>{r.expenseType}</td>
                    <td style={td}>${r.amount.toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const th = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #ddd", fontWeight: 600 };
const td = { padding: "8px 10px", borderBottom: "1px solid #eee", fontSize: 13 };
const tdBold = { ...td, fontWeight: 600 };
const pre = { fontSize: 12, background: "#fafafa", border: "1px solid #eee", borderRadius: 6, padding: 12, overflow: "auto" };
