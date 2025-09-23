// pages/api/card-tracker.js
// Pulls submissions for a given form id and returns normalized rows
import axios from "axios";
import { normalizeSubmission } from "../../components/jotformMap";

export default async function handler(req, res) {
  try {
    const formId = String(req.query.id ?? "251878265158166");
    const apiKey = process.env.JOTFORM_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing JOTFORM_API_KEY" });

    const limit = 1000;
    let offset = 0;
    const all = [];

    // paginate identical to /api/submissions
    /* eslint-disable no-constant-condition */
    while (true) {
      const { data } = await axios.get(
        `https://api.jotform.com/form/${formId}/submissions`,
        { params: { apiKey, limit, offset, answers: "yes" } }
      );
      const chunk = data?.content ?? [];
      all.push(...chunk);
      if (chunk.length < limit) break;
      offset += limit;
    }

    const normalized = all.map(normalizeSubmission);
    res.status(200).json({ submissions: normalized });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
