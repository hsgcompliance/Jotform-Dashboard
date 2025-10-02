//components/FormPicker.js
import { useEffect, useMemo, useRef, useState } from "react";
import { Autocomplete, TextField, CircularProgress } from "@mui/material";
import axios from "axios";

const LS_KEY = "formsCached.v1";

const readLS = (key) => {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(key); } catch { return null; }
};
const writeLS = (key, val) => {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, val); } catch {}
};

export default function FormPicker({ onSelect, defaultForm }) {
  // 1) show cache immediately
  const cached = useMemo(() => {
    try { return JSON.parse(readLS(LS_KEY) || "[]"); } catch { return []; }
  }, []);
  const [forms, setForms] = useState(cached);
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState(null);
  const mountedRef = useRef(true);

  // 2) background revalidate (always)
  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const r = await axios.get("/api/forms", { signal: controller.signal });
        const list = Array.isArray(r?.data?.content) ? r.data.content : [];
        if (!mountedRef.current) return;
        setForms(list);
        writeLS(LS_KEY, JSON.stringify(list));
      } catch (e) {
        // silently ignore (offline etc.)
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, []);

  // 3) resolve defaultForm (id or object)
  useEffect(() => {
    if (!defaultForm) return;
    // If id-like, pick by id; if object-like, accept it (or map to list instance)
    if (typeof defaultForm === "string" || typeof defaultForm === "number") {
      const found = forms.find((f) => f.id === defaultForm);
      if (found) setValue(found);
    } else if (typeof defaultForm === "object") {
      // prefer the matching option instance if present
      const found = defaultForm?.id
        ? forms.find((f) => f.id === defaultForm.id) || defaultForm
        : defaultForm;
      setValue(found);
    }
  }, [defaultForm, forms]);

  // 4) bubble selection up (only when it changes)
  useEffect(() => {
    if (value && typeof onSelect === "function") onSelect(value);
  }, [value, onSelect]);

  return (
    <Autocomplete
      options={forms}
      // important so the selected value sticks even if it's a different object ref
      isOptionEqualToValue={(o, v) => o?.id === v?.id}
      getOptionLabel={(o) => (o?.title ? String(o.title) : "")}
      fullWidth
      value={value}
      onChange={(_, val) => setValue(val)}
      loading={loading}
      noOptionsText={loading ? "Loading…" : "No forms"}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Select Form"
          // InputProps is still valid (not deprecated) for endAdornment composition
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading && <CircularProgress size={16} sx={{ mr: 1 }} />}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
