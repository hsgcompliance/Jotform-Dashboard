// components/SubList.js

function pickName(answers = {}) {
  const fields = Object.values(answers);

  for (const field of fields) {
    const a = field?.answer;
    if (!a) continue;

    // If it’s a string (e.g. short‐text, email, etc.), return it directly
    if (typeof a === 'string') {
      return a;
    }

    // If it’s an object with a `.name` property (e.g. Full Name widget), return that
    if (typeof a === 'object' && a.name) {
      return a.name;
    }
  }

  console.warn('pickName: could not derive name', answers);
  return 'Untitled submission';
}

function formatDate(ts) {
  // JotForm’s created_at is usually an ISO string, not a UNIX timestamp.
  // If it’s numeric, parse it; otherwise, let Date handle the ISO string.
  const date = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  return date.toLocaleString();
}

export default function SubList({ subs, selected, onSelect }) {
  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        alignItems: 'center'
      }}
    >
      {subs.map(sub => {
        const label     = pickName(sub.answers);
        const time      = formatDate(sub.created_at || sub.timestamp);
        const formTitle = sub.form_title || sub.formTitle || '';
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
                wordBreak: 'break-word'
              }}
            >
              {/* Show a “SIGNED” prefix if this came from a JotForm Sign workflow */}
              {sub.isSign && (
                <span style={{ fontSize: 11, fontWeight: 500, color: '#900' }}>
                  (SIGNED){' '}
                </span>
              )}

              {/* Submission ID */}
              <span style={{ fontSize: 12, opacity: 0.8 }}>{sub.id}</span>

              {/* Submission name (e.g. “John Doe” or first short answer) */}
              <div>
                <strong>{label}</strong>
              </div>

              {/* Form title + timestamp in small text */}
              {formTitle ? (
                <div style={{ fontSize: 11 }}>
                  {formTitle} — {time}
                </div>
              ) : (
                <div style={{ fontSize: 11 }}>{time}</div>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
