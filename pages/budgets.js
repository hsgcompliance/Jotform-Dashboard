// pages/budgets.js
import React from "react";
import useSWR from "swr";
import {
  IconButton, Menu, MenuItem, Button, TextField, Select, FormControl, InputLabel
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import BudgetConfigModal from "../components/BudgetConfigModal";

const fetcher = (u) => fetch(u).then((r) => r.json());

const defaultCfg = {
  budgets: [
    {
      key: "WIOA_SS",
      label: "WIOA Supportive Services",
      budget: 15584, startSpent: 0, from: "2025-07-01", to: "2026-06-30", type: "standard",
      rules: [{ field: "program_raw", match: "wioa", mode: "icontains" }]
    },
    {
      key: "CHAFEE_SS",
      label: "Chafee Supportive Services",
      budget: 6000, startSpent: 0, from: "2025-07-01", to: "2026-06-30", type: "standard",
      rules: [{ field: "program_raw", match: "chafee", mode: "icontains" }]
    },
    {
      key: "YHDP_SN",
      label: "YHDP SN Supportive Service",
      budget: 3916, startSpent: 0, from: "2024-10-01", to: "2025-09-30", type: "standard",
      rules: [{ field: "program_raw", match: "yhdp sn", mode: "icontains" }]
    },
    {
      key: "YHDP_DIV",
      label: "YHDP DIV Supportive Service",
      budget: 3000, startSpent: 0, from: "2024-10-01", to: "2025-09-30", type: "standard",
      rules: [{ field: "program_raw", match: "yhdp div", mode: "icontains" }]
    },
    {
      key: "YHDP_FLEX",
      label: "YHDP FLEX",
      budget: 0, startSpent: 0, from: "2024-10-01", to: "2025-09-30", type: "yhdp_flex",
      rules: [
        { field: "program_raw", match: "flex", mode: "icontains" },
        { field: "program_raw", match: "bill to bp: yhdp flex", mode: "icontains" }
      ]
    },
    {
      key: "PATH_DIRECT",
      label: "PATH: Direct Supportive Services",
      budget: 0, startSpent: 0, from: "2024-07-01", to: "2025-06-30", type: "standard",
      rules: [{ field: "program_raw", match: "path", mode: "icontains" }, { field: "expense_type_raw", match: "supportive", mode: "icontains" }]
    },
    {
      key: "PATH_INDIRECT",
      label: "PATH: Indirect Program Expenses (outreach supplies)",
      budget: 0, startSpent: 0, from: "2024-07-01", to: "2025-06-30", type: "standard",
      rules: [{ field: "program_raw", match: "indirect", mode: "icontains" }]
    },
    {
      key: "PATH_SUPPLIES",
      label: "PATH: Supplies for staff",
      budget: 0, startSpent: 0, from: "2024-07-01", to: "2025-06-30", type: "standard",
      rules: [{ field: "program_raw", match: "supplies for staff", mode: "icontains" }]
    },
    {
      key: "PATH_TT",
      label: "PATH: Training & Travel",
      budget: 0, startSpent: 0, from: "2024-07-01", to: "2025-06-30", type: "standard",
      rules: [{ field: "program_raw", match: "training", mode: "icontains" }, { field: "program_raw", match: "travel", mode: "icontains" }]
    }
  ],
  slices: [
    { key: "sept", label: "Sept", from: "2025-09-01", to: "2025-09-30" }
  ]
};

function useConfig() {
  const [cfg, setCfg] = React.useState(defaultCfg);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("budgets-v2");
      if (raw) setCfg(JSON.parse(raw));
    } catch {}
  }, []);
  const save = (next) => {
    setCfg(next);
    localStorage.setItem("budgets-v2", JSON.stringify(next));
  };
  return [cfg, save];
}

const within = (iso, from, to) => {
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
};

const matchesRules = (item, rules=[]) => {
  if (!rules.length) return false;
  const ok = rules.some(r => {
    const val = String(item[r.field] || "").toLowerCase();
    return val.includes(String(r.match || "").toLowerCase());
  });
  return ok;
};

