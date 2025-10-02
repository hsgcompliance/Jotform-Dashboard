// pages/api/purchases.js
import { normalizeSubmission } from "../../components/jotformMap";

export const config = { api: { bodyParser: false } };

const API = "https://api.jotform.com";
const KEY = process.env.JOTFORM_API_KEY;

const FORM_CARDS   = "251878265158166"; // Credit Cards
const FORM_INVOICE = "252674777246167"; // Invoice

async function fetchSubsAll(formId, pageLimit = 500) {
  if (!KEY) throw new Error("Missing JOTFORM_API_KEY");
  let offset = 0;
  const all = [];

  while (true) {
    const url = new URL(`${API}/form/${formId}/submissions`);
    url.searchParams.set("apiKey", KEY);              // <-- use query param
    url.searchParams.set("limit", String(pageLimit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("orderby", "created_at");
    url.searchParams.set("answers", "yes");

    const res = await fetch(url.toString(), { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) {
      // bubble up real JT error so you can see it in the browser/script
      throw new Error(`Jotform ${formId} ${res.status} ${res.statusText} — ${text.slice(0, 500)}`);
    }
    const json = JSON.parse(text);
    const chunk = json?.content || [];
    all.push(...chunk);
    if (chunk.length < pageLimit) break;
    offset += pageLimit;
  }
  return all;
}

export default async function handler(req, res) {
  try {
    if (!KEY) return res.status(500).json({ error: "Missing JOTFORM_API_KEY" });

    const [cardsRaw, invoicesRaw] = await Promise.all([
      fetchSubsAll(FORM_CARDS),
      fetchSubsAll(FORM_INVOICE),
    ]);

    const items = []
      .concat(...cardsRaw.map(normalizeSubmission))
      .concat(...invoicesRaw.map(normalizeSubmission))
      .map((r) => {
        let type = "Invoice";
        if (String(r.source).toLowerCase().includes("credit")) {
          const s = (r.card || r.cardBucket || "").toLowerCase();
          type = s.includes("youth") ? "Youth Card" : "Housing Card";
        }
        return { ...r, type };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}
