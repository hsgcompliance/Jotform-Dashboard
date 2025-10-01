// pages/budgets.js
import React from "react";
import useSWR from "swr";
import { classifyProgram, monthKey } from "../components/jotformMap";
import { Button, TextField, MenuItem } from "@mui/material";

const fetcher = (u) => fetch(u).then((r) => r.json());

// Local storage config for budgets, start-spent, manual clients, windows
function useBudgetConfig() {
  const [cfg, setCfg] = React.useState({
    // Program configs; you can add/remove keys in UI
    programs: {
      "WIOA Supportive Services": { budget: 15584, startSpent: 0, from: "2025-07-01", to: "2026-06-30" },
      "Chafee Supportive Services": { budget: 6000, startSpent: 0, from: "2025-07-01", to: "2026-06-30" },
      "YHDP SN Supportive Service": { budget: 3916, startSpent: 0, from: "2024-10-01", to: "2025-09-30" },
      "YHDP DIV Supportive Service": { budget: 3000, startSpent: 0, from: "2024-10-01", to: "2025-09-30" },
      "PATH: Direct Supportive Services": { budget: 0, startSpent: 0, from: "2024-07-01", to: "2025-06-30" },
      "PATH: Indirect Program Expenses (outreach supplies)": { budget: 0, startSpent: 0, from: "2024-07-01", to: "2025-06-30" },
      "PATH: Supplies for staff": { budget: 0, startSpent: 0, from: "2024-07-01", to: "2025-06-30" },
      "PATH: Training & Travel": { budget: 0, startSpent: 0, from: "2024-07-01", to: "2025-06-30" },
    },
    // Manual overrides for YHDP FLEX client amounts
    yhdpFlexManual: {
      // "Lastname, Firstname": 0
    },
  });

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("budgets-config");
      if (raw) setCfg(JSON.parse(raw));
    } catch {}
  }, []);
  const save = (next) => {
    setCfg(next);
    localStorage.setItem("budgets-config", JSON.stringify(next));
  };
  return [cfg, save];
}

