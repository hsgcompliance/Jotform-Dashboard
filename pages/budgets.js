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
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import SlicesModal from "../components/SlicesModal";
import AdvancedBudgetEditorModal from "../components/AdvancedBudgetEditorModal";

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

const valOf = (it, field) => {
  const v = it?.[field];
  return typeof v === "boolean" ? String(v) : String(v ?? "");
};

function matchLeaf(it, r) {
  const v = valOf(it, r.field).toLowerCase();
  const m = String(r.match ?? "").toLowerCase();
  const mode = r.mode || "icontains"; // "equals" | "icontains"
  let ok = m ? (mode === "equals" ? v === m : v.includes(m)) : false;
  return r.not ? !ok : ok; // optional NOT
}

function matchesRules(it, rules, op = "OR") {
  if (!rules?.length) return false;
  const evalRule = (x) =>
    x?.rules ? matchesRules(it, x.rules, x.op || "OR") : matchLeaf(it, x);
  return (op || "OR").toUpperCase() === "AND"
    ? rules.every(evalRule)
    : rules.some(evalRule); // default OR
}

/* ---------------- Defaults ---------------- */
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
      rulesOp: "OR",
      rules: [
        { field: "isFlex", match: "true", mode: "equals" },
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
  limits: { Housing: 5000, Youth: 3500 },
  flexCap: 500,
  flexClients: [],
};

