// components/BudgetConfigModal.js
import React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Button, TextField, MenuItem, FormControlLabel, Switch, Tooltip
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

/** Ruleable fields (labels + hover descriptions) */
const allowedFieldDefs = [
  {
    key: "bucket_text",
    label: "Any grant field (wide)",
    desc:
      "Wide match across: Program, Billed To, Project, Descriptor/Service Type, Expense Type, Card, Merchant, Customer " +
      "+ Purpose, Note, Other. Includes Invoice ‘Other’ and Credit Card ‘Notes’.",
  },
  { key: "program_raw",      label: "Program (resolved)",           desc: "Unified program: Project (Customer path) or Bill To (Program path)." },
  { key: "billed_to_raw",    label: "Billed To (resolved)",         desc: "Resolved Bill To label when using Program path or splits." },
  { key: "project_raw",      label: "Project (resolved)",           desc: "Resolved Project label when using Customer path." },
  { key: "descriptor",       label: "Descriptor / Service Type",    desc: "Invoice service type or similar descriptor text." },
  { key: "expense_type_raw", label: "Expense Type",                 desc: "Raw expense type value (e.g., For a Customer / For a Program)." },
  { key: "card_bucket",      label: "Card Bucket",                  desc: "Youth or Housing bucket (derived from card label)." },
  { key: "merchant",         label: "Merchant / Vendor",            desc: "Merchant for cards or Vendor for invoices." },
  { key: "customer",         label: "Client / Customer",            desc: "Customer/client name if present." },
  { key: "card",             label: "Card Label",                   desc: "Original card identity string (may be blank if bypassed)." },
  { key: "source",           label: "Source (form)",                desc: "invoice or credit-card." },
  { key: "type",             label: "Type Label",                   desc: "UI type label (Invoice / Housing Card / Youth Card)." },
  { key: "isFlex",           label: "YHDP Flex (true/false)",       desc: "Boolean flag (schema flag or text heuristic)." },
];

const emptyLeaf = () => ({ field: "bucket_text", match: "", mode: "icontains" });
const emptyGroup = () => ({ op: "OR", rules: [emptyLeaf()] });

const emptyBudget = () => ({
  key: "",
  label: "",
  budget: 0,
  startSpent: 0,
  from: "",
  to: "",
  type: "standard",      // 'standard' | 'yhdp_flex'
  rulesOp: "OR",
  rules: [ emptyLeaf() ],
});

// ---------- Small helpers ----------
const clone = (x) => JSON.parse(JSON.stringify(x));
const isGroup = (node) => node && Array.isArray(node.rules);

// ---------- Rule leaf row ----------
function RuleRow({ value, onChange, onRemove }) {
  const v = value || emptyLeaf();
  const isFlexField = v.field === "isFlex";

  const handleField = (field) => {
    const next = { ...v, field };
    if (field === "isFlex") {
      next.mode = "equals";
      if (next.match !== "true" && next.match !== "false") next.match = "true";
    } else if (next.mode == null) {
      next.mode = "icontains";
    }
    onChange(next);
  };

  const handleMode = (mode) => onChange({ ...v, mode });
  const handleMatch = (match) => onChange({ ...v, match });
  const handleNot = (not) => onChange({ ...v, not });

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
      <TextField
        select
        label="Field"
        size="small"
        value={v.field}
        onChange={(e) => handleField(e.target.value)}
        sx={{ minWidth: 180 }}
      >
        {allowedFieldDefs.map(({ key, label, desc }) => (
          <MenuItem key={key} value={key} title={desc}>
            {label}
          </MenuItem>
        ))}
      </TextField>

      {isFlexField ? (
        <>
          <Tooltip title="isFlex only supports equality">
            <TextField
              select
              label="Mode"
              size="small"
              value="equals"
              disabled
              sx={{ minWidth: 130 }}
            >
              <MenuItem value="equals">equals</MenuItem>
            </TextField>
          </Tooltip>

          <TextField
            select
            label="Match"
            size="small"
            value={v.match === "false" ? "false" : "true"}
            onChange={(e) => handleMatch(e.target.value)}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="true">true</MenuItem>
            <MenuItem value="false">false</MenuItem>
          </TextField>
        </>
      ) : (
        <>
          <TextField
            select
            label="Mode"
            size="small"
            value={v.mode || "icontains"}
            onChange={(e) => handleMode(e.target.value)}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="icontains">icontains</MenuItem>
            <MenuItem value="equals">equals</MenuItem>
          </TextField>

          <TextField
            label="Match"
            size="small"
            value={v.match ?? ""}
            onChange={(e) => handleMatch(e.target.value)}
            sx={{ minWidth: 220 }}
          />
        </>
      )}

      <FormControlLabel
        control={<Switch size="small" checked={!!v.not} onChange={(e) => handleNot(e.target.checked)} />}
        label="NOT"
        sx={{ ml: 1 }}
      />

      <Button size="small" onClick={onRemove}>Remove</Button>
    </div>
  );
}

