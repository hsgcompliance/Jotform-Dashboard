// pages/index.js
import { useSession, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

import useCachedForms from '../components/useCachedForms';
import FormSidebar    from '../components/FormSidebar';
import SubList        from '../components/SubList';
import AnswerTable    from '../components/AnswerTable';
import ManualRefresh  from '../components/ManualRefresh';

 import TagFilterBar     from '../components/TagFilterBar';
 import FormTagPicker    from '../components/FormTagPicker';
 import useFormTags      from '../components/useFormTags';

/* local-storage helpers for subs */
const rLS = k => (typeof window !== 'undefined' ? localStorage.getItem(k) : null);
const wLS = (k,v) => { if (typeof window !== 'undefined') localStorage.setItem(k,v); };

export default function Dashboard() {
  /* ─── Google auth gate ─── */
  const { data: session, status } = useSession();
  if (status === 'loading') return null;
  if (!session) return (
    <div style={{ padding:40 }}>
      <button onClick={() => signIn('google')}>Sign in with HRDC account</button>
    </div>
  );

  /* ─── Forms (cached by hook) ─── */
  const [forms, reloadForms] = useCachedForms();

  /* ─── Local state ─── */
  const [subsCache,   setSubsCache]   = useState({});
  const [selectedForm,setSelectedForm]= useState(null);
  const [subs,        setSubs]        = useState([]);
  const [selSub,      setSelSub]      = useState(null);
  const [searchForms, setSearchForms] = useState('');
  const [searchSubs,  setSearchSubs]  = useState('');

  /* ─── Tag state ─── */
  const [tagMap, setTagMap]     = useFormTags();
  const [tagDialog, setTagDialog] = useState(null);  // form being edited
  const [activeTags, setActiveTags] = useState([]);
  const onEditTags = form => setTagDialog(form);
  
  /* ─── Get submissions (with caching) ─── */
  const loadSubs = (formId) => {
    if (subsCache[formId]) { setSubs(subsCache[formId]); return; }
    const hit = rLS(`subs_${formId}`);
    if (hit) { const p=JSON.parse(hit); setSubs(p); setSubsCache(prev=>({...prev,[formId]:p})); return;}
    axios.get(`/api/submissions?id=${formId}`).then(r=>{
      const list = r.data.content || [];
      setSubs(list);
      setSubsCache(prev=>({...prev,[formId]:list}));
      wLS(`subs_${formId}`,JSON.stringify(list));
    });
  };

  /* load subs when form changes */
  useEffect(() => {
    if (selectedForm) {
      setSelSub(null);
      loadSubs(selectedForm.id);
    }
  }, [selectedForm]);

  /* ─── Filtering helpers ─── */
const matchesTitle = f => f.title.toLowerCase().includes(searchForms.toLowerCase());
const matchesTags  = f => activeTags.length === 0 || (tagMap[f.id] || []).some(t => activeTags.includes(t));
const filteredForms = forms.filter(f => matchesTitle(f) && matchesTags(f));
  const filteredSubs = subs.filter(s =>
    JSON.stringify(s.answers).toLowerCase().includes(searchSubs.toLowerCase())
  );

  /* ─── UI ─── */
  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column' }}>
      {/* header */}
      <header style={{ padding:16, borderBottom:'1px solid #ddd', display:'flex', alignItems:'center', gap:20 }}>
        <h1 style={{ margin:0 }}>JotForm Dashboard</h1>
        <ManualRefresh onClick={reloadForms} title="Reload forms" />
      </header>

      {/* body */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        <TagFilterBar
          allTags={[...new Set(Object.values(tagMap).flat())]}
          active={activeTags}
          setActive={setActiveTags}
        />
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
          {/* list */}
          <div style={{ width:'35%', borderRight:'1px solid #ddd', padding:16, overflowY:'auto' }}>
            {selectedForm ? (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                  <h2 style={{ margin:0 }}>{selectedForm.title}</h2>
                  <a href={`https://www.jotform.com/build/${selectedForm.id}`} target="_blank" rel="noreferrer">Open ↗</a>
                </div>
                <input
                  style={{ width:'100%', padding:4, margin:'12px 0', border:'1px solid #ccc', borderRadius:4 }}
                  placeholder="Search submissions…"
                  value={searchSubs}
                  onChange={e => setSearchSubs(e.target.value)}
                />
                <SubList subs={filteredSubs} selected={selSub} onSelect={setSelSub} />
              </>
            ) : <p>Select a form.</p>}
          </div>

          {/* detail */}
          <div style={{ flex:1, padding:16, overflowY:'auto' }}>
            {selSub
              ? <AnswerTable answers={selSub.answers} subId={selSub.id} />
              : <p>{selectedForm ? 'Select a submission.' : '—'}</p>}
          </div>
        </div>
        {tagDialog && (
          <FormTagPicker
            open
            tags={tagMap[tagDialog.id] || []}
            setTags={t => setTagMap(tagDialog.id, t)}
            onClose={() => setTagDialog(null)}
          />
        )}
      </div>
    </div>
  );
}
