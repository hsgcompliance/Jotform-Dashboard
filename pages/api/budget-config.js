//pages/api/budget-config.js
import { put, list, del } from "@vercel/blob";

const BLOB_KEY = process.env.BLOB_READ_WRITE_TOKEN; // set this in Vercel
const NAME = "budgets-v2.json";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

export default async function handler(req, res) {
  if (!BLOB_KEY) return res.status(500).json({ error: "Missing BLOB_READ_WRITE_TOKEN" });

  try {
    if (req.method === "GET") {
      // naive: grab most recent version if exists
      const files = await list({ token: BLOB_KEY, prefix: NAME });
      const latest = files.blobs?.sort((a,b)=> new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
      if (!latest) return res.status(200).json({ ok: true, config: null });
      const txt = await fetch(latest.url).then(r=>r.text());
      return res.status(200).json({ ok: true, config: JSON.parse(txt), url: latest.url });
    }

    if (req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const json = JSON.stringify(body, null, 2);
      const { url } = await put(NAME, json, { access: "private", token: BLOB_KEY, addRandomSuffix: false });
      return res.status(200).json({ ok: true, url });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
