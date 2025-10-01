// pages/api/purchases.js
import axios from "axios";
import { normalizeSubmission, normalizeInvoice } from "../../components/jotformMap";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const apiKey = process.env.JOTFORM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing JOTFORM_API_KEY" });
  }

  const cardFormId = "251878265158166";   // Credit Card
  const invoiceFormId = "252674777246167"; // Invoice Request (non-CC)

  async function fetchAll(formId) {
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
    // de-dupe by id
    const uniq = Array.from(new Map(all.map(s => [s.id, s])).values());
    // sort ascending by created_at (stable)
    uniq.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return uniq;
  }

  try {
    const [cardSubs, invSubs] = await Promise.all([
      fetchAll(cardFormId),
      fetchAll(invoiceFormId),
    ]);

    // normalize → line items
    const cardItems = cardSubs.flatMap(normalizeSubmission);
    const invoiceItems = invSubs.flatMap(normalizeInvoice);

    // combine
    const items = [...cardItems, ...invoiceItems];

    res.status(200).json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err?.message || err) });
  }
}
