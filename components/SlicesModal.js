// components/SlicesModal.js
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

export default function SlicesModal({ open, onClose, slices, onSave }) {
  const [local, setLocal] = React.useState(slices || []);
  React.useEffect(() => setLocal(slices || []), [slices]);

  const add = () =>
    setLocal((prev) => [...prev, { key: "", label: "", from: "", to: "" }]);

  const remove = (idx) =>
    setLocal((prev) => prev.filter((_, i) => i !== idx));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Manage Slices (Credit Card box)</DialogTitle>
      <DialogContent dividers>
        {(local || []).map((s, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr 1fr 1fr auto",
              gap: 8,
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <TextField
              label="Key"
              size="small"
              value={s.key}
              onChange={(e) => {
                const next = [...local];
                next[i].key = e.target.value;
                setLocal(next);
              }}
            />
            <TextField
              label="Label"
              size="small"
              value={s.label}
              onChange={(e) => {
                const next = [...local];
                next[i].label = e.target.value;
                setLocal(next);
              }}
            />
            <TextField
              type="date"
              label="From"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={s.from}
              onChange={(e) => {
                const next = [...local];
                next[i].from = e.target.value;
                setLocal(next);
              }}
            />
            <TextField
              type="date"
              label="To"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={s.to}
              onChange={(e) => {
                const next = [...local];
                next[i].to = e.target.value;
                setLocal(next);
              }}
            />
            <IconButton onClick={() => remove(i)} size="small">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </div>
        ))}
        <Button variant="outlined" onClick={add}>
          Add Slice
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => {
            // Normalize: trim keys/labels
            const cleaned = (local || []).map((s) => ({
              key: String(s.key || "").trim(),
              label: String(s.label || "").trim() || String(s.key || "").trim(),
              from: s.from || "",
              to: s.to || "",
            }));
            onSave(cleaned);
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
