// Proxy to fetch a submission PDF (supports EU/HIPAA via env)
import { requireSession } from "../../lib/requireSession";

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const { formId, submissionId, docId } = req.query;
    if (!formId || !submissionId) {
      return res.status(400).json({ error: 'formId and submissionId required' });
    }

    const apiKey  = process.env.JOTFORM_API_KEY || '';
    const WEB     = process.env.JOTFORM_WEB  || 'https://www.jotform.com';   // e.g. https://eu.jotform.com
    const API     = process.env.JOTFORM_API  || 'https://api.jotform.com';   // e.g. https://eu-api.jotform.com

    // Try (undocumented) docId route first if provided, then fall back to the supported links.
    const candidates = [
      docId ? `${API}/pdf-converter/${formId}/fill-pdf?download=1&submissionID=${submissionId}&documentId=${docId}` : null,
      `${WEB}/pdf-submission/${submissionId}`,
      `${WEB}/server.php?action=getSubmissionPDF&sid=${submissionId}&formID=${formId}`
    ].filter(Boolean);

    for (const url of candidates) {
      const r = await fetch(url, {
        headers: apiKey ? { APIKEY: apiKey } : undefined,
      });
      const ct = r.headers.get('content-type') || '';
      if (r.ok && ct.includes('pdf')) {
        const buf = Buffer.from(await r.arrayBuffer());
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=submission-${submissionId}.pdf`);
        return res.status(200).send(buf);
      }
    }
    return res.status(502).json({ error: 'Unable to fetch PDF for this submission.' });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
