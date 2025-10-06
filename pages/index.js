// pages/index.js
import { useSession, signIn } from 'next-auth/react';
import { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';

import useAllForms   from '../components/useAllForms';
import useFormTags   from '../components/useFormTags';
import FormSidebar   from '../components/FormSidebar';
import SubList       from '../components/SubList';
import AnswerTable   from '../components/AnswerTable';
import ManualRefresh from '../components/ManualRefresh';
import TagFilterBar  from '../components/TagFilterBar';
import FormTagPicker from '../components/FormTagPicker';
import DownloadBar   from '../components/DownloadBar';

/* ─────── localStorage helpers for subs ─────── */
const rLS = k => (typeof window !== 'undefined' ? localStorage.getItem(k) : null);
const wLS = (k, v) => { if (typeof window !== 'undefined') localStorage.setItem(k, v); };

/* Optional per-form PDF doc mapping (labels → documentId) via NEXT_PUBLIC env */
const DOC_MAP = (() => {
  try {
    const raw = process.env.NEXT_PUBLIC_JOTFORM_PDF_DOC_MAP || '{}';
    return JSON.parse(raw);
  } catch {
    return {};
  }
})();

export default function Dashboard() {
  /* ─── Google auth gate ─── */
  const { data: session, status } = useSession();
  if (status === 'loading') return null;
  if (!session) return (
    <div style={{ padding: 40 }}>
      <button onClick={() => signIn('google')}>Sign in with HRDC account</button>
    </div>
  );

  /* ─── Forms (combined normal + Sign) ─── */
  const [allForms, reloadAll] = useAllForms();

  /* ─── Tag state ─── */
  const [rawTagMap, setRawTagMap] = useFormTags(); // user-defined tags
  // Build a “computed” tagMap that ensures Sign forms always include “JOTSIGN”
  const tagMap = useMemo(() => {
    const m = {};
    allForms.forEach(f => {
      const userTags = rawTagMap[f.id] || [];
      const signTag = f.isSign ? ['JOTSIGN'] : [];
      m[f.id] = Array.from(new Set([ ...userTags.map(t => t.toUpperCase()), ...signTag ]));
    });
    return m;
  }, [allForms, rawTagMap]);
  const [tagDialog, setTagDialog] = useState(null);  // form object being edited
  const [activeTags, setActiveTags] = useState([]);  // [ 'TAG1', 'TAG2' ]
  const onEditTags = form => setTagDialog(form);

  /* ─── Local state ─── */
  const [subsCache,    setSubsCache]    = useState({});
  const [selectedForm, setSelectedForm] = useState(null);
  const [subs,         setSubs]         = useState([]);
  const [selSub,       setSelSub]       = useState(null);
  const [searchForms,  setSearchForms]  = useState('');
  const [searchSubs,   setSearchSubs]   = useState('');
  const [loadingSubs,  setLoadingSubs]  = useState(false);

  /* ─── Get regular submissions (with caching) ─── */
  const loadSubs = useCallback((formId) => {
    setLoadingSubs(true);

    if (subsCache[formId]) {
      setSubs(subsCache[formId]);
      setLoadingSubs(false);
      return;
    }
    const hit = rLS(`subs_${formId}`);
    if (hit) {
      const p = JSON.parse(hit);
      setSubs(p);
      setSubsCache(prev => ({ ...prev, [formId]: p }));
      setLoadingSubs(false);
      return;
    }

    axios.get(`/api/submissions?id=${formId}`)
      .then(r => {
        const list = r.data.content || [];
        setSubs(list);
        setSubsCache(prev => ({ ...prev, [formId]: list }));
        wLS(`subs_${formId}`, JSON.stringify(list));
      })
      .catch(console.error)
      .finally(() => setLoadingSubs(false));
  }, [subsCache]);

  const reloadSubs = useCallback((formId) => {
    setSubsCache(prev => ({ ...prev, [formId]: undefined }));
    if (typeof window !== 'undefined') localStorage.removeItem(`subs_${formId}`);
    loadSubs(formId);
  }, [loadSubs]);

  /* ─── Get Sign submissions (signed documents) — OK if this fails ─── */
  const loadSignDocs = useCallback(async (formId) => {
    setLoadingSubs(true);
    setSubs([]); // clear out any old entries
    try {
      const { data } = await axios.get(`/api/signDocs?formId=${formId}`);
      // data expected: array of { id, created_at, download_url, signers: [...] }
      const mapped = (data || []).map(doc => ({
        id: doc.id,
        isSign: true,
        created_at: doc.signers?.[0]?.signed_at || doc.created_at,
        answers: {
          signer: { text: 'Signer',      answer: doc.signers?.[0]?.name || 'Unknown' },
          pdf:    { text: 'Signed PDF',  answer: doc.download_url }
        }
      }));
      setSubs(mapped);
    } catch (err) {
      console.error('Error loading Sign docs:', err?.response?.data || err?.message || err);
      setSubs([]); // graceful empty
    } finally {
      setLoadingSubs(false);
    }
  }, []);

  /* ─── Load subs on form change ─── */
  useEffect(() => {
    if (!selectedForm) return;
    setSelSub(null);
    if (selectedForm.isSign) {
      loadSignDocs(selectedForm.id);
    } else {
      loadSubs(selectedForm.id);
    }
  }, [selectedForm, loadSubs, loadSignDocs]);

  /* ─── Filtering helpers ─── */
  const matchesTitle = f => f.title.toLowerCase().includes(searchForms.toLowerCase());
  const matchesTags  = f => {
    if (activeTags.length === 0) return true;
    const fTags = tagMap[f.id] || [];
    return fTags.some(t => activeTags.includes(t));
  };
  const filteredForms = allForms.filter(f => matchesTitle(f) && matchesTags(f));

  const filteredSubs = subs.filter(s =>
    JSON.stringify(s.answers).toLowerCase().includes(searchSubs.toLowerCase())
  );

  /* ─── UI ─── */
  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column' }}>

      {/* header */}
      <header style={{
        padding:16,
        borderBottom:'1px solid #ddd',
        display:'flex',
        alignItems:'center',
        gap:20
      }}>
        <h1 style={{ margin:0 }}>JotForm Dashboard</h1>
        <ManualRefresh onClick={reloadAll} title="Reload forms" />
      </header>

      {/* Tag Filter Bar */}
      <TagFilterBar
        allTags={[...new Set(Object.values(tagMap).flat())]}
        active={activeTags}
        setActive={setActiveTags}
      />

      {/* body */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* sidebar */}
        <FormSidebar
          forms={filteredForms}
          selected={selectedForm}
          onSelect={setSelectedForm}
          search={searchForms}
          setSearch={setSearchForms}
          tags={tagMap}
          onEditTags={onEditTags}
        />

        {/* submissions + detail */}
        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
          {/* submission list */}
          <div style={{
            width:'35%',
            borderRight:'1px solid #ddd',
            padding:16,
            overflowY:'auto'
          }}>
            {selectedForm ? (
              <>
                <div style={{
                  display:'flex',
                  justifyContent:'space-between',
                  alignItems:'baseline'
                }}>
                  <h2 style={{ margin:0 }}>{selectedForm.title}</h2>
                  <a
                    href={`https://www.jotform.com/build/${selectedForm.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >Open ↗</a>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  margin: '12px 0'
                }}>
                  <input
                    style={{
                      flex: 1,
                      padding:4,
                      border:'1px solid #ccc',
                      borderRadius:4
                    }}
                    placeholder="Search submissions…"
                    value={searchSubs}
                    onChange={e => setSearchSubs(e.target.value)}
                  />
                  <ManualRefresh
                    onClick={() => reloadSubs(selectedForm.id)}
                    loading={loadingSubs}
                    title="Reload submissions"
                  />
                </div>

                <SubList
                  subs={filteredSubs}
                  selected={selSub}
                  onSelect={setSelSub}
                />
              </>
            ) : (
              <p>Select a form.</p>
            )}
          </div>

          {/* submission detail */}
          <div style={{ flex:1, padding:16, overflowY:'auto' }}>
            {selSub ? (
              <>
                <DownloadBar
                  formId={selectedForm?.id}
                  sub={selSub}
                  /* Optional extra doc buttons per form (if provided) */
                  extraDocs={DOC_MAP[selectedForm?.id] || {}}
                />
                <AnswerTable answers={selSub.answers} subId={selSub.id} />
              </>
            ) : (
              <p>{selectedForm ? 'Select a submission.' : '—'}</p>
            )}
          </div>
        </div>

        {/* Tag Edit Dialog */}
        {tagDialog && (
          <FormTagPicker
            open
            existingTags={[...new Set(Object.values(tagMap).flat())]}
            tags={tagMap[tagDialog.id] || []}
            setTags={newTags => setRawTagMap(tagDialog.id, newTags)}
            onClose={() => setTagDialog(null)}
          />
        )}
      </div>
    </div>
  );
}
