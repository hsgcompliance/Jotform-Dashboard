// pages/api/line-items-store.js
import { put, list } from "@vercel/blob";
import { requireSession } from "../../lib/requireSession";

const BLOB_KEY = process.env.BLOB_READ_WRITE_TOKEN; // Vercel env var
const NAME = "line-items-store-v1.json";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

async function readLatest() {
  const blobsResp = await list({ token: BLOB_KEY, prefix: NAME });
  const blobs = Array.isArray(blobsResp?.blobs) ? blobsResp.blobs : [];
  if (!blobs.length) return null;

  const latest = blobs.slice().sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
  const r = await fetch(latest.url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Blob fetch failed ${r.status} ${r.statusText}`);
  const txt = await r.text();
  try {
    return JSON.parse(txt);
  } catch (e) {
    return { __invalid__: true, rawPreview: txt.slice(0, 2000), error: String(e?.message || e) };
  }
}

function sanitizeStore(input) {
  const base = { version: 1, updatedAt: new Date().toISOString(), invoiced: {}, archive: {} };
  if (!input || typeof input !== "object") return base;

  const invoiced = typeof input.invoiced === "object" && input.invoiced ? input.invoiced : {};
  const archive  = typeof input.archive  === "object" && input.archive  ? input.archive  : {};
  return {
    version: Number.isFinite(input.version) ? input.version : 1,
    updatedAt: new Date().toISOString(),
    invoiced,
    archive,
  };
}

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  const inDev = process.env.NODE_ENV !== "production";

  if (!BLOB_KEY) {
    if (req.method === "GET" && inDev) {
      return res.status(200).json({
        ok: true,
        store: { version: 1, updatedAt: new Date().toISOString(), invoiced: {}, archive: {} },
        warning: "BLOB_READ_WRITE_TOKEN missing (dev fallback returning empty store)"
      });
    }
    return res.status(500).json({ ok: false, error: "Missing BLOB_READ_WRITE_TOKEN" });
  }

  try {
    if (req.method === "GET") {
      try {
        const latest = await readLatest();
        if (!latest || latest.__invalid__) {
          return res.status(200).json({ ok: true, store: { version:1, updatedAt:new Date().toISOString(), invoiced:{}, archive:{} } });
        }
        return res.status(200).json({ ok: true, store: sanitizeStore(latest) });
      } catch (e) {
        return res.status(500).json({ ok: false, error: `readLatest failed: ${e?.message || e}` });
      }
    }

    if (req.method === "PUT") {
      let body;
      try {
        body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      } catch (e) {
        return res.status(400).json({ ok: false, error: `Bad JSON: ${e?.message || e}` });
      }

      const store = sanitizeStore(body);
      try {
        const { url } = await put(NAME, JSON.stringify(store, null, 2), {
          access: "public",
          token: BLOB_KEY,
          addRandomSuffix: false,
          contentType: "application/json",
        });
        return res.status(200).json({ ok: true, url });
      } catch (e) {
        return res.status(500).json({ ok: false, error: `Blob put() failed: ${e?.message || e}` });
      }
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: `Unhandled: ${e?.message || e}` });
  }
}

