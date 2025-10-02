// pages/budgets.js
import React from "react";
import useSWR from "swr";
import {
  IconButton,
  Menu,
  MenuItem,
  Button,
  TextField,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import BudgetConfigModal from "../components/BudgetConfigModal";
import BudgetTableEditor from "../components/BudgetTableEditor";
import SlicesModal from "../components/SlicesModal";

const fetcher = (u) => fetch(u).then((r) => r.json());

/* ---------------- Utilities ---------------- */
const monthKey = (iso) => {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

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

const matchesRules = (item, rules = []) => {
  if (!rules.length) return false;
  return rules.some((r) => {
    const val = String(item[r.field] || "").toLowerCase();
    return val.includes(String(r.match || "").toLowerCase());
  });
};

/* ---------------- Defaults & Local Storage ---------------- */
const defaultCfg = {
  budgets: [
    {
      key: "WIOA_SS",
      label: "WIOA Supportive Services",
      budget: 15584,
      startSpent: 0,
      from: "2025-07-01",
      to: "2026-06-30",
      type: "standard",
      rules: [{ field: "program_raw", match: "wioa", mode: "icontains" }],
    },
    {
      key: "CHAFEE_SS",
      label: "Chafee Supportive Services",
      budget: 6000,
      startSpent: 0,
      from: "2025-07-01",
      to: "2026-06-30",
      type: "standard",
      rules: [{ field: "program_raw", match: "chafee", mode: "icontains" }],
    },
    {
      key: "YHDP_SN",
      label: "YHDP SN Supportive Service",
      budget: 3916,
      startSpent: 0,
      from: "2024-10-01",
      to: "2025-09-30",
      type: "standard",
      rules: [{ field: "program_raw", match: "yhdp sn", mode: "icontains" }],
    },
    {
      key: "YHDP_DIV",
      label: "YHDP DIV Supportive Service",
      budget: 3000,
      startSpent: 0,
      from: "2024-10-01",
      to: "2025-09-30",
      type: "standard",
      rules: [{ field: "program_raw", match: "yhdp div", mode: "icontains" }],
    },
    {
      key: "YHDP_FLEX",
      label: "YHDP FLEX",
      budget: 0,
      startSpent: 0,
      from: "2024-10-01",
      to: "2025-09-30",
      type: "yhdp_flex",
      rules: [
        { field: "program_raw", match: "flex", mode: "icontains" },
        { field: "program_raw", match: "bill to bp: yhdp flex", mode: "icontains" },
      ],
    },
    {
      key: "PATH_DIRECT",
      label: "PATH: Direct Supportive Services",
      budget: 0,
      startSpent: 0,
      from: "2024-07-01",
      to: "2025-06-30",
      type: "standard",
      rules: [
        { field: "program_raw", match: "path", mode: "icontains" },
        { field: "expense_type_raw", match: "supportive", mode: "icontains" },
      ],
    },
    {
      key: "PATH_INDIRECT",
      label: "PATH: Indirect Program Expenses (outreach supplies)",
      budget: 0,
      startSpent: 0,
      from: "2024-07-01",
      to: "2025-06-30",
      type: "standard",
      rules: [{ field: "program_raw", match: "indirect", mode: "icontains" }],
    },
    {
      key: "PATH_SUPPLIES",
      label: "PATH: Supplies for staff",
      budget: 0,
      startSpent: 0,
      from: "2024-07-01",
      to: "2025-06-30",
      type: "standard",
      rules: [{ field: "program_raw", match: "supplies for staff", mode: "icontains" }],
    },
    {
      key: "PATH_TT",
      label: "PATH: Training & Travel",
      budget: 0,
      startSpent: 0,
      from: "2024-07-01",
      to: "2025-06-30",
      type: "standard",
      rules: [
        { field: "program_raw", match: "training", mode: "icontains" },
        { field: "program_raw", match: "travel", mode: "icontains" },
      ],
    },
  ],
  slices: [
    { key: "fy25q1", label: "FY25 Q1", from: "2024-10-01", to: "2024-12-31" },
    { key: "fy25q2", label: "FY25 Q2", from: "2025-01-01", to: "2025-03-31" },
    { key: "sept25", label: "Sept 2025", from: "2025-09-01", to: "2025-09-30" },
  ],
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

// Limits in localStorage (like the old credit-cards page)
function useCardLimits() {
  const [limits, setLimits] = React.useState({ Housing: 5000, Youth: 3500 });
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("cc-limits");
      if (raw) setLimits(JSON.parse(raw));
    } catch {}
  }, []);
  const set = (k, v) => {
    const n = Number(v);
    const next = { ...limits, [k]: Number.isFinite(n) ? n : 0 };
    setLimits(next);
    localStorage.setItem("cc-limits", JSON.stringify(next));
  };
  return [limits, set];
}

