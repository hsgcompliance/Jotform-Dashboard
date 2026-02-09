import fetch from "node-fetch";
import { requireSession } from "../../lib/requireSession";

// Securely proxy any uploaded-file URL (keeps API key off the client)
export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url' });

    const apiKey = process.env.JOTFORM_API_KEY || '';
    const needsKey = apiKey && !/(\?|&)apiKey=/.test(url);
    const proxied = needsKey ? `${url}${url.includes('?') ? '&' : '?'}apiKey=${apiKey}` : url;

    const r = await fetch(proxied);
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).send(text);
    }
    const ct = r.headers.get('content-type') || 'application/octet-stream';
    const cd = r.headers.get('content-disposition') || 'attachment';
    res.setHeader('Content-Type', ct);
    res.setHeader('Content-Disposition', cd);
    const buf = Buffer.from(await r.arrayBuffer());
    return res.status(200).send(buf);
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
