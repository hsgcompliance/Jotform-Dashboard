// pages/api/budget-config.js
import { put, list } from "@vercel/blob";

const BLOB_KEY = process.env.BLOB_READ_WRITE_TOKEN;
const NAME = "budgets-v2.json";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

// Small helper: read latest config blob, or null if none
async function readLatestConfig() {
  const blobsResp = await list({ token: BLOB_KEY, prefix: NAME });
  const blobs = Array.isArray(blobsResp?.blobs) ? blobsResp.blobs : [];
  if (!blobs.length) return null;

  const latest = blobs.reduce((acc, b) =>
    !acc || new Date(b.uploadedAt) > new Date(acc.uploadedAt) ? b : acc
  );

  const r = await fetch(latest.url, { cache: "no-store" });
  if (!r.ok) {
    throw new Error(`Blob fetch failed: ${r.status} ${r.statusText}`);
  }

  const txt = await r.text();
  try {
    return JSON.parse(txt);
  } catch (e) {
    return {
      __invalid__: true,
      rawPreview: txt.slice(0, 2000),
      error: String(e?.message || e),
    };
  }
}

export default async function handler(req, res) {
  const inDev = process.env.NODE_ENV !== "production";

  // Token missing → allow GET in dev with null config, block PUT
  if (!BLOB_KEY) {
    if (req.method === "GET" && inDev) {
      return res.status(200).json({
        ok: true,
        config: null,
        warning: "BLOB_READ_WRITE_TOKEN missing (dev fallback returning null)",
      });
    }
    return res
      .status(500)
      .json({ ok: false, error: "Missing BLOB_READ_WRITE_TOKEN" });
  }

  try {
    if (req.method === "GET") {
      const configFromBlob = await readLatestConfig();

      if (!configFromBlob) {
        // First run – nothing stored yet
        return res.status(200).json({ ok: true, config: null });
      }

      if (configFromBlob.__invalid__) {
        // Don't crash UI on bad JSON; surface a debug preview instead
        return res.status(200).json({
          ok: false,
          error: `Invalid JSON in ${NAME}: ${configFromBlob.error}`,
          rawPreview: configFromBlob.rawPreview,
        });
      }

      return res
        .status(200)
        .json({ ok: true, config: configFromBlob, url: undefined });
    }

    if (req.method === "PUT") {
      let body;
      try {
        body =
          typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
      } catch (e) {
        return res.status(400).json({
          ok: false,
          error: `Bad JSON in request body: ${e?.message || e}`,
        });
      }

      if (body && typeof body !== "object") {
        return res
          .status(400)
          .json({ ok: false, error: "Body must be a JSON object" });
      }

      const json = JSON.stringify(body ?? {}, null, 2);

      try {
        const { url } = await put(NAME, json, {
          access: "public",
          token: BLOB_KEY,
          addRandomSuffix: false,
          contentType: "application/json",
        });
        return res.status(200).json({ ok: true, url });
      } catch (e) {
        return res.status(500).json({
          ok: false,
          error: `Blob put() failed: ${e?.message || e}`,
        });
      }
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: `Unhandled: ${e?.message || e}` });
  }
}
