// pages/api/submission.js
import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  // accept either ?id= or ?submissionId=
  const submissionId = req.query.submissionId || req.query.id;
  if (!submissionId) return res.status(400).json({ error: "submissionId (or id) required" });

  const apiKey = process.env.JOTFORM_API_KEY;
  const API = process.env.JOTFORM_API || "https://api.jotform.com";

  if (!apiKey) return res.status(500).json({ error: "Missing JOTFORM_API_KEY" });

  try {
    const { data } = await axios.get(`${API}/submission/${submissionId}`, {
      params: { apiKey },
    });
    return res.status(200).json({ content: data?.content || null });
  } catch (err) {
    const status = err?.response?.status || 500;
    const detail = err?.response?.data || err?.message || String(err);
    console.error("GET /submission failed:", { submissionId, API, status, detail });
    return res.status(status).json({ error: "Failed to fetch submission", detail });
  }
}
