// components/DownloadBar.js
export default function DownloadBar({ formId, sub, extraDocs = {} }) {
  if (!formId || !sub) return null;
  const sid = sub.id;

  const open = href => window.open(href, '_blank', 'noopener,noreferrer');

  const buttons = [
    // Jotform-generated PDF (via your API proxy)
    { label: 'Download PDF', href: `/api/pdf?formId=${formId}&submissionId=${sid}` },

    // Inbox (single submission view)
    { label: 'Open in Inbox', href: `https://www.jotform.com/inbox/${formId}/${sid}` },

    // Inbox (all submissions for this form)
    { label: 'Open Inbox (All)', href: `https://www.jotform.com/inbox/${formId}` },

    // Tables (all submissions)
    { label: 'Open Tables', href: `https://www.jotform.com/tables/${formId}` },

    // Form (public form URL — not submission edit)
    { label: 'Open Form', href: `https://www.jotform.com/form/${formId}` },
  ];

  const extra = Object.entries(extraDocs).map(([label, docId]) => ({
    label: `PDF: ${label}`,
    href: `/api/pdf?formId=${formId}&submissionId=${sid}&docId=${docId}`,
  }));

  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>
      {buttons.concat(extra).map(b => (
        <button key={b.label} onClick={() => open(b.href)}>{b.label}</button>
      ))}
    </div>
  );
}
