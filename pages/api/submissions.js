// pages/api/submissions.js
import axios from "axios";
import { requireSession } from "../../lib/requireSession";

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  if (req.method !== "GET") return res.status(405).end();

  const formId = req.query.formId || req.query.id; // keep compat with your current client
  if (!formId) return res.status(400).json({ error: "formId required" });

  const apiKey = process.env.JOTFORM_API_KEY;
  const API = process.env.JOTFORM_API || "https://api.jotform.com";
  if (!apiKey) return res.status(500).json({ error: "Missing JOTFORM_API_KEY" });

  const limit = 100;
  let offset = 0;
  const all = [];

  try {
    while (true) {
      const { data } = await axios.get(`${API}/form/${formId}/submissions`, {
        params: { apiKey, limit, offset },
      });

      const chunk = data?.content ?? [];
      all.push(...chunk);
      if (chunk.length < limit) break;
      offset += limit;
    }

    return res.status(200).json({ content: all });
  } catch (err) {
    const upstreamStatus = err?.response?.status;
    const detail = err?.response?.data || err?.message || String(err);

    // Don’t leak upstream 401 as “your login failed”
    if (upstreamStatus === 401 || upstreamStatus === 403) {
      return res.status(502).json({
        error: "JotForm authorization failed",
        code: "JOTFORM_AUTH",
        detail,
      });
    }
    if (upstreamStatus === 429) {
      return res.status(429).json({
        error: "JotForm rate limit",
        code: "JOTFORM_RATE_LIMIT",
        detail,
      });
    }

    console.error("GET /form/:id/submissions failed:", { formId, API, upstreamStatus, detail });
    return res.status(500).json({ error: "Failed to fetch submissions", detail });
  }
}
