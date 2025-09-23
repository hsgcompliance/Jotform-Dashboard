// pages/api/card-tracker.js
// Returns flattened line-items for a credit-card form
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

    // Flatten each submission into 0–5 line items
    const items = [];
    for (const sub of all) {
      const rows = normalizeSubmission(sub);
      items.push(...rows);
    }

    res.status(200).json({ items });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
