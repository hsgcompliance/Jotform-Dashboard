// pages/api/signForms.js
import axios from "axios";
import { requireSession } from "../../lib/requireSession";

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  const apiKey = process.env.JOTFORM_API_KEY;
  const API = process.env.JOTFORM_API || "https://api.jotform.com";

  if (!apiKey) return res.status(500).json({ error: "Missing JOTFORM_API_KEY" });

  try {
    const { data } = await axios.get(`${API}/user/signforms`, {
      params: { apiKey },
    });
    return res.status(200).json({ content: data?.content || [] });
  } catch (err) {
    const status = err?.response?.status || 500;
    const detail = err?.response?.data || err?.message || String(err);

    // ✅ If Sign API isn’t available, just return empty.
    if (status === 401) {
      console.warn("Sign forms not authorized; returning empty list.");
      return res.status(200).json({ content: [], warning: "Sign forms not authorized", detail });
    }

    console.error("GET /user/signforms failed:", { status, detail });
    return res.status(status).json({ error: "Failed to fetch sign forms", detail });
  }
}
