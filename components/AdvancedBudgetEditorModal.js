// components/AdvancedBudgetEditorModal.js
import React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem
} from "@mui/material";
// If you kept GroupEditor inside BudgetConfigModal, export it from there:
// export { GroupEditor } from "./BudgetConfigModal";
import { GroupEditor } from "./BudgetConfigModal"; // reuse the nested editor

export default function AdvancedBudgetEditorModal({ open, budget, onClose, onSave }) {
  const [local, setLocal] = React.useState(budget || null);
  React.useEffect(() => setLocal(budget || null), [budget]);

  if (!open || !local) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit: {local.label || local.key}</DialogTitle>
      <DialogContent dividers>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <TextField label="Key" size="small" value={local.key} slotProps={{ htmlInput:{ readOnly: true } }} disabled />
          <TextField label="Label" size="small" value={local.label}
            onChange={(e)=> setLocal({ ...local, label: e.target.value })} />
          <TextField select label="Type" size="small" value={local.type}
            onChange={(e)=> setLocal({ ...local, type: e.target.value })} sx={{ minWidth: 200 }}>
            <MenuItem value="standard">Standard</MenuItem>
            <MenuItem value="yhdp_flex">YHDP FLEX (show client & billed-to)</MenuItem>
          </TextField>
          <TextField type="date" label="From" size="small" InputLabelProps={{ shrink: true }}
            value={local.from} onChange={(e)=> setLocal({ ...local, from: e.target.value })} />
          <TextField type="date" label="To" size="small" InputLabelProps={{ shrink: true }}
            value={local.to} onChange={(e)=> setLocal({ ...local, to: e.target.value })} />
          <TextField type="number" label="Budget" size="small" value={local.budget}
            onChange={(e)=> setLocal({ ...local, budget: Number(e.target.value||0) })} />
          <TextField type="number" label="Starting Spent" size="small" value={local.startSpent}
            onChange={(e)=> setLocal({ ...local, startSpent: Number(e.target.value||0) })} />
        </div>

        {/* Nested rules editor */}
        <GroupEditor
          isRoot
          node={{ op: local.rulesOp || "OR", rules: local.rules || [] }}
          onChange={(root)=> setLocal({ ...local, rulesOp: root.op || "OR", rules: root.rules || [] })}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={()=> onSave(local)}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}