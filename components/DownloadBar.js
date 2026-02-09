// components/DownloadBar.js
export default function DownloadBar({ formId, sub, extraDocs = {} }) {
  if (!formId || !sub) return null;
  const sid = sub.id;

  const open = href => window.open(href, "_blank", "noopener,noreferrer");

 const cloneAndOpen = async () => {
   try {
     const r = await fetch("/api/cloneSubmission", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ formId, submissionId: sid }),
     });
     const data = await r.json();
     if (!r.ok) throw new Error(data?.error || "Clone failed");
     open(data.editUrl);
     if (navigator.clipboard) await navigator.clipboard.writeText(data.editUrl);
   } catch (e) {
     console.error(e);
     alert(`Clone failed: ${e.message || e}`);
   }
  };

  const buttons = [
    { label: "Download PDF", href: `/api/pdf?formId=${formId}&submissionId=${sid}` },
    { label: "Open in Inbox", href: `https://www.jotform.com/inbox/${formId}/${sid}` },
    { label: "Open Inbox (All)", href: `https://www.jotform.com/inbox/${formId}` },
    { label: "Open Tables", href: `https://www.jotform.com/tables/${formId}` },
    { label: "Open Form", href: `https://www.jotform.com/form/${formId}` },
    ...(sub.isSign ? [] : [{ label: "Edit a Clone", onClick: cloneAndOpen }]),
  ];

  const extra = Object.entries(extraDocs).map(([label, docId]) => ({
    label: `PDF: ${label}`,
    href: `/api/pdf?formId=${formId}&submissionId=${sid}&docId=${docId}`,
  }));

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
      {buttons.concat(extra).map(b => (
        <button
          key={b.label}
          onClick={() => (b.onClick ? b.onClick() : open(b.href))}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