export default function Budgets() {
  const { data, error, isLoading, mutate } = useSWR("/api/purchases", fetcher, { refreshInterval: 300000 });
  const items = data?.items || [];

  // enrich items with fields we’ll use for rule matching
  const enriched = React.useMemo(() => {
    return items.map(x => ({
      ...x,
      program_raw: x.program || "",
      expense_type_raw: x.expenseType || x.expense_type_raw || "",
      card_bucket: (x.card || "").toLowerCase().includes("youth") ? "Youth" :
                   (x.card || "").toLowerCase().includes("housing") ? "Housing" : "",
      description: x.description || x.merchant || "",
    }));
  }, [items]);

  const [cfg, saveCfg] = useConfig();
  const [sliceKey, setSliceKey] = React.useState(cfg.slices?.[0]?.key || "");
  const activeSlice = (cfg.slices || []).find(s => s.key === sliceKey) || null;

  // menu + modal
  const [anchor, setAnchor] = React.useState(null);
  const [modal, setModal] = React.useState(false);

  const totalsByBudget = React.useMemo(() => {
    const out = {};
    for (const b of cfg.budgets) {
      out[b.key] = { meta: b, spent: Number(b.startSpent || 0), rows: [] };
    }
    for (const it of enriched) {
      for (const b of cfg.budgets) {
        // must be within budget’s grant window
        if (!within(it.createdAt, b.from, b.to)) continue;
        // must match rules
        if (!matchesRules(it, b.rules)) continue;
        // must be inside selected slice (if one is selected)
        if (activeSlice && !within(it.createdAt, activeSlice.from, activeSlice.to)) continue;

        out[b.key].spent += Number(it.amount || 0);
        out[b.key].rows.push(it);
      }
    }
    return out;
  }, [enriched, cfg.budgets, activeSlice]);

  // Card totals (Housing/Youth) inside this page
  const cardTotals = React.useMemo(() => {
    const base = { Housing: 0, Youth: 0 };
    for (const it of enriched) {
      if (!it.card_bucket) continue;
      // inside selected slice if any
      if (activeSlice && !within(it.createdAt, activeSlice.from, activeSlice.to)) continue;
      base[it.card_bucket] += Number(it.amount || 0);
    }
    return base;
  }, [enriched, activeSlice]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h1 style={{ margin: 0 }}>Budgets</h1>
        <IconButton onClick={(e)=>setAnchor(e.currentTarget)}><MoreVertIcon /></IconButton>
        <Menu anchorEl={anchor} open={!!anchor} onClose={()=>setAnchor(null)}>
          <MenuItem onClick={()=>{ setModal(true); setAnchor(null); }}>Configure…</MenuItem>
          <MenuItem onClick={()=>{ mutate(); setAnchor(null); }}>Reload</MenuItem>
          <MenuItem onClick={()=>{ localStorage.removeItem("budgets-v2"); window.location.reload(); }}>
            Reset to defaults
          </MenuItem>
        </Menu>
      </div>

      {/* Slice selector */}
      <div style={{ margin: "12px 0", display: "flex", gap: 12, alignItems: "center" }}>
        <FormControl size="small">
          <InputLabel id="slice-label">Slice</InputLabel>
          <Select labelId="slice-label" label="Slice" value={sliceKey} onChange={(e)=>setSliceKey(e.target.value)} sx={{ minWidth: 180 }}>
            {(cfg.slices || []).map(s => (
              <MenuItem key={s.key} value={s.key}>{s.label || s.key}</MenuItem>
            ))}
            <MenuItem value=""><em>All time (within each budget window)</em></MenuItem>
          </Select>
        </FormControl>
        {activeSlice && (
          <>
            <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }}
              value={activeSlice.from} onChange={()=>{}} disabled />
            <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }}
              value={activeSlice.to} onChange={()=>{}} disabled />
          </>
        )}
      </div>

      {/* Card totals */}
      <section style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        {["Housing", "Youth"].map(k => (
          <div key={k} style={{ flex: 1, minWidth: 260, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{k} Card — Total in slice</div>
            <div style={{ fontSize: 20 }}>${cardTotals[k].toFixed(2)}</div>
          </div>
        ))}
      </section>

      {/* Budget tables */}
      {isLoading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>Error: {String(error)}</p>}

      {(cfg.budgets || []).map(b => {
        const roll = totalsByBudget[b.key];
        if (!roll) return null;
        const bal = Number(b.budget || 0) - roll.spent;
        const pct = b.budget ? Math.round((roll.spent / b.budget) * 100) : null;

        return (
          <section key={b.key} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ margin: 0 }}>{b.label}</h3>
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                Window: {b.from || "—"} → {b.to || "—"}
                {activeSlice ? <> &nbsp; • &nbsp; Slice: {activeSlice.label || activeSlice.key}</> : null}
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, margin: "8px 0 12px", flexWrap: "wrap" }}>
              <Stat label="Budget" value={`$${Number(b.budget||0).toFixed(2)}`} />
              <Stat label="Spent" value={`$${roll.spent.toFixed(2)}`} />
              <Stat label="Balance" value={`$${bal.toFixed(2)}`} danger={bal < 0} />
              <Stat label="% Spent" value={b.budget ? `${pct}%` : "—"} />
            </div>

            {/* Rows */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ minWidth: b.type === "yhdp_flex" ? 900 : 800, borderCollapse: "collapse" }}>
                <thead style={{ background: "#f7f7f7" }}>
                  <tr>
                    <Th>Date</Th>
                    {b.type === "yhdp_flex" && <Th>Billed To</Th>}
                    <Th>Merchant</Th>
                    <Th>Expense / Program</Th>
                    {b.type === "yhdp_flex" && <Th>Client / Household</Th>}
                    <Th>Amount</Th>
                    <Th>Source</Th>
                  </tr>
                </thead>
                <tbody>
                  {roll.rows
                    .sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt))
                    .map((r, i) => (
                    <tr key={`${r.id}-${i}`}>
                      <Td>{new Date(r.createdAt).toLocaleString()}</Td>
                      {b.type === "yhdp_flex" && <Td>{r.program || "—"}</Td>}
                      <Td>{r.merchant || "—"}</Td>
                      <Td>{r.expenseType || r.program || "—"}</Td>
                      {b.type === "yhdp_flex" && <Td>{r.customer || "—"}</Td>}
                      <Td>${Number(r.amount || 0).toFixed(2)}</Td>
                      <Td>{r.source}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <BudgetConfigModal
        open={modal}
        onClose={()=>setModal(false)}
        cfg={cfg}
        onSave={(next)=>{ saveCfg(next); setModal(false); }}
      />
    </div>
  );
}

function Stat({ label, value, danger }) {
  return (
    <div style={{
      minWidth: 180, border: "1px solid #eee", borderRadius: 10, padding: "10px 12px",
      background: danger ? "#fff5f5" : "#fff"
    }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const Th = ({ children }) =>
  <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #ddd", fontWeight: 600 }}>{children}</th>;
const Td = ({ children }) =>
  <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee", fontSize: 13, verticalAlign: "top" }}>{children}</td>;
