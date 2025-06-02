import { useEffect, useState } from 'react';
import { Stack, Typography, Paper } from '@mui/material';
import axios from 'axios';
import FormPicker     from '../components/FormPicker';
import ManualRefresh  from '../components/ManualRefresh';
import PDFButton      from '../components/PDFButton';
import useCachedForms from '../components/useCachedForms';    // NEW

/* smart human-name picker */
const pickName = sub => {
  const ans = Object.values(sub.answers || {});

  // Full Name field
  for (const a of ans) {
    if (a.type?.includes('fullname')) {
      const { first, last, firstName, lastName } = a.answer || {};
      const full = `${first||firstName||''} ${last||lastName||''}`.trim();
      if (full) return full;
    }
  }
  // Email
  for (const a of ans) if (a.type?.includes('email')) return a.answer;
  // First short plain text
  for (const a of ans) {
    if (typeof a.answer === 'string' &&
        a.answer.length < 60 &&
        !a.answer.startsWith('http') &&
        !a.answer.trim().startsWith('{'))
      return a.answer.trim();
  }
  return '—';
};

export default function Live() {
  const [forms] = useCachedForms();                    // cached list
  const id2title = Object.fromEntries(forms.map(f=>[f.id, f.title]));

  const [form, setForm]   = useState(null);            // chosen form
  const [subs, setSubs]   = useState([]);              // newest subs
  const [loading, setLoading] = useState(false);       // spinner flag

  const fetchSubs = () => {
    setLoading(true);
    const url = form ? `/api/submissions?id=${form.id}` : '/api/latest';
    axios.get(url).then(r => {
      const list = form ? r.data.content : r.data;
      setSubs(list.slice(0, 20));
      setLoading(false);
    }).catch(()=>setLoading(false));
  };

  useEffect(() => { fetchSubs(); }, [form]);

  /* pick form title from selectedForm or cached map */
  const getTitle = s => form?.title || id2title[s.form_id] || s.form_title || s.form_id;

  return (
    <Stack spacing={2} sx={{ p:3, alignItems:'center' }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="h5">Live Submissions</Typography>
        <ManualRefresh onClick={fetchSubs} loading={loading} />
      </Stack>

      <FormPicker onSelect={setForm} />

      <Paper sx={{ maxHeight:'70vh', width:'100%', maxWidth:1000, overflowY:'auto', p:2, boxShadow:3, alignItems:'center' }}>
        {subs.map(s => (
          <Typography key={s.id} sx={{ mb:1 }}>
            <strong>{getTitle(s)}</strong> – {pickName(s)} –{' '}
            {new Date(s.created_at).toLocaleString()}{' '}
            <a href={`https://www.jotform.com/inbox/${s.form_id}?submissionId=${s.id}`} target="_blank" rel="noreferrer">
              Inbox ↗
            </a>{' '}
            <PDFButton url={s.answers?.pdf?.download_url} name={s.id} />
          </Typography>
        ))}
      </Paper>
    </Stack>
  );
}
