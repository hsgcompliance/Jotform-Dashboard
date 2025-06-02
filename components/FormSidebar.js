export default function FormSidebar({ forms, selected, onSelect, search, setSearch }) {
  return (
    <div style={{ width: '26%', minWidth: 250, borderRight: '1px solid #ddd', padding: 16, overflowY: 'auto' }}>
      <input
        style={{ width: '100%', padding: 6, marginBottom: 12 }}
        placeholder="Search forms…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {forms.map(f => (
          <li key={f.id} style={{ marginBottom: 8 }}>
            <button
              onClick={() => onSelect(f)}
              style={{
                width: '100%', textAlign: 'left',
                background: selected?.id === f.id ? '#0070f3' : '#f5f5f5',
                color: selected?.id === f.id ? '#fff' : '#000',
                border: 'none', padding: '8px 10px', borderRadius: 6
              }}
            >
              {f.title}
              <span style={{ float: 'right', fontSize: 11, opacity: .7 }}>
                {f.count} • {f.lastSubmission?.slice(0,10) || '—'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
