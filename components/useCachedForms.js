import { useEffect, useState } from 'react';
import { Stack, Typography } from '@mui/material';
import axios from 'axios';
import FormPicker from '../components/FormPicker';

const readLS  = k => (typeof window !== 'undefined' ? localStorage.getItem(k) : null);
const writeLS = (k,v) => { if (typeof window !== 'undefined') localStorage.setItem(k,v); };

export default function useCachedForms() {           // ← default export
  const [forms, setForms] = useState(() => JSON.parse(readLS('formsCached') || '[]'));

  const reload = () =>
    axios.get('/api/forms').then(r => {
      const list = r.data.content || [];
      setForms(list);
      writeLS('formsCached', JSON.stringify(list));
    });

  useEffect(() => { if (!forms.length) reload(); }, []);

  return [forms, reload];                            // ← array
}