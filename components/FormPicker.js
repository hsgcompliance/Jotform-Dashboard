import { useEffect, useState } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import axios from 'axios';

const readLS  = key => (typeof window !== 'undefined' ? localStorage.getItem(key) : null);
const writeLS = (key, val) => { if (typeof window !== 'undefined') localStorage.setItem(key, val); };

export default function FormPicker({ onSelect, defaultForm }) {
  /* 1 ─ load cached list immediately */
  const cached = JSON.parse(readLS('formsCached') || '[]');

  const [forms, setForms]     = useState(cached);
  const [loading, setLoading] = useState(false);
  const [value, setValue]     = useState(defaultForm || null);

  /* 2 ─ fetch only if cache was empty */
  useEffect(() => {
    if (cached.length) return;
    setLoading(true);
    axios.get('/api/forms').then(r => {
      const list = r.data.content || [];
      setForms(list);
      writeLS('formsCached', JSON.stringify(list));
      setLoading(false);
    });
  }, []);

  /* 3 ─ bubble selection up */
  useEffect(() => { if (value) onSelect(value); }, [value]);

  return (
    <Autocomplete
      options={forms}
      getOptionLabel={o => o.title}
      fullWidth
      value={value}
      onChange={(e, val) => setValue(val)}
      loading={loading}
      renderInput={params => (
        <TextField
          {...params}
          label="Select Form"
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading && <CircularProgress size={16} sx={{ mr: 1 }} />}
                {params.InputProps.endAdornment}
              </>
            )
          }}
        />
      )}
    />
  );
}