/* ---------------- Blob-backed config ---------------- */
function useConfig() {
  const [cfg, setCfg] = React.useState(defaultCfg);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch("/api/budget-config");
        const j = await r.json();
        if (mounted && j?.ok && j?.config) setCfg({ ...defaultCfg, ...j.config });
      } catch (e) {
        console.warn("budget-config GET failed, using defaults", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const save = async (next) => {
    setCfg(next); // optimistic
    await fetch("/api/budget-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  };
  return [cfg, save, loading];
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

/* ---------------- MonthlyTable ---------------- */
function MonthlyTable({ title, data, limit, accent }) {
  const entries = Object.entries(data || {}).sort(([a], [b]) => (a < b ? 1 : -1));
  const thLarge = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #e5e9f0", fontWeight: 700 };
  const tdLarge = { padding: "8px 10px", borderBottom: "1px solid #f0f2f5", fontSize: 15 };
  const tdLargeBold = { ...tdLarge, fontWeight: 700 };

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
        {entries.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.7 }}>No spend in this slice.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
            <thead>
              <tr style={{ background: "#f6f8fb" }}>
                <th style={thLarge}>Month</th>
                <th style={thLarge}>Spent</th>
                <th style={thLarge}>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([m, spent]) => {
                const lim = Number(limit || 0);
                const remain = Math.max(0, lim - Number(spent || 0));
                return (
                  <tr key={m}>
                    <td style={tdLargeBold}>{m}</td>
                    <td style={tdLarge}>${Number(spent || 0).toFixed(2)}</td>
                    <td
                      style={{
                        ...tdLarge,
                        color: remain <= 0 ? "crimson" : remain <= lim * 0.1 ? "#b58900" : "#0b7",
                      }}
                    >
                      ${remain.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
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

/* ---------- Flex helper ---------- */
const norm = (s) => String(s || "").toLowerCase().trim();
function clientKey(item) {
  return norm(item.customer || "");
}
function isYHDPFlex(item) {
  return !!item?.isFlex;
}

/* ---------------- CSV helper ---------------- */
function exportRowsToCsv(filename, rows) {
  const safe = (v) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const cols = [
    "id",
    "baseId",
    "source",
    "type",
    "createdAt",
    "merchant",
    "program",
    "billedTo",
    "expenseType",
    "customer",
    "card",
    "cardBucket",
    "amount",
  ];
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => safe(r[c])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

/* ---------------- Flex Clients Modal ---------------- */
function FlexClientsModal({ open, onClose, cfg, onSave }) {
  const normalizeKey = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const asNumber = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const [local, setLocal] = React.useState({
    flexCap: cfg.flexCap || 500,
    flexClients: cfg.flexClients || [],
  });

  React.useEffect(() => {
    setLocal({
      flexCap: cfg.flexCap || 500,
      flexClients: Array.isArray(cfg.flexClients) ? cfg.flexClients : [],
    });
  }, [cfg]);

  const updateClient = (i, patch) => {
    setLocal((prev) => {
      const next = { ...prev, flexClients: [...(prev.flexClients || [])] };
      next.flexClients[i] = { ...next.flexClients[i], ...patch };
      return next;
    });
  };

  const addClient = () => {
    setLocal((prev) => ({
      ...prev,
      flexClients: [...(prev.flexClients || []), { key: "", name: "", start: 0, cap: "" }],
    }));
  };

  const removeClient = (i) => {
    setLocal((prev) => ({
      ...prev,
      flexClients: (prev.flexClients || []).filter((_, idx) => idx !== i),
    }));
  };

  const handleSave = () => {
    const cleaned = (local.flexClients || [])
      .filter((c) => String(c.name || c.key).trim() !== "")
      .map((c) => {
        const name = String(c.name || "").trim();
        const key = c.key && String(c.key).trim() ? normalizeKey(c.key) : normalizeKey(name);
        const cap = c.cap === "" || c.cap == null ? "" : asNumber(c.cap, "");
        return { key, name, start: asNumber(c.start, 0), cap };
      });

    const byKey = new Map();
    for (const c of cleaned) byKey.set(c.key, c);
    const unique = Array.from(byKey.values());

    onSave({ flexCap: asNumber(local.flexCap, 500), flexClients: unique });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #eee" }}>
        <h3 style={{ margin: 0, fontSize: 18, flex: 1 }}>YHDP Flex – Clients & Caps</h3>
        <Button onClick={onClose}>Close</Button>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <TextField
            label="Default Flex Cap"
            type="number"
            size="small"
            value={local.flexCap}
            onChange={(e) => setLocal((p) => ({ ...p, flexCap: asNumber(e.target.value, 0) }))}
          />
          <div style={{ fontSize: 12, opacity: 0.7 }}>Used when a client doesn’t specify a cap.</div>
        </div>

        {(local.flexClients || []).map((c, i) => (
          <div key={i} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, marginBottom: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr auto", gap: 10 }}>
              <TextField
                label="Name"
                size="small"
                value={c.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const patch = { name };
                  if (!String(c.key || "").trim()) patch.key = normalizeKey(name);
                  updateClient(i, patch);
                }}
              />
              <TextField
                label="Key (unique, lowercased)"
                size="small"
                value={c.key}
                onChange={(e) => updateClient(i, { key: normalizeKey(e.target.value) })}
                helperText="Auto-filled from name if empty"
              />
              <TextField
                label="Starting Spent"
                type="number"
                size="small"
                value={c.start ?? 0}
                onChange={(e) => updateClient(i, { start: asNumber(e.target.value, 0) })}
              />
              <TextField
                label="Cap (optional)"
                type="number"
                size="small"
                value={c.cap ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  updateClient(i, { cap: raw === "" ? "" : asNumber(raw, "") });
                }}
              />
              <div>
                <Button color="error" onClick={() => removeClient(i)}>
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Button variant="outlined" onClick={addClient}>
            Add Flex Client
          </Button>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/* ---------------- Budget section (per-table; opens Advanced editor) ---------------- */
function BudgetSection({ b, roll, onEdit, flexSpendByClient, capByClient, defaultFlexCap }) {
  const [menuEl, setMenuEl] = React.useState(null);
  const [collapsed, setCollapsed] = React.useState(false);

  const openMenu = (e) => setMenuEl(e.currentTarget);
  const closeMenu = () => setMenuEl(null);

  const spent = roll.spent;
  const bal = Number(b.budget || 0) - spent;
  const pct = b.budget ? Math.round((spent / b.budget) * 100) : null;

  const cardShell = {
    border: "1px solid #e6e6e6",
    borderRadius: 16,
    background: "#ffffff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    overflow: "hidden",
  };

  const _clientKey =
    typeof clientKey === "function"
      ? clientKey
      : (item) => String(item.customer || "").toLowerCase().trim();

  return (
    <section key={b.key} style={{ ...cardShell, marginBottom: 18 }}>
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Chip size="small" label={b.type === "yhdp_flex" ? "YHDP FLEX" : "Standard"} sx={{ bgcolor: b.type === "yhdp_flex" ? "#fff3e0" : "#eef5ff" }} />
        <h3 style={{ margin: 0, fontSize: 18, flex: 1 }}>{b.label}</h3>
        <div style={{ fontSize: 12, opacity: 0.75, marginRight: 6 }}>
          {(b.from || "—")} → {(b.to || "—")}
        </div>
        <IconButton onClick={() => setCollapsed((v) => !v)} size="small" title={collapsed ? "Expand" : "Collapse"}>
          {collapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
        </IconButton>
        <IconButton onClick={openMenu} size="small">
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={menuEl} open={!!menuEl} onClose={closeMenu}>
          <MenuItem
            onClick={() => {
              closeMenu();
              onEdit?.(b.key);
            }}
          >
            Edit rules & budget…
          </MenuItem>
          <MenuItem
            onClick={() => {
              closeMenu();
              const filename = `${b.key}-export.csv`;
              exportRowsToCsv(
                filename,
                (roll.rows || []).map((r) => ({
                  id: r.id,
                  baseId: r.baseId,
                  source: r.source,
                  type: r.type,
                  createdAt: r.createdAt,
                  merchant: r.merchant,
                  program: r.program,
                  billedTo: r.billedTo || "",
                  expenseType: r.expenseType || "",
                  customer: r.customer || "",
                  card: r.card || "",
                  cardBucket: r.cardBucket || "",
                  amount: r.amount,
                }))
              );
            }}
          >
            Export CSV (this table)
          </MenuItem>
        </Menu>
      </div>

      {!collapsed && (
        <>
          <div style={{ display: "flex", gap: 12, margin: "8px 12px 12px", flexWrap: "wrap" }}>
            <Stat label="Budget" value={`$${Number(b.budget || 0).toFixed(2)}`} />
            <Stat label="Spent" value={`$${spent.toFixed(2)}`} />
            <Stat label="Balance" value={`$${bal.toFixed(2)}`} danger={bal < 0} />
            <Stat label="% Spent" value={b.budget ? `${pct}%` : "—"} />
            {b.type === "yhdp_flex" && <div style={{ alignSelf: "center", fontSize: 12, opacity: 0.7 }}>Flex funds show extra columns</div>}
          </div>

          <div style={{ overflowX: "auto", padding: "0 10px 10px" }}>
            {(roll.rows || []).length === 0 ? (
              <div
                style={{
                  fontSize: 13,
                  opacity: 0.7,
                  padding: "10px 12px",
                  border: "1px dashed #eee",
                  borderRadius: 8,
                  background: "#fafafa",
                }}
              >
                No rows in this window.
              </div>
            ) : (
              <table style={{ minWidth: b.type === "yhdp_flex" ? 1250 : 1000, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    {b.type === "yhdp_flex" && <Th>Billed To</Th>}
                    <Th>Merchant</Th>
                    <Th>Expense / Program</Th>
                    {b.type === "yhdp_flex" && <Th>Client / Household</Th>}
                    <Th>Amount</Th>
                    {b.type === "yhdp_flex" && <Th>Client Flex to date</Th>}
                    {b.type === "yhdp_flex" && <Th>Cap</Th>}
                    <Th>Type</Th>
                  </tr>
                </thead>
                <tbody>
                  {roll.rows
                    .sort((a, b2) => new Date(b2.createdAt) - new Date(a.createdAt))
                    .map((r, i) => {
                      const k = _clientKey(r);
                      const toDate = b.type === "yhdp_flex" && k ? (flexSpendByClient.get(k) || 0) : 0;
                      const cap = (k && capByClient.get(k)) || defaultFlexCap;
                      const over = b.type === "yhdp_flex" && cap != null && toDate >= cap;

                      return (
                        <tr key={`${r.id}-${i}`}>
                          <Td>{new Date(r.createdAt).toLocaleString()}</Td>
                          {b.type === "yhdp_flex" && <Td>{r.billedTo || r.program || "—"}</Td>}
                          <Td title={r.description || ""}>{r.merchant || "—"}</Td>
                          <Td>{r.expenseType || r.program || "—"}</Td>
                          {b.type === "yhdp_flex" && <Td>{r.customer || "—"}</Td>}
                          <Td>${Number(r.amount || 0).toFixed(2)}</Td>
                          {b.type === "yhdp_flex" && <Td>{k ? `$${toDate.toFixed(2)}` : "—"}</Td>}
                          {b.type === "yhdp_flex" && (
                            <Td>
                              <span
                                style={{
                                  padding: "1px 8px",
                                  borderRadius: 999,
                                  border: "1px solid",
                                  borderColor: over ? "#f5c2c7" : "#bcd0ff",
                                  background: over ? "#fff5f5" : "#eef5ff",
                                  fontSize: 12,
                                }}
                                title={over ? `≥ $${cap}; review waiver` : `Cap: $${cap}`}
                              >
                                {over ? "Over / review waiver" : `Cap $${cap}`}
                              </span>
                            </Td>
                          )}
                          <Td>{r.type || (r.source === "invoice" ? "Invoice" : r.source || "—")}</Td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/* ---------------- Page ---------------- */
export default function Budgets() {
  const { data, error, isLoading, mutate } = useSWR("/api/purchases", fetcher, {
    refreshInterval: 300000,
  });
  const items = data?.items || [];

  const [cfg, saveCfg, cfgLoading] = useConfig();
  const limits = cfg.limits || { Housing: 0, Youth: 0 };

  const [cardMenu, setCardMenu] = React.useState(null);
  const [slicesOpen, setSlicesOpen] = React.useState(false);
  const [flexModalOpen, setFlexModalOpen] = React.useState(false);

  // Advanced budget editor (single modal for all budgets)
  const [advOpen, setAdvOpen] = React.useState(false);
  const [editKey, setEditKey] = React.useState(null);
  const editingBudget = React.useMemo(
    () => (cfg.budgets || []).find((b) => b.key === editKey) || null,
    [cfg.budgets, editKey]
  );

  // Default ALL TIME to avoid empty-initial-slice confusion
  const [activeSliceKey, setActiveSliceKey] = React.useState("");
  const activeSlice = (cfg.slices || []).find((s) => s.key === activeSliceKey) || null;

  // Enrich items + canonical program mapping for invoices + derive isFlex
  const enriched = React.useMemo(() => {
    return items.map((x) => {
      const isInvoice = (x.source || "").toLowerCase() === "invoice";
      const exp = String(x.expenseType || "").toLowerCase();
      const program_raw = isInvoice
        ? exp.includes("program")
          ? (x.billedTo || x.program || x.project || "")
          : (x.project || x.program || "")
        : (x.program || "");

      const progBill = String((program_raw || "") + " " + (x.billedTo || "")).toLowerCase();
      const cardSource = /^credit-?card$/i.test(x.source || "");
      const answers = (x?.raw && x.raw.answers) || {};
      const cardFlexYes =
        ["204", "205", "206", "207", "208"].some((id) =>
          String(answers[id]?.answer || "").toLowerCase().startsWith("y")
        );
      const isFlex =
        x.isFlex === true ||
        progBill.includes("yhdp flex") ||
        progBill.includes("flex") ||
        (cardSource && exp.includes("customer") && cardFlexYes);

      return {
        ...x,
        program_raw,
        expense_type_raw: x.expenseType || x.expense_type_raw || "",
        description: x.description || x.merchant || "",
        card_bucket:
          (x.card || "").toLowerCase().includes("youth")
            ? "Youth"
            : (x.card || "").toLowerCase().includes("housing")
            ? "Housing"
            : "",
        isFlex,
      };
    });
  }, [items]);

  // Build seed maps from cfg.flexClients
  const flexSeedByClient = React.useMemo(() => {
    const m = new Map();
    for (const c of cfg.flexClients || []) {
      const k = String(c.key || "").trim().toLowerCase();
      if (!k) continue;
      m.set(k, Number(c.start || 0));
    }
    return m;
  }, [cfg.flexClients]);

  const capByClient = React.useMemo(() => {
    const m = new Map();
    for (const c of cfg.flexClients || []) {
      const k = String(c.key || "").trim().toLowerCase();
      if (!k) continue;
      if (c.cap !== "" && c.cap != null) m.set(k, Number(c.cap));
    }
    return m;
  }, [cfg.flexClients]);

  // Per-client flex totals = seed + transactions
  const flexSpendByClient = React.useMemo(() => {
    const m = new Map(flexSeedByClient);
    for (const r of enriched) {
      if (!isYHDPFlex(r)) continue;
      const k = clientKey(r);
      if (!k) continue;
      m.set(k, (m.get(k) || 0) + Number(r.amount || 0));
    }
    return m;
  }, [enriched, flexSeedByClient]);

  // Card monthly aggregates (slicer applies only to card section)
  const cardMonthly = React.useMemo(() => {
    const byMonthHousing = {};
    const byMonthYouth = {};
    for (const r of enriched) {
      if (!/^credit-?card$/i.test(r.source || "")) continue;
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

  // Budgets rollup (not sliced)
  const totalsByBudget = React.useMemo(() => {
    const out = {};
    for (const b of cfg.budgets) {
      out[b.key] = { meta: b, spent: Number(b.startSpent || 0), rows: [] };
    }
    for (const it of enriched) {
      for (const b of cfg.budgets) {
        if (!within(it.createdAt, b.from, b.to)) continue;
        if (!matchesRules(it, b.rules, b.rulesOp || "OR")) continue;
        out[b.key].spent += Number(it.amount || 0);
        out[b.key].rows.push(it);
      }
    }
    return out;
  }, [enriched, cfg.budgets]);

  // style helper
  const cardShell = {
    border: "1px solid #e6e6e6",
    borderRadius: 16,
    background: "#ffffff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    overflow: "hidden",
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Budgets</h1>
        <Button size="small" onClick={() => mutate()}>Reload data</Button>
        <Button size="small" variant="outlined" onClick={() => setFlexModalOpen(true)}>
          Manage YHDP Flex Clients
        </Button>
        {cfgLoading && <span style={{ fontSize: 12, opacity: 0.7 }}>Loading configuration…</span>}
      </div>

      {/* CREDIT CARD BOX */}
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

          {/* Slice picker */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="slice-label">Slice</InputLabel>
            <Select
              labelId="slice-label"
              label="Slice"
              value={activeSliceKey}
              onChange={(e) => setActiveSliceKey(e.target.value)}
            >
              <MenuItem value="">
                <em>All time</em>
              </MenuItem>
              {(cfg.slices || []).map((s) => (
                <MenuItem key={s.key} value={s.key}>
                  {s.label || s.key}
                </MenuItem>
              ))}
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

        {/* Limits row */}
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
                onChange={(e) => {
                  const n = Number(e.target.value);
                  const next = {
                    ...cfg,
                    limits: { ...(cfg.limits || {}), [k]: Number.isFinite(n) ? n : 0 },
                  };
                  saveCfg(next);
                }}
                style={{ width: 140, padding: "6px 8px" }}
              />
            </label>
          ))}
        </div>

        {/* Monthly tables */}
        <div
          style={{
            display: "flex",
            gap: 16,
            margin: "12px 14px 16px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <MonthlyTable title="Housing — Monthly Spend" data={cardMonthly.byMonthHousing} limit={limits.Housing} accent="Housing" />
          <MonthlyTable title="Youth — Monthly Spend" data={cardMonthly.byMonthYouth} limit={limits.Youth} accent="Youth" />
        </div>
      </section>

      {/* --------- Budget tables ---------- */}
      {isLoading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>Error: {String(error)}</p>}

      {(cfg.budgets || []).map((b) => {
        const roll = totalsByBudget[b.key];
        if (!roll) return null;
        return (
          <BudgetSection
            key={b.key}
            b={b}
            roll={roll}
            onEdit={(key) => {
              setEditKey(key);
              setAdvOpen(true);
            }}
            flexSpendByClient={flexSpendByClient}
            capByClient={capByClient}
            defaultFlexCap={cfg.flexCap || 500}
          />
        );
      })}

      {/* Advanced editor (single modal for all tables) */}
      <AdvancedBudgetEditorModal
        open={advOpen}
        budget={editingBudget}
        onClose={() => setAdvOpen(false)}
        onSave={(updated) => {
          const next = {
            ...cfg,
            budgets: cfg.budgets.map((b) => (b.key === editKey ? updated : b)),
          };
          saveCfg(next);
          setAdvOpen(false);
        }}
      />

      {/* Flex Clients modal */}
      {flexModalOpen && (
        <FlexClientsModal
          open
          cfg={cfg}
          onClose={() => setFlexModalOpen(false)}
          onSave={(patch) => {
            const next = { ...cfg, ...patch };
            saveCfg(next);
            setFlexModalOpen(false);
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
          }}
        />
      )}
    </div>
  );
}
