// pages/api/budget-config.js
import { put, list } from "@vercel/blob";

const BLOB_KEY = process.env.BLOB_READ_WRITE_TOKEN; // set in Vercel Project Settings → Environment Variables
const NAME = "budgets-v2.json";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

export default async function handler(req, res) {
  // Helpful note for local dev
  const inDev = process.env.NODE_ENV !== "production";

  // If missing token, allow GET to pass through with null (so Budgets UI can still open),
  // but keep PUT protected to avoid accidental writes without a token.
  if (!BLOB_KEY) {
    if (req.method === "GET" && inDev) {
      return res
        .status(200)
        .json({ ok: true, config: null, warning: "BLOB_READ_WRITE_TOKEN missing (dev fallback returning null)" });
    }
    return res.status(500).json({ ok: false, error: "Missing BLOB_READ_WRITE_TOKEN" });
  }

  try {
    if (req.method === "GET") {
      // Find latest budgets-v2.json (there will usually be exactly one because we disable random suffix)
      let blobsResp;
      try {
        blobsResp = await list({ token: BLOB_KEY, prefix: NAME });
      } catch (e) {
        return res.status(500).json({ ok: false, error: `Blob list() failed: ${e?.message || e}` });
      }

      const blobs = Array.isArray(blobsResp?.blobs) ? blobsResp.blobs : [];
      if (blobs.length === 0) {
        // First run, nothing saved yet
        return res.status(200).json({ ok: true, config: null });
      }

      // If there are multiple versions, take most recent by uploadedAt
      const latest = blobs
        .slice()
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];

      // Read the JSON (use no-store; private blobs returned here are signed-read URLs)
      const r = await fetch(latest.url, { cache: "no-store" });
      if (!r.ok) {
        return res
          .status(500)
          .json({ ok: false, error: `Blob fetch failed with status ${r.status} ${r.statusText}` });
      }

      const txt = await r.text();
      try {
        const parsed = JSON.parse(txt);
        return res.status(200).json({ ok: true, config: parsed, url: latest.url });
      } catch (e) {
        // Don’t crash the UI if the blob contains bad JSON; surface a clear error instead
        return res.status(200).json({
          ok: false,
          error: `Invalid JSON in ${NAME}: ${e?.message || e}`,
          rawPreview: txt.slice(0, 2000), // short preview to help debug
        });
      }
    }

    if (req.method === "PUT") {
      let body;
      try {
        body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      } catch (e) {
        return res.status(400).json({ ok: false, error: `Bad JSON in request body: ${e?.message || e}` });
      }

      // Optional: light shape check
      if (body && typeof body !== "object") {
        return res.status(400).json({ ok: false, error: "Body must be a JSON object" });
      }

      const json = JSON.stringify(body ?? {}, null, 2);

      try {
        const { url } = await put(NAME, json, {
          access: "public",
          token: BLOB_KEY,
          addRandomSuffix: false,           // overwrite single logical file
          contentType: "application/json",  // ensure correct type for readers/tools
        });
        return res.status(200).json({ ok: true, url });
      } catch (e) {
        return res.status(500).json({ ok: false, error: `Blob put() failed: ${e?.message || e}` });
      }
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    // Final safety net: return a clear message
    return res.status(500).json({ ok: false, error: `Unhandled: ${e?.message || e}` });
  }
}
