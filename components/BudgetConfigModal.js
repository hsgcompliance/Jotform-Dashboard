// components/BudgetConfigModal.js
import React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Button, TextField, MenuItem
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const emptyBudget = () => ({
  key: "",
  label: "",
  budget: 0,
  startSpent: 0,
  from: "",
  to: "",
  type: "standard",      // 'standard' | 'yhdp_flex'
  rules: [               // icontains on these fields
    { field: "program_raw", match: "", mode: "icontains" }
  ]
});

export default function BudgetConfigModal({ open, onClose, cfg, onSave }) {
  const [local, setLocal] = React.useState(cfg);

  React.useEffect(() => setLocal(cfg), [cfg]);

  const addBudget = () => {
    const next = { ...local, budgets: [...(local.budgets || []), emptyBudget()] };
    setLocal(next);
  };
  const removeBudget = (idx) => {
    const next = { ...local, budgets: local.budgets.filter((_, i) => i !== idx) };
    setLocal(next);
  };

  const addRule = (bIdx) => {
    const next = { ...local };
    next.budgets[bIdx].rules.push({ field: "program_raw", match: "", mode: "icontains" });
    setLocal(next);
  };
  const removeRule = (bIdx, rIdx) => {
    const next = { ...local };
    next.budgets[bIdx].rules.splice(rIdx, 1);
    setLocal(next);
  };

  const addSlice = () => {
    const next = {
      ...local,
      slices: [
        ...(local.slices || []),
        { key: "", label: "", from: "", to: "" }
      ]
    };
    setLocal(next);
  };
  const removeSlice = (idx) => {
    const next = { ...local, slices: local.slices.filter((_, i) => i !== idx) };
    setLocal(next);
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
              <TextField label="Key" size="small" value={b.key}
                onChange={(e)=> {
                  const next={...local}; next.budgets[i].key=e.target.value; setLocal(next);
                }} />
              <TextField label="Label" size="small" value={b.label}
                onChange={(e)=> {
                  const next={...local}; next.budgets[i].label=e.target.value; setLocal(next);
                }} />
              <TextField select label="Type" size="small" value={b.type}
                onChange={(e)=> {
                  const next={...local}; next.budgets[i].type=e.target.value; setLocal(next);
                }} sx={{ minWidth: 160 }}>
                <MenuItem value="standard">Standard</MenuItem>
                <MenuItem value="yhdp_flex">YHDP FLEX (show client & billed-to)</MenuItem>
              </TextField>
              <TextField type="date" label="From" size="small" InputLabelProps={{ shrink: true }} value={b.from}
                onChange={(e)=> {
                  const next={...local}; next.budgets[i].from=e.target.value; setLocal(next);
                }} />
              <TextField type="date" label="To" size="small" InputLabelProps={{ shrink: true }} value={b.to}
                onChange={(e)=> {
                  const next={...local}; next.budgets[i].to=e.target.value; setLocal(next);
                }} />
              <TextField type="number" label="Budget" size="small" value={b.budget}
                onChange={(e)=> {
                  const next={...local}; next.budgets[i].budget=Number(e.target.value||0); setLocal(next);
                }} />
              <TextField type="number" label="Starting Spent" size="small" value={b.startSpent}
                onChange={(e)=> {
                  const next={...local}; next.budgets[i].startSpent=Number(e.target.value||0); setLocal(next);
                }} />
              <Button color="error" onClick={()=>removeBudget(i)}>Remove Budget</Button>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Rules (icontains)</div>
              {(b.rules || []).map((r, j) => (
                <div key={j} style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <TextField select label="Field" size="small" value={r.field}
                    onChange={(e)=> {
                      const next={...local}; next.budgets[i].rules[j].field=e.target.value; setLocal(next);
                    }}>
                    <MenuItem value="program_raw">program_raw</MenuItem>
                    <MenuItem value="expense_type_raw">expense_type_raw</MenuItem>
                    <MenuItem value="card_bucket">card_bucket</MenuItem>
                    <MenuItem value="description">description</MenuItem>
                    <MenuItem value="merchant">merchant</MenuItem>
                  </TextField>
                  <TextField label="Match" size="small" value={r.match}
                    onChange={(e)=> {
                      const next={...local}; next.budgets[i].rules[j].match=e.target.value; setLocal(next);
                    }} />
                  <Button size="small" onClick={()=>removeRule(i,j)}>Remove</Button>
                </div>
              ))}
              <Button size="small" variant="outlined" onClick={()=>addRule(i)}>Add Rule</Button>
            </div>
          </div>
        ))}
        <Button variant="outlined" onClick={addBudget}>Add Budget</Button>

        {/* Slices */}
        <h3>Time Slices (nicknamed ranges)</h3>
        {(local.slices || []).map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <TextField label="Key" size="small" value={s.key}
              onChange={(e)=> {
                const next={...local}; next.slices[i].key=e.target.value; setLocal(next);
              }} />
            <TextField label="Label" size="small" value={s.label}
              onChange={(e)=> {
                const next={...local}; next.slices[i].label=e.target.value; setLocal(next);
              }} />
            <TextField type="date" label="From" size="small" InputLabelProps={{ shrink: true }} value={s.from}
              onChange={(e)=> {
                const next={...local}; next.slices[i].from=e.target.value; setLocal(next);
              }} />
            <TextField type="date" label="To" size="small" InputLabelProps={{ shrink: true }} value={s.to}
              onChange={(e)=> {
                const next={...local}; next.slices[i].to=e.target.value; setLocal(next);
              }} />
            <Button color="error" onClick={()=>removeSlice(i)}>Remove</Button>
          </div>
        ))}
        <Button variant="outlined" onClick={addSlice}>Add Slice</Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={()=>onSave(local)} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}
