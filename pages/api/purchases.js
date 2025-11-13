// pages/api/purchases.js
import { normalizeSubmission } from "../../components/jotformMap";

export const config = { api: { bodyParser: false } };

const API = "https://api.jotform.com";
const KEY = process.env.JOTFORM_API_KEY;

const FORM_CARDS = "251878265158166";
const FORM_INVOICE = "252674777246167";

async function fetchSubsAll(formId, pageLimit = 500, statusFilter = "ACTIVE") {
  if (!KEY) throw new Error("Missing JOTFORM_API_KEY");
  let offset = 0;
  const all = [];

  while (true) {
    const url = new URL(`${API}/form/${formId}/submissions`);
    url.searchParams.set("apiKey", KEY);
    url.searchParams.set("limit", String(pageLimit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("orderby", "created_at");
    url.searchParams.set("answers", "yes");

    if (statusFilter === "ACTIVE") {
      // Ask Jotform to only return ACTIVE, but still post-filter in case
      url.searchParams.set("filter", JSON.stringify({ status: "ACTIVE" }));
    }

    const res = await fetch(url.toString(), { cache: "no-store" });
    const text = await res.text();

    if (!res.ok) {
      throw new Error(
        `Jotform ${formId} ${res.status} ${res.statusText} — ${text.slice(
          0,
          500
        )}`
      );
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(
        `Jotform ${formId} returned non-JSON response: ${e?.message || e}`
      );
    }

    const content = Array.isArray(json?.content) ? json.content : [];
    const chunk =
      statusFilter === "ACTIVE"
        ? content.filter((s) => {
            const st = String(s?.status || "").toUpperCase();
            return st === "" || st === "ACTIVE";
          })
        : content;

    all.push(...chunk);

    if (chunk.length < pageLimit) break;
    offset += pageLimit;
  }

  return all;
}

export default async function handler(req, res) {
  try {
    if (!KEY) {
      return res.status(500).json({ error: "Missing JOTFORM_API_KEY" });
    }

    const { status, form, from, to } = req.query || {};

    const statusFilter =
      String(status || "").toUpperCase() === "ALL" ? "ALL" : "ACTIVE";

    const wantCards =
      !form || String(form).toLowerCase() === "cards" || String(form).toLowerCase() === "both";
    const wantInvoices =
      !form || String(form).toLowerCase() === "invoice" || String(form).toLowerCase() === "both";

    const [cardsRaw, invoicesRaw] = await Promise.all([
      wantCards ? fetchSubsAll(FORM_CARDS, 500, statusFilter) : Promise.resolve([]),
      wantInvoices ? fetchSubsAll(FORM_INVOICE, 500, statusFilter) : Promise.resolve([]),
    ]);

    const allItems = []
      .concat(...cardsRaw.map(normalizeSubmission))
      .concat(...invoicesRaw.map(normalizeSubmission));

    // Optional server-side status guard (in case older blobs slipped through)
    let filtered = allItems.filter((r) => {
      const st = String(r?.raw?.status || r?.rawStatus || "").toUpperCase();
      if (statusFilter === "ALL") return true;
      return st === "" || st === "ACTIVE";
    });

    // Optional date window (createdAt) if query supplies from/to
    if (from || to) {
      const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null;
      const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null;
      filtered = filtered.filter((r) => {
        const t = new Date(r.createdAt).getTime();
        if (Number.isNaN(t)) return false;
        if (fromTs != null && t < fromTs) return false;
        if (toTs != null && t > toTs) return false;
        return true;
      });
    }

    const items = filtered
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
