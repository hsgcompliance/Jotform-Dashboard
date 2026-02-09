// pages/api/forms.js
import axios from "axios";

export default async function handler(req, res) {
  const apiKey = process.env.JOTFORM_API_KEY;
  const API = process.env.JOTFORM_API || "https://api.jotform.com";

  if (!apiKey) {
    return res.status(500).json({ error: "Missing JOTFORM_API_KEY" });
  }

  const limit = 100;
  let offset = 0;
  let forms = [];

  try {
    while (true) {
      const { data } = await axios.get(`${API}/user/forms`, {
        params: { apiKey, limit, offset },
      });

      const chunk = data?.content ?? [];
      forms.push(...chunk);

      if (chunk.length < limit) break;
      offset += limit;
    }

    const withSubs = forms.filter(f => Number(f.submissionsCount ?? f.count ?? 0) > 0);

    const slim = withSubs.map(f => ({
      id: f.id,
      title: f.title,
      count: Number(f.submissionsCount ?? f.count ?? 0),
      lastSubmission: f.last_submission || "",
      url: f.url || "",
    }));

    return res.status(200).json({ content: slim });
  } catch (err) {
    const status = err?.response?.status || 500;
    const detail = err?.response?.data || err?.message || String(err);
    console.error("GET /user/forms failed:", { status, detail, API });
    return res.status(status).json({ error: "Failed to fetch forms", detail });
  }
}