// ---------- Recursive group editor ----------
export function GroupEditor({ node, onChange, isRoot = false }) {
  const n = node && isGroup(node) ? node : emptyGroup();

  const setOp = (op) => onChange({ ...n, op });
  const replaceChild = (idx, nextChild) => {
    const next = clone(n);
    next.rules[idx] = nextChild;
    onChange(next);
  };
  const addLeaf = () => {
    const next = clone(n);
    next.rules.push(emptyLeaf());
    onChange(next);
  };
  const addGroup = () => {
    const next = clone(n);
    next.rules.push(emptyGroup());
    onChange(next);
  };
  const removeChild = (idx) => {
    const next = clone(n);
    next.rules.splice(idx, 1);
    if (next.rules.length === 0) next.rules.push(emptyLeaf());
    onChange(next);
  };

  return (
    <div style={{
      border: isRoot ? "1px dashed #e3e7ee" : "1px solid #e3e7ee",
      borderRadius: 8,
      padding: 10,
      marginBottom: 10,
      background: isRoot ? "#fafbff" : "#fff",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <TextField
          select
          size="small"
          label={isRoot ? "Top-level Operator" : "Group Operator"}
          value={n.op || "OR"}
          onChange={(e) => setOp(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="OR">OR</MenuItem>
          <MenuItem value="AND">AND</MenuItem>
        </TextField>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {isRoot ? "Rows must satisfy this operator across all child rules/groups." :
                    "This group’s children are combined with this operator."}
        </div>
      </div>

      {(n.rules || []).map((child, idx) => (
        <div key={idx} style={{ marginLeft: 6 }}>
          {isGroup(child) ? (
            <div style={{ position: "relative" }}>
              <GroupEditor
                node={child}
                onChange={(nextChild) => replaceChild(idx, nextChild)}
              />
              <div>
                <Button size="small" onClick={() => removeChild(idx)}>Remove Group</Button>
              </div>
            </div>
          ) : (
            <RuleRow
              value={child}
              onChange={(nextLeaf) => replaceChild(idx, nextLeaf)}
              onRemove={() => removeChild(idx)}
            />
          )}
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <Button size="small" variant="outlined" onClick={addLeaf}>Add Rule</Button>
        <Button size="small" variant="outlined" onClick={addGroup}>Add Group</Button>
      </div>
    </div>
  );
}

export default function BudgetConfigModal({ open, onClose, cfg, onSave }) {
  const [local, setLocal] = React.useState(cfg);

  React.useEffect(() => setLocal(cfg), [cfg]);

  const updateBudget = (idx, patch) => {
    setLocal((prev) => {
      const next = clone(prev);
      next.budgets[idx] = { ...next.budgets[idx], ...patch };
      return next;
    });
  };

  const addBudget = () => {
    setLocal((prev) => ({
      ...prev,
      budgets: [...(prev.budgets || []), emptyBudget()],
    }));
  };
  const removeBudget = (idx) => {
    setLocal((prev) => ({
      ...prev,
      budgets: (prev.budgets || []).filter((_, i) => i !== idx),
    }));
  };

  const addSlice = () => {
    setLocal((prev) => ({
      ...prev,
      slices: [...(prev.slices || []), { key: "", label: "", from: "", to: "" }],
    }));
  };
  const removeSlice = (idx) => {
    setLocal((prev) => ({
      ...prev,
      slices: (prev.slices || []).filter((_, i) => i !== idx),
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 5 }}>
        Budgets Configuration
        <IconButton onClick={onClose} sx={{ position: "absolute", top: 8, right: 8 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* Budgets */}
        <h3 style={{ marginTop: 0 }}>Budgets</h3>
        {(local.budgets || []).map((b, i) => (
          <div key={i} style={{ border: "1px solid #eee", padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <TextField
                label="Key"
                size="small"
                value={b.key}
                onChange={(e) => updateBudget(i, { key: e.target.value })}
              />
              <TextField
                label="Label"
                size="small"
                value={b.label}
                onChange={(e) => updateBudget(i, { label: e.target.value })}
              />
              <TextField
                select
                label="Type"
                size="small"
                value={b.type}
                onChange={(e) => updateBudget(i, { type: e.target.value })}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="standard">Standard</MenuItem>
                <MenuItem value="yhdp_flex">YHDP FLEX (show client & billed-to)</MenuItem>
              </TextField>
              <TextField
                type="date"
                label="From"
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                value={b.from}
                onChange={(e) => updateBudget(i, { from: e.target.value })}
              />
              <TextField
                type="date"
                label="To"
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                value={b.to}
                onChange={(e) => updateBudget(i, { to: e.target.value })}
              />
              <TextField
                type="number"
                label="Budget"
                size="small"
                value={b.budget}
                onChange={(e) => updateBudget(i, { budget: Number(e.target.value || 0) })}
              />
              <TextField
                type="number"
                label="Starting Spent"
                size="small"
                value={b.startSpent}
                onChange={(e) => updateBudget(i, { startSpent: Number(e.target.value || 0) })}
              />
              <Button color="error" onClick={() => removeBudget(i)}>Remove Budget</Button>
            </div>

            {/* Advanced nested rules */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Rules (nested)</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                Tip: use <code>bucket_text</code> to match across Program / Billed To / Project / Descriptor / Expense Type / Card / Merchant / Customer.
              </div>
              <GroupEditor
                isRoot
                node={{ op: b.rulesOp || "OR", rules: b.rules || [] }}
                onChange={(nextRoot) => {
                  updateBudget(i, { rulesOp: nextRoot.op || "OR", rules: nextRoot.rules || [] });
                }}
              />
            </div>
          </div>
        ))}
        <Button variant="outlined" onClick={addBudget}>Add Budget</Button>

        {/* Slices */}
        <h3>Time Slices (nicknamed ranges)</h3>
        {(local.slices || []).map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <TextField
              label="Key"
              size="small"
              value={s.key}
              onChange={(e) => {
                const next = clone(local);
                next.slices[i].key = e.target.value;
                setLocal(next);
              }}
            />
            <TextField
              label="Label"
              size="small"
              value={s.label}
              onChange={(e) => {
                const next = clone(local);
                next.slices[i].label = e.target.value;
                setLocal(next);
              }}
            />
            <TextField
              type="date"
              label="From"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              value={s.from}
              onChange={(e) => {
                const next = clone(local);
                next.slices[i].from = e.target.value;
                setLocal(next);
              }}
            />
            <TextField
              type="date"
              label="To"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              value={s.to}
              onChange={(e) => {
                const next = clone(local);
                next.slices[i].to = e.target.value;
                setLocal(next);
              }}
            />
            <Button color="error" onClick={() => removeSlice(i)}>Remove</Button>
          </div>
        ))}
        <Button variant="outlined" onClick={addSlice}>Add Slice</Button>
      </DialogContent>

      <DialogActions>
        <Button onClick={() => onSave(local)} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}
