// pages/live.js
import { useEffect, useState } from 'react';
import { Stack, Typography, Paper } from '@mui/material';
import axios from 'axios';

import FormPicker     from '../components/FormPicker';
import ManualRefresh  from '../components/ManualRefresh';
import PDFButton      from '../components/PDFButton';
import TagFilterBar   from '../components/TagFilterBar';

import useCachedForms from '../components/useCachedForms';
import useFormTags    from '../components/useFormTags';

/* ---------- Helpers ---------- */

// 1) Pick a human-friendly “submission name” from fields
const pickName = sub => {
  const ansArray = Object.values(sub.answers || {});

  // Full Name widget
  for (const field of ansArray) {
    if (field.type?.includes('fullname')) {
      const { first, last, firstName, lastName } = field.answer || {};
      const fullName = `${first || firstName || ''} ${last || lastName || ''}`.trim();
      if (fullName) return fullName;
    }
  }

  // Email field
  for (const field of ansArray) {
    if (field.type?.includes('email') && typeof field.answer === 'string') {
      return field.answer;
    }
  }

  // First short, non-JSON, non-URL text
  for (const field of ansArray) {
    const a = field.answer;
    if (
      typeof a === 'string' &&
      a.length < 60 &&
      !a.startsWith('http') &&
      !a.trim().startsWith('{')
    ) {
      return a.trim();
    }
  }

  return '—';
};

export default function Live() {
  /* ─── Cached forms & tag map ─── */
  const [forms] = useCachedForms();       // [ { id, title, ... }, … ]
  const [tagMap] = useFormTags();         // { formId: ['TAG1','TAG2'], … }

  /* Build a quick map from formId → title for “All forms” view */
  const id2title = Object.fromEntries(forms.map(f => [f.id, f.title]));

  /* ─── Local state ─── */
  const [form, setForm]               = useState(null);     // selected form object or null = all
  const [subs, setSubs]               = useState([]);       // array of latest submissions
  const [loading, setLoading]         = useState(false);    // spinner for refresh
  const [filterTags, setFilterTags]   = useState([]);       // array of uppercase tags to filter by

  /* ─── Fetch submissions helper ─── */
  const fetchSubs = () => {
    setLoading(true);
    const url = form ? `/api/submissions?id=${form.id}` : '/api/latest';
    axios.get(url)
      .then(res => {
        const list = form ? res.data.content : res.data;
        setSubs(list.slice(0, 20));   // keep only top 20
      })
      .catch(() => {
        // silently ignore errors; you can console.error here if desired
      })
      .finally(() => {
        setLoading(false);
      });
  };

  /* ─── Load submissions on mount & when `form` changes ─── */
  useEffect(() => {
    fetchSubs();
  }, [form]);

  /* ─── Filter submissions by tags (if any) ─── */
  const filteredSubs = subs.filter(s => {
    if (filterTags.length === 0) return true;
    const sTags = tagMap[s.form_id] || [];
    return sTags.some(t => filterTags.includes(t));
  });

  /* ─── Get display title for a submission `s` ─── */
  const getTitle = s => {
    // If a form is selected, always show that form’s title
    if (form?.title) return form.title;
    // Otherwise, use the `form_title` returned by API or our cached map
    return s.form_title || id2title[s.form_id] || s.form_id;
  };

  /* ─── Render UI ─── */
  return (
    <Stack spacing={2} sx={{ p: 3, alignItems: 'center' }}>
      {/* Header with “Live Submissions” and Refresh icon */}
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="h5">Live Submissions</Typography>
        <ManualRefresh onClick={fetchSubs} loading={loading} />
      </Stack>

      {/* Form filter */}
      <FormPicker onSelect={setForm} />

      {/* Tag filter bar */}
      <TagFilterBar
        allTags={[...new Set(Object.values(tagMap).flat())]} 
        active={filterTags} 
        setActive={setFilterTags} 
      />

      {/* Scrollable list of filtered submissions */}
      <Paper
        sx={{
          maxHeight: '70vh',
          width: '100%',
          maxWidth: 1000,
          overflowY: 'auto',
          p: 2,
          boxShadow: 3
        }}
      >
        {filteredSubs.map(s => (
          <Typography key={s.id} sx={{ mb: 1 }}>
            <strong>{getTitle(s)}</strong> – {pickName(s)} –{' '}
            {new Date(s.created_at).toLocaleString()}{' '}
            <a
              href={`https://www.jotform.com/inbox/${s.form_id}?submissionId=${s.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Inbox ↗
            </a>{' '}
            <PDFButton url={s.answers?.pdf?.download_url} name={s.id} />
          </Typography>
        ))}
      </Paper>
    </Stack>
  );
}