function within(iso, from, to) {
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

function pct(n, d) {
  if (!d) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

export default function Budgets() {
  const { data, error, isLoading, mutate } = useSWR("/api/purchases", fetcher, { refreshInterval: 300000 });
  const [cfg, saveCfg] = useBudgetConfig();

  const items = React.useMemo(() => data?.items || [], [data]);

  // Classify each item → one or more buckets
  const classified = React.useMemo(() => {
    return items.map((it) => ({ ...it, buckets: classifyProgram(it) }));
  }, [items]);

  // Compute spend per program (respecting each program's date window)
  const spendByProgram = React.useMemo(() => {
    const out = {};
    for (const [prog, meta] of Object.entries(cfg.programs)) {
      out[prog] = { spent: Number(meta.startSpent || 0), items: [] };
    }
    for (const it of classified) {
      for (const bucket of it.buckets) {
        const meta = cfg.programs[bucket];
        if (!meta) continue; // untracked program
        if (!within(it.createdAt, meta.from, meta.to)) continue;
        out[bucket].spent += Number(it.amount || 0);
        out[bucket].items.push(it);
      }
    }
    return out;
  }, [classified, cfg.programs]);

  // YHDP FLEX client roll-up list
  const flexClients = React.useMemo(() => {
    const rows = {};
    for (const it of classified) {
      if (!it.buckets.includes("YHDP FLEX")) continue;
      const who = it.customer || "Unknown Household";
      rows[who] = (rows[who] || 0) + Number(it.amount || 0);
    }
    // merge in manual overrides/additions
    for (const [name, amt] of Object.entries(cfg.yhdpFlexManual || {})) {
      rows[name] = (rows[name] || 0) + Number(amt || 0);
    }
    // to array
    return Object.entries(rows)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [classified, cfg.yhdpFlexManual]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginTop: 0, textAlign: "center" }}>Budgets</h1>

      {/* Config editor */}
      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Configuration</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <Button size="small" variant="outlined" onClick={() => mutate()}>Reload</Button>
            <Button
              size="small"
              onClick={() => {
                const next = {
                  ...cfg,
                  programs: Object.fromEntries(
                    Object.entries(cfg.programs).map(([k, v]) => [k, { ...v, startSpent: 0 }])
                  ),
                  yhdpFlexManual: {},
                };
                saveCfg(next);
              }}
            >
              Reset Manual
            </Button>
          </div>
        </div>

        {/* Programs table with editable Budget / StartSpent / Dates */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 900, borderCollapse: "collapse" }}>
            <thead style={{ background: "#f7f7f7" }}>
              <tr>
                <th style={th}>Program</th>
                <th style={th}>From</th>
                <th style={th}>To</th>
                <th style={th}>Budget</th>
                <th style={th}>Starting Spent</th>
                <th style={th}>Current Spent</th>
                <th style={th}>Balance</th>
                <th style={th}>% Spent</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(cfg.programs).map(([prog, meta]) => {
                const spent = spendByProgram[prog]?.spent || 0;
                const bal = Number(meta.budget || 0) - spent;
                return (
                  <tr key={prog}>
                    <td style={td}>{prog}</td>
                    <td style={td}>
                      <input
                        type="date"
                        value={meta.from || ""}
                        onChange={(e) => {
                          const next = { ...cfg };
                          next.programs[prog].from = e.target.value;
                          saveCfg(next);
                        }}
                      />
                    </td>
                    <td style={td}>
                      <input
                        type="date"
                        value={meta.to || ""}
                        onChange={(e) => {
                          const next = { ...cfg };
                          next.programs[prog].to = e.target.value;
                          saveCfg(next);
                        }}
                      />
                    </td>
                    <td style={td}>
                      <input
                        type="number"
                        step="0.01"
                        value={meta.budget ?? ""}
                        onChange={(e) => {
                          const next = { ...cfg };
                          next.programs[prog].budget = Number(e.target.value || 0);
                          saveCfg(next);
                        }}
                        style={{ width: 120 }}
                      />
                    </td>
                    <td style={td}>
                      <input
                        type="number"
                        step="0.01"
                        value={meta.startSpent ?? ""}
                        onChange={(e) => {
                          const next = { ...cfg };
                          next.programs[prog].startSpent = Number(e.target.value || 0);
                          saveCfg(next);
                        }}
                        style={{ width: 120 }}
                      />
                    </td>
                    <td style={td}>${spent.toFixed(2)}</td>
                    <td style={{ ...td, color: bal < 0 ? "crimson" : undefined }}>
                      ${bal.toFixed(2)}
                    </td>
                    <td style={td}>{pct(spent, meta.budget || 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* YHDP FLEX client roll-up */}
      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>YHDP FLEX — Clients Received</h3>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <TextField
            label="Add/Adjust Client"
            placeholder="Lastname, Firstname"
            size="small"
            id="y-flex-name"
          />
          <TextField
            label="Amount"
            type="number"
            size="small"
            id="y-flex-amt"
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              const name = document.getElementById("y-flex-name")?.value?.trim();
              const amt = Number(document.getElementById("y-flex-amt")?.value || 0);
              if (!name) return;
              const next = { ...cfg };
              next.yhdpFlexManual[name] = (next.yhdpFlexManual[name] || 0) + amt;
              saveCfg(next);
            }}
          >
            Add / Update
          </Button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 400, borderCollapse: "collapse" }}>
            <thead style={{ background: "#f7f7f7" }}>
              <tr>
                <th style={th}>Household / Client</th>
                <th style={th}>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {flexClients.map((r) => (
                <tr key={r.name}>
                  <td style={td}>{r.name}</td>
                  <td style={td}>${Number(r.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Optional: per-program itemized view */}
      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Items by Program (current windows)</h3>
        {Object.entries(cfg.programs).map(([prog, meta]) => {
          const rows = (spendByProgram[prog]?.items || []).sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          );
          if (rows.length === 0) return null;
          return (
            <div key={prog} style={{ marginBottom: 14 }}>
              <h4 style={{ margin: "4px 0" }}>{prog}</h4>
              <div style={{ overflowX: "auto" }}>
                <table style={{ minWidth: 800, borderCollapse: "collapse" }}>
                  <thead style={{ background: "#f7f7f7" }}>
                    <tr>
                      <th style={th}>Date</th>
                      <th style={th}>Source</th>
                      <th style={th}>Merchant</th>
                      <th style={th}>Expense Type</th>
                      <th style={th}>Customer</th>
                      <th style={th}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={`${r.id}-${i}`}>
                        <td style={td}>{new Date(r.createdAt).toLocaleString()}</td>
                        <td style={td}>{r.source}</td>
                        <td style={td}>{r.merchant}</td>
                        <td style={td}>{r.expenseType || r.program}</td>
                        <td style={td}>{r.customer || "—"}</td>
                        <td style={td}>${Number(r.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

const th = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #ddd", fontWeight: 600 };
const td = { padding: "8px 10px", borderBottom: "1px solid #eee", fontSize: 13, verticalAlign: "top" };
