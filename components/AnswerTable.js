import PDFButton from './PDFButton';

/* ---------- helper to render one cell ---------- */
const renderCell = ans => {
  if (!ans) return '—';

  /* 1️⃣  plain string (may be a URL) */
  if (typeof ans === 'string') {
    return /^https?:\/\//.test(ans)
      ? (
        <a href={ans} target="_blank" rel="noreferrer">
          {ans.split('/').pop().slice(0, 40)}
        </a>
      )
      : ans;
  }

  /* 2️⃣  array (empty, URLs, or plain text) */
  if (Array.isArray(ans)) {
    if (ans.length === 0) return '—';

    return ans.map((item, idx) => {
      const tail = idx < ans.length - 1 ? ', ' : '';

      if (typeof item === 'string' && /^https?:\/\//.test(item)) {
        return (
          <span key={idx}>
            <a href={item} target="_blank" rel="noreferrer">
              {item.split('/').pop().slice(0, 40)}
            </a>{tail}
          </span>
        );
      }
      return <span key={idx}>{String(item)}{tail}</span>;
    });
  }

  /* 3️⃣  matrix / object answers */
  if (typeof ans === 'object') {
    return (
      <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
        <tbody>
          {Object.entries(ans).map(([k, v]) => (
            <tr key={k}>
              <td style={{ border: '1px solid #ccc', padding: 2 }}>{k}</td>
              <td style={{ border: '1px solid #ccc', padding: 2 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  /* 4️⃣  fallback for numbers / booleans */
  return String(ans);
};

/* ---------- main table component ---------- */
export default function AnswerTable({ answers = {}, subId = '' }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>Question</th>
          <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>Answer</th>
        </tr>
      </thead>
      <tbody>
        {Object.values(answers).map((a, idx) => {
          const pdfUrl = a?.pdf?.download_url || a?.answer?.download_url;
          return (
            <tr key={idx}>
              <td style={{ padding: 6, verticalAlign: 'top', fontSize: 13 }}>
                {a.text || a.name}
              </td>
              <td style={{ padding: 6, verticalAlign: 'top', fontSize: 13 }}>
                {renderCell(a.answer)}
                {pdfUrl && (
                  <PDFButton url={pdfUrl} name={`${subId || 'file'}-${idx}`} />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
