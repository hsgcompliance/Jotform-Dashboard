import PDFButton from './PDFButton';

/* helper to render one answer */
const renderCell = ans => {
  if (!ans) return '—';

  /* matrix / object answers */
  if (typeof ans === 'object' && !Array.isArray(ans)) {
    /* e.g., { Row1: "Yes", Row2: "No" } */
    return (
      <table style={{ borderCollapse:'collapse', fontSize:12 }}>
        <tbody>
          {Object.entries(ans).map(([k, v]) => (
            <tr key={k}>
              <td style={{ border:'1px solid #ccc', padding:2 }}>{k}</td>
              <td style={{ border:'1px solid #ccc', padding:2 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  /* plain string – may be URL */
  if (typeof ans === 'string') {
    const isURL = /^https?:\/\//.test(ans);
    return isURL ? (
      <a href={ans} target="_blank" rel="noreferrer">
        {ans.split('/').pop().slice(0, 40)}
      </a>
    ) : ans;
  }
  return Array.isArray(ans) ? ans.join(', ') : String(ans);
};

/* main table component */
export default function AnswerTable({ answers = {}, subId='' }) {
  return (
    <table style={{ width:'100%', borderCollapse:'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign:'left', borderBottom:'1px solid #ccc', padding:6 }}>Question</th>
          <th style={{ textAlign:'left', borderBottom:'1px solid #ccc', padding:6 }}>Answer</th>
        </tr>
      </thead>
      <tbody>
        {Object.values(answers).map((a, idx) => {
          /* look for generated-PDF URL */
          const pdfUrl = a?.pdf?.download_url || a?.answer?.download_url;
          return (
            <tr key={idx}>
              <td style={{ padding:6, verticalAlign:'top', fontSize:13 }}>
                {a.text || a.name}
              </td>
              <td style={{ padding:6, verticalAlign:'top', fontSize:13 }}>
                {renderCell(a.answer)}
                {/* download PDF if available */}
                {pdfUrl && (
                  <PDFButton
                    url={pdfUrl}
                    name={`${subId || 'file'}-${idx}`}
                  />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
