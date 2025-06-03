// pages/live.js

import { useEffect, useState } from 'react';
import axios from 'axios';

import { Stack, Typography, Paper } from '@mui/material';

import useAllForms   from '../components/useAllForms';
import useFormTags   from '../components/useFormTags';
import TagFilterBar  from '../components/TagFilterBar';
import FormPicker    from '../components/FormPicker';
import ManualRefresh from '../components/ManualRefresh';
import PDFButton     from '../components/PDFButton';

/* ───── Helpers ───── */

// 1) Try to pick a human‐readable “name” for a normal submission
const pickNameForForm = sub => {
  const ansArray = Object.values(sub.answers || {});

  // Look for full‐name widget
  for (const field of ansArray) {
    if (field.type?.includes('fullname')) {
      const { first, last, firstName, lastName } = field.answer || {};
      const full = `${first || firstName || ''} ${last || lastName || ''}`.trim();
      if (full) return full;
    }
  }

  // Look for email widget
  for (const field of ansArray) {
    if (field.type?.includes('email') && typeof field.answer === 'string') {
      return field.answer;
    }
  }

  // Fallback: first short, non‐URL, non‐JSON text answer
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

/* ───── Main Component ───── */
export default function Live() {
  /* ─── Load all forms (normal + Sign) ─── */
  const [allForms] = useAllForms();
  // Build a quick map formId → title
  const id2title = Object.fromEntries(allForms.map(f => [f.id, f.title]));

  /* ─── Build tag map (inject “JOTSIGN” on Sign forms) ─── */
  const [rawTagMap] = useFormTags(); // user‐defined tags
  const tagMap = {};
  allForms.forEach(f => {
    const userTags = rawTagMap[f.id] || [];
    const signTag  = f.isSign ? ['JOTSIGN'] : [];
    tagMap[f.id] = Array.from(new Set([
      ...userTags.map(t => t.toUpperCase()),
      ...signTag
    ]));
  });

  /* ─── Local state ─── */
  const [filterTags, setFilterTags] = useState([]); // e.g. ['JOTSIGN', 'FINANCE']
  const [form, setForm]             = useState(null);   // selected form or null = all
  const [subs, setSubs]             = useState([]);     // merged array of submissions + sign docs
  const [loading, setLoading]       = useState(false);  // spinner on refresh

  /* ─── Fetch normal submissions (latest 20) ─── */
  const fetchLatest = async () => {
    try {
      const { data } = await axios.get('/api/latest');
      // data is array of normal submission objects
      return data; 
    } catch {
      return [];
    }
  };

  /* ─── Fetch all Sign docs for every Sign‐type form ─── */
  const fetchAllSignDocs = async () => {
    const signFormIds = allForms.filter(f => f.isSign).map(f => f.id);
    let docs = [];

    for (const fid of signFormIds) {
      try {
        const { data } = await axios.get(`/api/signDocs?formId=${fid}`);
        // data is array of { id, created_at, download_url, signers: [...] }
        const mapped = data.map(doc => ({
          id: doc.id,
          form_id: fid,
          form_title: id2title[fid],  // use our cached title
          isSign: true,
          created_at: doc.signers?.[0]?.signed_at || doc.created_at,
          answers: {
            signer: {
              text: 'Signer',
              answer: doc.signers?.[0]?.name || '—'
            },
            pdf: {
              text: 'Signed PDF',
              answer: doc.download_url
            }
          }
        }));
        docs = docs.concat(mapped);
      } catch (e) {
        console.error('Failed to fetch Sign docs for form', fid, e.response?.data || e.message);
      }
    }

    return docs;
  };

  /* ─── Load “live” feed (normal + Sign) ─── */
  const loadLive = async () => {
    setLoading(true);
    const latest   = await fetchLatest();
    const signDocs = await fetchAllSignDocs();

    // Merge normal submissions (tag as isSign:false) with Sign docs (isSign:true)
    const combined = [
      ...latest.map(s => ({ ...s, isSign: false })),
      ...signDocs
    ];

    // Sort by created_at descending
    combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Filter by tags: if filterTags is empty, show all; else only those whose form_id has one of the filterTags
    const visible = combined.filter(s => {
      if (filterTags.length === 0) return true;
      const fTags = tagMap[s.form_id] || [];
      return fTags.some(t => filterTags.includes(t));
    });

    setSubs(visible.slice(0, 20)); // keep top 20
    setLoading(false);
  };

  /* ─── On mount or when form list / filterTags changes, reload ─── */
  useEffect(() => {
    loadLive();
    const intervalId = setInterval(loadLive, 30_000); // refresh every 30s
    return () => clearInterval(intervalId);
  }, [allForms, filterTags]);

  /* ─── Decide whether to fetch only one form’s items ─── */
  useEffect(() => {
    // If a specific form is selected, reload so that it fetches only that form’s items
    if (form) {
      loadLiveForForm(form);
    }
  }, [form]);

  /* ─── Fetch items for a single form (normal or Sign) ─── */
  const loadLiveForForm = async f => {
    setLoading(true);
    let items = [];

    if (f.isSign) {
      // Fetch signed docs for this single Sign form
      try {
        const { data } = await axios.get(`/api/signDocs?formId=${f.id}`);
        items = data.map(doc => ({
          id: doc.id,
          form_id: f.id,
          form_title: f.title,
          isSign: true,
          created_at: doc.signers?.[0]?.signed_at || doc.created_at,
          answers: {
            signer: { text:'Signer', answer: doc.signers?.[0]?.name || '—' },
            pdf:    { text:'Signed PDF', answer: doc.download_url }
          }
        }));
      } catch (e) {
        console.error('Error loading Sign docs for single form', f.id, e);
      }
    } else {
      // Fetch normal submissions for this single form
      try {
        const { data } = await axios.get(`/api/submissions?id=${f.id}`);
        items = (data.content || []).map(s => ({ ...s, isSign: false }));
      } catch {
        items = [];
      }
    }

    // Sort and filter by tags if needed
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const visible = items.filter(s => {
      if (filterTags.length === 0) return true;
      const fTags = tagMap[s.form_id] || [];
      return fTags.some(t => filterTags.includes(t));
    });

    setSubs(visible.slice(0, 20));
    setLoading(false);
  };

  /* ─── Helpers to render each row ─── */
  const pickName = sub => {
    if (sub.isSign) {
      // “Signer” field for a Sign doc
      return sub.answers.signer.answer || '—';
    }
    // Normal submission: find name/email/first short answer
    return pickNameForForm(sub);
  };

  const getTitle = sub => {
    return sub.form_title || sub.form_id;
  };

  /* ─── Render UI ─── */
  return (
    <Stack spacing={2} sx={{ p: 3, alignItems: 'center' }}>
      {/* Header + Refresh */}
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="h5">Live Submissions</Typography>
        <ManualRefresh onClick={form ? () => loadLiveForForm(form) : loadLive} loading={loading} />
      </Stack>

      {/* Form dropdown: choose one form or “All” */}
      <FormPicker onSelect={setForm} />

      {/* Tag filter bar */}
      <TagFilterBar
        allTags={[...new Set(Object.values(tagMap).flat())]}
        active={filterTags}
        setActive={setFilterTags}
      />

      {/* Scrollable list */}
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
        {subs.map(s => (
          <Typography key={s.id} sx={{ mb: 1 }}>
            <strong>
              {s.isSign && '[SIGNED] '}
              {getTitle(s)}
            </strong>
            {' '}– {pickName(s)} –{' '}
            {new Date(s.created_at).toLocaleString()}{' '}
            <a
              href={
                s.isSign
                  ? `https://api.jotform.com/sign/${s.form_id}/documents/${s.id}/download?apiKey=${process.env.JOTFORM_API_KEY}`
                  : `https://www.jotform.com/inbox/${s.form_id}?submissionId=${s.id}`
              }
              target="_blank"
              rel="noreferrer"
            >
              {s.isSign ? 'Download PDF ↗' : 'Inbox ↗'}
            </a>
            {' '}
            {!s.isSign && (
              <PDFButton url={s.answers?.pdf?.download_url} name={s.id} />
            )}
          </Typography>
        ))}
      </Paper>
    </Stack>
  );
}