/* ---------------- Pretty table bits ---------------- */
const Th = ({ children }) => (
  <th
    style={{
      textAlign: "left",
      padding: "8px 9px",
      borderBottom: "1px solid #e5e9f0",
      fontWeight: 700,
      background: "#f6f8fb",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </th>
);
const Td = ({ children }) => (
  <td
    style={{
      padding: "7px 9px",
      borderBottom: "1px solid #f0f2f5",
      fontSize: 13,
      verticalAlign: "top",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </td>
);

const thLarge = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #e5e9f0", fontWeight: 700 };
const tdLarge = { padding: "8px 10px", borderBottom: "1px solid #f0f2f5", fontSize: 15 };
const tdLargeBold = { ...tdLarge, fontWeight: 700 };

/* ---------------- MonthlyTable (same look as deprecated credit-cards) ---------------- */
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
          padding: "12px 14px",
          borderBottom: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Chip size="small" label={accent} sx={{ bgcolor: "#eef5ff" }} />
        <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
      </div>
      <div style={{ overflowX: "auto", padding: 10 }}>
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

/* ---------------- Page ---------------- */
export default function Budgets() {
  const { data, error, isLoading, mutate } = useSWR("/api/purchases", fetcher, {
    refreshInterval: 300000,
  });
  const items = data?.items || [];

  // Enrich items for matching + card bucket
  const enriched = React.useMemo(() => {
    return items.map((x) => ({
      ...x,
      program_raw: x.program || "",
      expense_type_raw: x.expenseType || x.expense_type_raw || "",
      description: x.description || x.merchant || "",
      card_bucket:
        (x.card || "").toLowerCase().includes("youth")
          ? "Youth"
          : (x.card || "").toLowerCase().includes("housing")
          ? "Housing"
          : "",
    }));
  }, [items]);

  const [cfg, saveCfg] = useConfig();

  // ── CREDIT CARD BOX (slicer applies ONLY here) ────────────────────────────
  const [limits, setLimit] = useCardLimits();
  const [cardMenu, setCardMenu] = React.useState(null);
  const [slicesOpen, setSlicesOpen] = React.useState(false);
  const [activeSliceKey, setActiveSliceKey] = React.useState(cfg.slices?.[0]?.key || "");
  const activeSlice = (cfg.slices || []).find((s) => s.key === activeSliceKey) || null;

  // Build per-card monthly aggregates (filter to source "Credit Card" only)
  const cardMonthly = React.useMemo(() => {
    const byMonthHousing = {};
    const byMonthYouth = {};

    for (const r of enriched) {
      if (r.source !== "Credit Card") continue;
      if (activeSlice && !within(r.createdAt, activeSlice.from, activeSlice.to)) continue;

      const m = monthKey(r.createdAt);
      if (r.card_bucket === "Housing") {
        byMonthHousing[m] = (byMonthHousing[m] || 0) + Number(r.amount || 0);
      } else if (r.card_bucket === "Youth") {
        byMonthYouth[m] = (byMonthYouth[m] || 0) + Number(r.amount || 0);
      }
    }
    return { byMonthHousing, byMonthYouth };
  }, [enriched, activeSlice]);

  // ── BUDGET TABLES (UNCHANGED; slicer does not affect these) ───────────────
  const totalsByBudget = React.useMemo(() => {
    const out = {};
    for (const b of cfg.budgets) {
      out[b.key] = { meta: b, spent: Number(b.startSpent || 0), rows: [] };
    }
    for (const it of enriched) {
      for (const b of cfg.budgets) {
        if (!within(it.createdAt, b.from, b.to)) continue;
        if (!matchesRules(it, b.rules)) continue;
        out[b.key].spent += Number(it.amount || 0);
        out[b.key].rows.push(it);
      }
    }
    return out;
  }, [enriched, cfg.budgets]);

  // Global budgets menu & modal
  const [globalMenu, setGlobalMenu] = React.useState(null);
  const [globalModal, setGlobalModal] = React.useState(false);

  // per-table editor state
  const [editBudgetKey, setEditBudgetKey] = React.useState(null);

  // Small card-type chip
  function TypeChip({ value }) {
    const v = (value || "").toLowerCase();
    let color = "#e0e0e0";
    let text = value || "—";
    if (v.includes("youth")) color = "#e3f7e9";
    else if (v.includes("housing")) color = "#e9f0ff";
    else if (v.includes("invoice")) color = "#fff3e0";
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 999,
          background: color,
          fontSize: 12,
        }}
      >
        {text}
      </span>
    );
  }

  // style helper
  const cardShell = {
    border: "1px solid #e6e6e6",
    borderRadius: 16,
    background: "#ffffff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    overflow: "hidden",
  };

  /* ---------------- RENDER ---------------- */
  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h1 style={{ margin: 0 }}>Budgets</h1>
        <IconButton onClick={(e) => setGlobalMenu(e.currentTarget)}>
          <MoreVertIcon />
        </IconButton>
        <Menu anchorEl={globalMenu} open={!!globalMenu} onClose={() => setGlobalMenu(null)}>
          <MenuItem
            onClick={() => {
              setGlobalMenu(null);
              setGlobalModal(true);
            }}
          >
            Configure all budgets…
          </MenuItem>
          <MenuItem
            onClick={() => {
              setGlobalMenu(null);
              mutate();
            }}
          >
            Reload data
          </MenuItem>
          <MenuItem
            onClick={() => {
              setGlobalMenu(null);
              localStorage.removeItem("budgets-v2");
              window.location.reload();
            }}
          >
            Reset to defaults
          </MenuItem>
        </Menu>
      </div>

      {/* CREDIT CARD BOX (Housing / Youth, with slicer + limits), matches deprecated view */}
      <section style={{ ...cardShell, marginTop: 14, marginBottom: 18 }}>
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Chip size="small" label="Credit Cards" sx={{ bgcolor: "#eef5ff" }} />
          <h3 style={{ margin: 0, fontSize: 20, flex: 1 }}>Card Spend (Housing / Youth)</h3>

          {/* Slice picker (affects ONLY this box) */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="slice-label">Slice</InputLabel>
            <Select
              labelId="slice-label"
              label="Slice"
              value={activeSliceKey}
              onChange={(e) => setActiveSliceKey(e.target.value)}
            >
              {(cfg.slices || []).map((s) => (
                <MenuItem key={s.key} value={s.key}>
                  {s.label || s.key}
                </MenuItem>
              ))}
              <MenuItem value="">
                <em>All time</em>
              </MenuItem>
            </Select>
          </FormControl>

          {/* kebab for slices config */}
          <IconButton onClick={(e) => setCardMenu(e.currentTarget)} size="small">
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu anchorEl={cardMenu} open={!!cardMenu} onClose={() => setCardMenu(null)}>
            <MenuItem
              onClick={() => {
                setCardMenu(null);
                setSlicesOpen(true);
              }}
            >
              Manage slices…
            </MenuItem>
          </Menu>
        </div>

        {/* Limits row (same behavior as old page) */}
        <div
          style={{
            borderBottom: "1px solid #eee",
            padding: "10px 14px",
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 13, opacity: 0.7, marginRight: 6 }}>Card limits</span>
          {["Housing", "Youth"].map((k) => (
            <label key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 86 }}>{k}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={limits[k] ?? ""}
                onChange={(e) => setLimit(k, e.target.value)}
                style={{ width: 140, padding: "6px 8px" }}
              />
            </label>
          ))}
        </div>

        {/* Monthly tables (exact look) */}
        <div
          style={{
            display: "flex",
            gap: 16,
            margin: "12px 14px 16px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <MonthlyTable
            title="Housing — Monthly Spend"
            data={cardMonthly.byMonthHousing}
            limit={limits.Housing}
            accent="Housing"
          />
          <MonthlyTable
            title="Youth — Monthly Spend"
            data={cardMonthly.byMonthYouth}
            limit={limits.Youth}
            accent="Youth"
          />
        </div>
      </section>

      {/* --------- Budget tables below (slicer does NOT apply here) ---------- */}
      {isLoading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>Error: {String(error)}</p>}

      {(cfg.budgets || []).map((b) => {
        const roll = totalsByBudget[b.key];
        if (!roll) return null;
        const bal = Number(b.budget || 0) - roll.spent;
        const pct = b.budget ? Math.round((roll.spent / b.budget) * 100) : null;

        // per-table kebab
        const [anchorEl, setAnchorEl] = React.useState(null);
        const openMenu = (e) => setAnchorEl(e.currentTarget);
        const closeMenu = () => setAnchorEl(null);
        const openEditor = () => {
          closeMenu();
          setEditBudgetKey(b.key);
        };

        return (
          <section key={b.key} style={{ ...cardShell, marginBottom: 18 }}>
            <div
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid #eee",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Chip
                size="small"
                label={b.type === "yhdp_flex" ? "YHDP FLEX" : "Standard"}
                sx={{ bgcolor: b.type === "yhdp_flex" ? "#fff3e0" : "#eef5ff" }}
              />
              <h3 style={{ margin: 0, fontSize: 20, flex: 1 }}>{b.label}</h3>

              <div style={{ fontSize: 13, opacity: 0.8, marginRight: 8 }}>
                Window: {b.from || "—"} → {b.to || "—"}
              </div>

              <IconButton onClick={openMenu} size="small">
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={closeMenu}>
                <MenuItem onClick={openEditor}>Edit this table…</MenuItem>
              </Menu>
            </div>

            {/* Stats */}
            <div
              style={{
                display: "flex",
                gap: 12,
                margin: "8px 12px 12px",
                flexWrap: "wrap",
              }}
            >
              <Stat label="Budget" value={`$${Number(b.budget || 0).toFixed(2)}`} />
              <Stat label="Spent" value={`$${roll.spent.toFixed(2)}`} />
              <Stat label="Balance" value={`$${bal.toFixed(2)}`} danger={bal < 0} />
              <Stat label="% Spent" value={b.budget ? `${pct}%` : "—"} />
              {b.type === "yhdp_flex" && (
                <div style={{ alignSelf: "center", fontSize: 12, opacity: 0.7 }}>
                  Flex funds show extra columns
                </div>
              )}
            </div>

            {/* Rows */}
            <div style={{ overflowX: "auto", padding: "0 10px 10px" }}>
              <table
                style={{
                  minWidth: b.type === "yhdp_flex" ? 1100 : 1000,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr>
                    <Th>Date</Th>
                    {b.type === "yhdp_flex" && <Th>Billed To</Th>}
                    <Th>Merchant</Th>
                    <Th>Expense / Program</Th>
                    {b.type === "yhdp_flex" && <Th>Client / Household</Th>}
                    <Th>Amount</Th>
                    <Th>Type</Th>
                  </tr>
                </thead>
                <tbody>
                  {roll.rows
                    .sort((a, b2) => new Date(b2.createdAt) - new Date(a.createdAt))
                    .map((r, i) => (
                      <tr key={`${r.id}-${i}`}>
                        <Td>{new Date(r.createdAt).toLocaleString()}</Td>
                        {b.type === "yhdp_flex" && <Td>{r.billedTo || r.program || "—"}</Td>}
                        <Td title={r.description || ""}>{r.merchant || "—"}</Td>
                        <Td>{r.expenseType || r.program || "—"}</Td>
                        {b.type === "yhdp_flex" && <Td>{r.customer || "—"}</Td>}
                        <Td>${Number(r.amount || 0).toFixed(2)}</Td>
                        <Td>
                          <TypeChip value={r.type} />
                        </Td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {/* Global config modal */}
      <BudgetConfigModal
        open={globalModal}
        onClose={() => setGlobalModal(false)}
        cfg={cfg}
        onSave={(next) => {
          saveCfg(next);
          setGlobalModal(false);
        }}
      />

      {/* Per-table editor */}
      {editBudgetKey && (
        <BudgetTableEditor
          open
          budget={cfg.budgets.find((b) => b.key === editBudgetKey)}
          onClose={() => setEditBudgetKey(null)}
          onSave={(updated) => {
            const next = {
              ...cfg,
              budgets: cfg.budgets.map((b) => (b.key === updated.key ? updated : b)),
            };
            saveCfg(next);
            setEditBudgetKey(null);
          }}
        />
      )}

      {/* Slices editor (for CREDIT CARD box only) */}
      {slicesOpen && (
        <SlicesModal
          open
          slices={cfg.slices || []}
          onClose={() => setSlicesOpen(false)}
          onSave={(nextSlices) => {
            const next = { ...cfg, slices: nextSlices };
            saveCfg(next);
            setSlicesOpen(false);
            // if active slice got deleted, reset
            if (!nextSlices.find((s) => s.key === activeSliceKey)) {
              setActiveSliceKey(nextSlices[0]?.key || "");
            }
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Small stat pill ---------------- */
function Stat({ label, value, danger }) {
  return (
    <div
      style={{
        minWidth: 160,
        border: "1px solid #eee",
        borderRadius: 10,
        padding: "8px 10px",
        background: danger ? "#fff5f5" : "#fff",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
