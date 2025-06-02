function pickName(answers = {}) {
  const fields = Object.values(answers);

  for (const field of fields) {
    const a = field?.answer;
    if (!a) continue;

    if (typeof a === 'string' && a.length > 3 && !a.startsWith('{')) {
      return a;
    }

    if (typeof a === 'object' && a.name) {
      return a.name;
    }
  }

  return 'Untitled submission';
}

function formatDate(ts) {
  const date = new Date(ts * 1000);
  return date.toLocaleString();
}

export default function SubList({ subs, selected, onSelect }) {
  return (
    <ul style={{
      listStyle: 'none',
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      alignItems: 'center'
    }}>
      {subs.map(sub => {
        const label = pickName(sub.answers);
        const time = formatDate(sub.created_at || sub.createdAt || sub.created || sub.timestamp);
        const formTitle = sub.form_title || sub.formTitle || ''; // fallback
        return (
          <li key={sub.id} style={{ width: '100%' }}>
            <button
              onClick={() => onSelect(sub)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: selected?.id === sub.id ? '#0070f3' : '#f3f3f3',
                color: selected?.id === sub.id ? '#fff' : '#000',
                border: 'none',
                padding: '6px 8px',
                borderRadius: 6,
                fontSize: 13,
                wordBreak: 'break-word',
              }}
            >
              <div><strong>{label}</strong></div>
              {formTitle && <div style={{ fontSize: 11 }}>{formTitle} — {time}</div>}
              {!formTitle && <div style={{ fontSize: 11 }}>{time}</div>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
