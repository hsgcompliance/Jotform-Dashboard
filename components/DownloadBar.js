export default function DownloadBar({ formId, sub, extraDocs = {} }) {
  if (!formId || !sub) return null;
  const sid = sub.id;

  const open = href => window.open(href, '_blank', 'noopener,noreferrer');

  const buttons = [
    { label: 'Download PDF', href: `/api/pdf?formId=${formId}&submissionId=${sid}` },
    { label: 'Open Submission', href: `https://www.jotform.com/submission/${sid}` },
    { label: 'Edit Submission', href: `https://www.jotform.com/edit/${sid}` },
    { label: 'Open Inbox/Tables', href: `https://www.jotform.com/submissions/${formId}` },
  ];

  const extra = Object.entries(extraDocs).map(([label, docId]) => ({
    label: `PDF: ${label}`, href: `/api/pdf?formId=${formId}&submissionId=${sid}&docId=${docId}`
  }));

  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>
      {buttons.concat(extra).map(b => (
        <button key={b.label} onClick={() => open(b.href)}>{b.label}</button>
      ))}
    </div>
  );
}
