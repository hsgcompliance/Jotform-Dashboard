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
  Tooltip,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import SlicesModal from "../components/SlicesModal";
import AdvancedBudgetEditorModal from "../components/AdvancedBudgetEditorModal";

const fetcher = (u) => fetch(u).then((r) => r.json());

/* ---------------- Tunables (display caps) ---------------- */
const MAX_ROWS_PER_BUDGET = 15;       // default visible rows per budget table
const MAX_DETAILS_PER_CLIENT = 15;    // default visible rows per client (YHDP FLEX)

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

const norm = (s) => String(s || "").toLowerCase().trim();

const normalizeClientKey = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

function decideTypeLabel(row) {
  if ((row.source || "").toLowerCase() === "invoice") return "Invoice";
  if (row.card_bucket === "Youth") return "Youth Card";
  if (row.card_bucket === "Housing") return "Housing Card";
  return "Card";
}

/* ---------------- Rule engine ---------------- */
/** Flexible value resolver: supports virtual fields + graceful fallbacks */
const fieldResolvers = {
  program_raw: (it) =>
    it.program_raw || it.program || it.project || it.billedTo || it.billed_to_raw || "",
  expense_type_raw: (it) => it.expense_type_raw || it.expenseType || "",
  card_bucket: (it) => it.card_bucket || it.cardBucket || "",
  billed_to_raw: (it) => it.billed_to_raw || it.billedTo || "",
  project_raw: (it) => it.project || it.project_raw || "",
  descriptor: (it) => it.descriptor || it.serviceType || "",
  merchant: (it) => it.merchant || "",
  customer: (it) => it.customer || "",
  source: (it) => it.source || "",
  type: (it) => it.type || decideTypeLabel(it),
  card: (it) => it.card || "",
  bucket_text: (it) =>
    [
      it.program_raw,
      it.program,
      it.billed_to_raw,
      it.billedTo,
      it.project,
      it.project_raw,
      it.descriptor,
      it.expense_type_raw,
      it.expenseType,
      it.card,
      it.card_bucket,
      it.merchant,
      it.customer,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  isFlex: (it) => (it.isFlex ? "true" : "false"),
};

const valOf = (it, field) => {
  const key = String(field || "").trim();
  if (fieldResolvers[key]) {
    const out = fieldResolvers[key](it);
    return typeof out === "boolean" ? String(out) : String(out ?? "");
  }
  const v = it?.[key];
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
    : rules.some(evalRule);
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
      rules: [{ field: "bucket_text", match: "wioa", mode: "icontains" }],
    },
    {
      key: "CHAFEE_SS",
      label: "Chafee Supportive Services",
      budget: 6000,
      startSpent: 0,
      from: "2025-07-01",
      to: "2026-06-30",
      type: "standard",
      rules: [{ field: "bucket_text", match: "chafee", mode: "icontains" }],
    },
    {
      key: "YHDP_SN",
      label: "YHDP SN Supportive Service",
      budget: 3916,
      startSpent: 0,
      from: "2024-10-01",
      to: "2025-09-30",
      type: "standard",
      rules: [{ field: "bucket_text", match: "yhdp sn", mode: "icontains" }],
    },
    {
      key: "YHDP_DIV",
      label: "YHDP DIV Supportive Service",
      budget: 3000,
      startSpent: 0,
      from: "2024-10-01",
      to: "2025-09-30",
      type: "standard",
      rules: [{ field: "bucket_text", match: "yhdp div", mode: "icontains" }],
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
        { field: "bucket_text", match: "yhdp flex", mode: "icontains" },
        { field: "bucket_text", match: "flex funds", mode: "icontains" },
      ],
    },
    {
      key: "PATH_DIRECT",
      label: "PATH: Direct Supportive Services",
      budget: 4675.87,
      startSpent: 0,
      from: "2025-07-01",
      to: "2026-06-30",
      type: "standard",
      rulesOp: "AND",
      rules: [
        { field: "bucket_text", match: "path", mode: "icontains" },
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
      rules: [{ field: "bucket_text", match: "indirect", mode: "icontains" }],
    },
    {
      key: "PATH_SUPPLIES",
      label: "PATH: Supplies for staff",
      budget: 2000,
      startSpent: 0,
      from: "2025-07-01",
      to: "2026-06-30",
      type: "standard",
      rules: [{ field: "bucket_text", match: "supplies for staff", mode: "icontains" }],
    },
    {
      key: "PATH_TT",
      label: "PATH: Training & Travel",
      budget: 3000,
      startSpent: 0,
      from: "2025-07-01",
      to: "2026-06-30",
      type: "standard",
      rules: [
        { field: "bucket_text", match: "training", mode: "icontains" },
        { field: "bucket_text", match: "travel", mode: "icontains" },
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
        if (!mounted) return;

        if (j?.ok && j?.config) {
          const incoming = j.config || {};

          const normalized = {
            budgets: Array.isArray(incoming.budgets)
              ? incoming.budgets
              : defaultCfg.budgets,
            slices: Array.isArray(incoming.slices)
              ? incoming.slices
              : defaultCfg.slices,
            limits:
              typeof incoming.limits === "object" && incoming.limits
                ? incoming.limits
                : defaultCfg.limits,
            flexCap:
              typeof incoming.flexCap === "number"
                ? incoming.flexCap
                : defaultCfg.flexCap,
            flexClients: Array.isArray(incoming.flexClients)
              ? incoming.flexClients
              : defaultCfg.flexClients,
          };

          normalized.flexClients = (normalized.flexClients || []).map((c) => ({
            ...c,
            show: c.show !== false,
            key: normalizeClientKey(c.key || c.name),
          }));

          setCfg(normalized);
        } else if (j?.ok && !j?.config) {
          // No blob yet → use hardcoded defaults
          setCfg(defaultCfg);
        } else {
          console.warn("budget-config GET error:", j?.error || j);
          setCfg(defaultCfg);
        }
      } catch (e) {
        console.warn("budget-config GET failed, using defaults", e);
        if (mounted) setCfg(defaultCfg);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const save = async (next) => {
    // optimistic local update
    setCfg(next);
    try {
      await fetch("/api/budget-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } catch (e) {
      console.warn("budget-config PUT failed", e);
      // optional: you could re-fetch here, but for now we just log
    }
  };

  return [cfg, save, loading];
}

/* ---------------- Pretty table bits ---------------- */
const Th = ({ children, title }) => (
  <th
    title={title || ""}
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

const Td = ({ children, title }) => (
  <td
    title={title || ""}
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
              <tr>
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
function clientKey(item) {
  return normalizeClientKey(item.customer || "");
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

/* ---------------- Flex Clients Modal (unchanged) ---------------- */
function FlexClientsModal({ open, onClose, cfg, onSave }) {
  const asNumber = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const [local, setLocal] = React.useState({
    flexCap: cfg.flexCap || 500,
    flexClients: (cfg.flexClients || []).map(c => ({ show:true, ...c })),
  });

  React.useEffect(() => {
    setLocal({
      flexCap: cfg.flexCap || 500,
      flexClients: Array.isArray(cfg.flexClients)
        ? cfg.flexClients.map(c => ({ show:true, ...c }))
        : [],
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
      flexClients: [...(prev.flexClients || []), { key: "", name: "", start: 0, cap: "", show: true }],
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
        const key = c.key && String(c.key).trim()
          ? normalizeClientKey(c.key)
          : normalizeClientKey(name);
        const cap = c.cap === "" || c.cap == null ? "" : asNumber(c.cap, "");
        return { key, name, start: asNumber(c.start, 0), cap, show: c.show !== false };
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
            onChange={(e) => setLocal((p) => ({ ...p, flexCap: Number(e.target.value || 0) }))}
          />
          <div style={{ fontSize: 12, opacity: 0.7 }}>Used when a client doesn’t specify a cap.</div>
        </div>

        {(local.flexClients || []).map((c, i) => (
          <div key={i} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, marginBottom: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr auto", gap: 10 }}>
              <TextField
                label="Name"
                size="small"
                value={c.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const patch = { name };
                  if (!String(c.key || "").trim()) patch.key = normalizeClientKey(name);
                  updateClient(i, patch);
                }}
              />
              <TextField
                label="Key (unique, lowercased)"
                size="small"
                value={c.key}
                onChange={(e) => updateClient(i, { key: normalizeClientKey(e.target.value) })}
                helperText="Auto-filled from name if empty"
              />
              <TextField
                label="Starting Spent"
                type="number"
                size="small"
                value={c.start ?? 0}
                onChange={(e) => updateClient(i, { start: Number(e.target.value || 0) })}
              />
              <TextField
                label="Cap (optional)"
                type="number"
                size="small"
                value={c.cap ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  updateClient(i, { cap: raw === "" ? "" : Number(raw || 0) });
                }}
              />
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <input
                  type="checkbox"
                  checked={c.show !== false}
                  onChange={(e) => updateClient(i, { show: e.target.checked })}
                />
                <span style={{ fontSize:12 }}>Show in table</span>
              </div>
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

/* ---------------- Budget section ---------------- */
function BudgetSection({
  b,
  roll,
  onEdit,
  flexSpendByClient,
  capByClient,
  defaultFlexCap,
  flexClients,
}) {
  const [menuEl, setMenuEl] = React.useState(null);
  const [collapsed, setCollapsed] = React.useState(false);

  // Per-table sort state
  const [sortField, setSortField] = React.useState(b.type === "yhdp_flex" ? "total_desc" : "date_desc");
  // Row cap toggles
  const [showAll, setShowAll] = React.useState(false);

  // For YHDP FLEX: open/close per-client and detail row caps per client
  const [openClients, setOpenClients] = React.useState(() => new Set());
  const [clientDetailCaps, setClientDetailCaps] = React.useState(() => new Map());

  const openMenu = (e) => setMenuEl(e.currentTarget);
  const closeMenu = () => setMenuEl(null);

  const spent = roll.spent;
  const bal = Number(b.budget || 0) - spent;
  const pct = b.budget ? Math.round((spent / b.budget) * 100) : null;

  const _clientKey =
    typeof clientKey === "function"
      ? clientKey
      : (item) => String(item.customer || "").toLowerCase().trim();

  // Base sort for raw rows (used by non-flex, and as source for grouping)
  const sortedRows = React.useMemo(() => {
    const list = [...(roll.rows || [])];
    const sorter = (a, b) => {
      switch (sortField) {
        case "date_asc": return new Date(a.createdAt) - new Date(b.createdAt);
        case "amount_desc": return Number(b.amount || 0) - Number(a.amount || 0);
        case "amount_asc": return Number(a.amount || 0) - Number(b.amount || 0);
        case "merchant_asc": return String(a.merchant || "").localeCompare(String(b.merchant || ""), undefined, { sensitivity: "base" });
        case "merchant_desc": return String(b.merchant || "").localeCompare(String(a.merchant || ""), undefined, { sensitivity: "base" });
        // default newest first
        default:
        case "date_desc": return new Date(b.createdAt) - new Date(a.createdAt);
      }
    };
    return list.sort(sorter);
  }, [roll.rows, sortField]);

  // ---------- FLEX: grouped-by-client view ----------
  const clientGroups = React.useMemo(() => {
    if (b.type !== "yhdp_flex") return [];
    const map = new Map();
    for (const r of sortedRows) {
      const k = _clientKey(r) || "(no client)";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    }
    let arr = Array.from(map.entries()).map(([key, rows]) => {
      const total = rows.reduce((s, x) => s + Number(x.amount || 0), 0);
      const name = rows[0]?.customer || "(no client)";
      const cap = (capByClient.get(key) ?? defaultFlexCap) || null;
      const toDate = flexSpendByClient.get(key) ?? total; // includes seed if configured
      const over = cap != null && toDate >= cap;
      return { key, name, total, cap, toDate, over, rows };
    });

    // Inject clients marked "show" even with no rows in this window
    const showList = (flexClients || []).filter(c => c.show !== false);
    const present = new Set(arr.map(g => g.key));
    for (const c of showList) {
      const key = normalizeClientKey(c.key || c.name);
      if (!key || present.has(key)) continue;
      const cap = (capByClient.get(key) ?? defaultFlexCap) || null;
      const toDate = flexSpendByClient.get(key) ?? Number(c.start || 0);
      const over = cap != null && toDate >= cap;
      arr.push({ key, name: c.name || key, total: 0, cap, toDate, over, rows: [] });
    }

    // Sort options for client groups
    const cmpName = (a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" });
    const cmpNum = (f, dir = "desc") => (a, b) => (dir === "desc" ? b[f] - a[f] : a[f] - b[f]);

    switch (sortField) {
      case "name_asc": arr.sort(cmpName); break;
      case "name_desc": arr.sort((a, b) => cmpName(b, a)); break;
      case "total_asc": arr.sort(cmpNum("total", "asc")); break;
      case "total_desc": arr.sort(cmpNum("total", "desc")); break;
      case "todate_asc": arr.sort(cmpNum("toDate", "asc")); break;
      case "todate_desc": arr.sort(cmpNum("toDate", "desc")); break;
      case "cap_asc": arr.sort((a, b) => (a.cap ?? Infinity) - (b.cap ?? Infinity)); break;
      case "cap_desc": arr.sort((a, b) => (b.cap ?? -Infinity) - (a.cap ?? -Infinity)); break;
      default: arr.sort(cmpNum("total", "desc"));
    }
    return arr;
  }, [b.type, sortedRows, _clientKey, capByClient, defaultFlexCap, flexSpendByClient, sortField, flexClients]);

  const cardShell = {
    border: "1px solid #e6e6e6",
    borderRadius: 16,
    background: "#ffffff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    overflow: "hidden",
  };

  // Helpers for caps/toggles
  const visibleRows = showAll ? sortedRows : sortedRows.slice(0, MAX_ROWS_PER_BUDGET);
  const hasMoreRows = sortedRows.length > visibleRows.length;

  const toggleClientOpen = (key) => {
    setOpenClients((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    // ensure a default cap exists when opening
    setClientDetailCaps((prev) => {
      if (prev.has(key)) return prev;
      const next = new Map(prev);
      next.set(key, MAX_DETAILS_PER_CLIENT);
      return next;
    });
  };
  const showAllForClient = (key) =>
    setClientDetailCaps((prev) => new Map(prev).set(key, Infinity));
  const collapseForClient = (key) =>
    setClientDetailCaps((prev) => new Map(prev).set(key, MAX_DETAILS_PER_CLIENT));

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
        <Chip
          size="small"
          label={b.type === "yhdp_flex" ? "YHDP FLEX" : "Standard"}
          sx={{ bgcolor: b.type === "yhdp_flex" ? "#fff3e0" : "#eef5ff" }}
        />
        <h3 style={{ margin: 0, fontSize: 18, flex: 1 }}>{b.label}</h3>
        <div style={{ fontSize: 12, opacity: 0.75, marginRight: 6 }}>
          {(b.from || "—")} → {(b.to || "—")}
        </div>

        {/* Sorters (per table) */}
        {b.type !== "yhdp_flex" ? (
          <Tooltip title="Change row sort for this budget table">
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id={`${b.key}-sort`}>Sort</InputLabel>
              <Select
                labelId={`${b.key}-sort`}
                label="Sort"
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
              >
                <MenuItem value="date_desc">Newest first</MenuItem>
                <MenuItem value="date_asc">Oldest first</MenuItem>
                <MenuItem value="amount_desc">Amount ↓</MenuItem>
                <MenuItem value="amount_asc">Amount ↑</MenuItem>
                <MenuItem value="merchant_asc">Merchant A–Z</MenuItem>
                <MenuItem value="merchant_desc">Merchant Z–A</MenuItem>
              </Select>
            </FormControl>
          </Tooltip>
        ) : (
          <Tooltip title="Change sort for client totals">
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id={`${b.key}-sort-flex`}>Sort clients</InputLabel>
              <Select
                labelId={`${b.key}-sort-flex`}
                label="Sort clients"
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
              >
                <MenuItem value="total_desc">Total ↓ (default)</MenuItem>
                <MenuItem value="total_asc">Total ↑</MenuItem>
                <MenuItem value="name_asc">Name A–Z</MenuItem>
                <MenuItem value="name_desc">Name Z–A</MenuItem>
                <MenuItem value="todate_desc">To-date ↓</MenuItem>
                <MenuItem value="todate_asc">To-date ↑</MenuItem>
                <MenuItem value="cap_desc">Cap ↓</MenuItem>
                <MenuItem value="cap_asc">Cap ↑</MenuItem>
              </Select>
            </FormControl>
          </Tooltip>
        )}

        <IconButton onClick={() => setCollapsed((v) => !v)} size="small" title={collapsed ? "Expand" : "Collapse"}>
          {collapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
        </IconButton>
        <IconButton onClick={openMenu} size="small" title="More">
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
                  type: r.type || decideTypeLabel(r),
                  createdAt: r.createdAt,
                  merchant: r.merchant,
                  program: r.program,
                  billedTo: r.billedTo || "",
                  expenseType: r.expenseType || "",
                  customer: r.customer || "",
                  card: r.card || "",
                  cardBucket: r.card_bucket || r.cardBucket || "",
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
          {/* Header stats */}
          {b.type !== "yhdp_flex" ? (
            <div style={{ display: "flex", gap: 12, margin: "8px 12px 12px", flexWrap: "wrap" }}>
              <Stat label="Budget" value={`$${Number(b.budget || 0).toFixed(2)}`} />
              <Stat label="Spent" value={`$${spent.toFixed(2)}`} />
              <Stat label="Balance" value={`$${bal.toFixed(2)}`} danger={bal < 0} />
              <Stat label="% Spent" value={b.budget ? `${pct}%` : "—"} />
            </div>
          ) : null}

          <div style={{ overflowX: "auto", padding: "0 10px 10px" }}>
            {(sortedRows || []).length === 0 ? (
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
            ) : b.type !== "yhdp_flex" ? (
              // ---------- Standard budget rows table ----------
              <>
                <table style={{ minWidth: 1000, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <Th title="Submission/Invoice date (cards: createdAt)">Date</Th>
                      <Th title="Grant or billed-to (invoices) or program fallback">Billed To</Th>
                      <Th title="Vendor or merchant name">Merchant</Th>
                      <Th title="Expense Type or Program (best-effort)">Expense / Program</Th>
                      <Th title="Client name (if any)">Client</Th>
                      <Th title="Dollar amount">Amount</Th>
                      <Th title="Card vs Invoice vs Housing/Youth">Type</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((r, i) => (
                      <tr key={`${r.id}-${i}`}>
                        <Td>{new Date(r.createdAt).toLocaleString()}</Td>
                        <Td>{r.billedTo || r.billed_to_raw || r.program || "—"}</Td>
                        <Td title={r.description || ""}>{r.merchant || "—"}</Td>
                        <Td>{r.expenseType || r.expense_type_raw || r.program || "—"}</Td>
                        <Td>{r.customer || "—"}</Td>
                        <Td>${Number(r.amount || 0).toFixed(2)}</Td>
                        <Td>{r.type || decideTypeLabel(r)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Show more / collapse */}
                {hasMoreRows && (
                  <div style={{ padding: "8px 10px" }}>
                    <Button size="small" onClick={() => setShowAll(true)}>
                      Show all {sortedRows.length} rows
                    </Button>
                  </div>
                )}
                {showAll && sortedRows.length > MAX_ROWS_PER_BUDGET && (
                  <div style={{ padding: "8px 10px" }}>
                    <Button size="small" onClick={() => setShowAll(false)}>
                      Collapse to {MAX_ROWS_PER_BUDGET}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              // ---------- YHDP FLEX: Stacked client table with collapsible line items ----------
              <table style={{ minWidth: 1250, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <Th title="Expand to see this client’s detail rows" />
                    <Th title="Client or household name">Client</Th>
                    <Th title="Sum of this client’s rows within THIS budget window">Total (in budget)</Th>
                    <Th title="Running total for this client across all data (includes starting spent)">To-date</Th>
                    <Th title="Client-specific cap; uses default if not set">Cap</Th>
                    <Th title="Over/under cap based on to-date">Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {clientGroups.map((g) => {
                    const isOpen = openClients.has(g.key);
                    const limit = clientDetailCaps.get(g.key) ?? MAX_DETAILS_PER_CLIENT;
                    const detailRows = isOpen ? g.rows.slice(0, limit) : [];
                    const hasMore = isOpen && g.rows.length > detailRows.length;

                    return (
                      <React.Fragment key={g.key}>
                        <tr>
                          <Td>
                            <IconButton
                              size="small"
                              onClick={() => toggleClientOpen(g.key)}
                              title={isOpen ? "Collapse" : "Expand"}
                            >
                              {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                            </IconButton>
                          </Td>
                          <Td>{g.name}</Td>
                          <Td>${g.total.toFixed(2)}</Td>
                          <Td title="Includes seeded starting spent if configured">${Number(g.toDate || 0).toFixed(2)}</Td>
                          <Td>{g.cap != null ? `$${Number(g.cap).toFixed(2)}` : "—"}</Td>
                          <Td title={g.over ? "Cap reached/exceeded" : "Under cap"}>
                            <span
                              style={{
                                padding: "1px 8px",
                                borderRadius: 999,
                                border: "1px solid",
                                borderColor: g.over ? "#f5c2c7" : "#bcd0ff",
                                background: g.over ? "#fff5f5" : "#eef5ff",
                                fontSize: 12,
                              }}
                            >
                              {g.over ? "Over / review waiver" : "Under"}
                            </span>
                          </Td>
                        </tr>

                        {isOpen && (
                          <tr>
                            <td colSpan={6} style={{ padding: 0 }}>
                              <div style={{ padding: "6px 8px 10px 34px" }}>
                                <table style={{ minWidth: 1100, borderCollapse: "collapse" }}>
                                  <thead>
                                    <tr>
                                      <Th title="Submission/Invoice date">Date</Th>
                                      <Th title="Grant or billed-to (invoices) or program fallback">Billed To</Th>
                                      <Th title="Vendor or merchant name">Merchant</Th>
                                      <Th title="Expense Type or Program (best-effort)">Expense / Program</Th>
                                      <Th title="Dollar amount">Amount</Th>
                                      <Th title="Card vs Invoice vs Housing/Youth">Type</Th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detailRows.map((r, i) => (
                                      <tr key={`${r.id}-${i}`}>
                                        <Td>{new Date(r.createdAt).toLocaleString()}</Td>
                                        <Td>{r.billedTo || r.billed_to_raw || r.program || "—"}</Td>
                                        <Td title={r.description || ""}>{r.merchant || "—"}</Td>
                                        <Td>{r.expenseType || r.expense_type_raw || r.program || "—"}</Td>
                                        <Td>${Number(r.amount || 0).toFixed(2)}</Td>
                                        <Td>{r.type || decideTypeLabel(r)}</Td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>

                                {hasMore && (
                                  <div style={{ paddingTop: 6 }}>
                                    <Button size="small" onClick={() => showAllForClient(g.key)}>
                                      Show all {g.rows.length} items for {g.name}
                                    </Button>
                                  </div>
                                )}
                                {isOpen && g.rows.length > MAX_DETAILS_PER_CLIENT && limit === Infinity && (
                                  <div style={{ paddingTop: 6 }}>
                                    <Button size="small" onClick={() => collapseForClient(g.key)}>
                                      Collapse to {MAX_DETAILS_PER_CLIENT}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer “show more/collapse” only for non-flex tables (flex handled per client) */}
          {b.type !== "yhdp_flex" && sortedRows.length > MAX_ROWS_PER_BUDGET && (
            <div style={{ padding: "6px 10px 12px" }}>
              {showAll ? (
                <Button size="small" onClick={() => setShowAll(false)}>
                  Collapse to {MAX_ROWS_PER_BUDGET}
                </Button>
              ) : (
                <Button size="small" onClick={() => setShowAll(true)}>
                  Show all {sortedRows.length} rows
                </Button>
              )}
            </div>
          )}
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
  const items = (data?.items || []).filter((r) => {
    const st = String(r?.raw?.status || r?.rawStatus || "").toUpperCase();
    return st === "" || st === "ACTIVE";
  });

  const [cfg, saveCfg, cfgLoading] = useConfig();
  const limits = cfg.limits || { Housing: 0, Youth: 0 };

  const [cardMenu, setCardMenu] = React.useState(null);
  const [slicesOpen, setSlicesOpen] = React.useState(false);
  const [flexModalOpen, setFlexModalOpen] = React.useState(false);

  // Advanced budget editor
  const [advOpen, setAdvOpen] = React.useState(false);
  const [editKey, setEditKey] = React.useState(null);
  const editingBudget = React.useMemo(
    () => (cfg.budgets || []).find((b) => b.key === editKey) || null,
    [cfg.budgets, editKey]
  );

  // Default ALL TIME
  const [activeSliceKey, setActiveSliceKey] = React.useState("");
  const activeSlice = (cfg.slices || []).find((s) => s.key === activeSliceKey) || null;

  // Enrich items with canonical + virtual fields for robust rule matching
  const enriched = React.useMemo(() => {
    return items.map((x) => {
      const isInvoice = (x.source || "").toLowerCase() === "invoice";
      const expLower = norm(x.expenseType || "");

      // Canonical program-ish fields
      const billed_to_raw = x.billedTo || "";
      const project_raw = x.project || "";
      // For invoices: If "For a Program" use billed_to_raw as program anchor; else project
      const program_raw = isInvoice
        ? (expLower.includes("program") ? (billed_to_raw || project_raw) : (project_raw || billed_to_raw || x.program || ""))
        : (x.program || "");

      // Descriptor / service type for customer invoices
      const descriptor = x.descriptor || x.serviceType || "";

      // Card bucket normalized
      const card_bucket =
        (x.card || "").toLowerCase().includes("youth")
          ? "Youth"
          : (x.card || "").toLowerCase().includes("housing")
          ? "Housing"
          : (x.cardBucket || "");

      // Flex heuristic (keep your true flag first)
      const rawAnswers = (x?.raw && x.raw.answers) || {};
      const cardFlexYes = ["204", "205", "206", "207", "208"].some((id) =>
        String(rawAnswers[id]?.answer || "").toLowerCase().startsWith("y")
      );
      const isFlex =
        x.isFlex === true ||
        norm(program_raw + " " + billed_to_raw).includes("yhdp flex") ||
        (norm(x.source).includes("credit") && expLower.includes("customer") && cardFlexYes);

      const expense_type_raw = x.expenseType || x.expense_type_raw || "";

        if (isFlex && x.isFlex !== true) {
          console.log("Heuristic flex hit", {
            id: x.id,
            program_raw,
            billed_to_raw,
            expenseType: x.expenseType,
            source: x.source,
            rawAnswers,
          });
      }

      // Virtual rollup text for bucket rules
      const bucket_text = [
        program_raw,
        billed_to_raw,
        project_raw,
        descriptor,
        expense_type_raw,
        x.card || "",
        card_bucket,
        x.merchant || "",
        x.customer || "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return {
        ...x,
        type: decideTypeLabel(x),
        program_raw,
        billed_to_raw,
        project_raw,
        descriptor,
        expense_type_raw,
        card_bucket,
        isFlex,
        bucket_text,
        description: x.description || x.merchant || "",
      };
    });
  }, [items]);

  // Build seed maps from cfg.flexClients
  const flexSeedByClient = React.useMemo(() => {
    const m = new Map();
    for (const c of cfg.flexClients || []) {
      const k = normalizeClientKey(c.key || c.name);
      if (!k) continue;
      m.set(k, Number(c.start || 0));
    }
    return m;
  }, [cfg.flexClients]);

  const capByClient = React.useMemo(() => {
    const m = new Map();
    for (const c of cfg.flexClients || []) {
      const k = normalizeClientKey(c.key || c.name);
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

 // Auto-add Flex clients discovered in data
 React.useEffect(() => {
   if (!enriched.length) return;
   const discovered = new Map();
   for (const r of enriched) {
     if (!isYHDPFlex(r)) continue;
     const key = clientKey(r);
     const name = r.customer || "";
     if (!key) continue;
     if (!discovered.has(key)) discovered.set(key, name);
   }
   if (discovered.size === 0) return;
   const existing = new Map((cfg.flexClients || []).map(c => [normalizeClientKey(c.key || c.name), c]));
   let changed = false;
   const next = [...(cfg.flexClients || [])];
   for (const [k, name] of discovered.entries()) {
     if (!existing.has(k)) {
       next.push({ key: k, name, start: 0, cap: "", show: true });
       changed = true;
     }
   }
   if (changed) saveCfg({ ...cfg, flexClients: next });
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [enriched]); // persist when new flex clients appear

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
          <IconButton onClick={(e) => setCardMenu(e.currentTarget)} size="small" title="More">
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
            flexClients={cfg.flexClients || []}
          />
        );
      })}

      {/* Advanced editor */}
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

      {/* Slices editor */}
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
