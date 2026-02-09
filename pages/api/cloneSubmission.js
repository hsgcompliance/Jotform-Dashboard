// pages/api/cloneSubmission.js
import axios from "axios";
import { JOTFORM_API, JOTFORM_WEB, JOTFORM_API_KEY } from "../../lib/jotformEnv";

function append(params, parts, value) {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.forEach((v, i) => append(params, [...parts, String(i)], v));
    return;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([k, v]) => append(params, [...parts, k], v));
    return;
  }

  const key = parts.reduce((acc, p, idx) => (idx === 0 ? p : `${acc}[${p}]`), "");
  params.append(key, String(value));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!JOTFORM_API_KEY) return res.status(500).json({ error: "Missing JOTFORM_API_KEY" });

  try {
    const { formId, submissionId } = req.body || {};
    if (!formId || !submissionId) {
      return res.status(400).json({ error: "Missing formId or submissionId" });
    }

    // 1) Preflight: form properties (disabled?)
    const props = await axios.get(`${JOTFORM_API}/form/${formId}/properties`, {
      params: { apiKey: JOTFORM_API_KEY },
    });

    const disabled = props?.data?.content?.disabled; // Enabled | Disabled :contentReference[oaicite:4]{index=4}
    if (String(disabled).toLowerCase() === "disabled") {
      return res.status(409).json({ error: "Form is disabled", detail: { disabled } });
    }

    // 2) Fetch source submission (single record)
    const source = await axios.get(`${JOTFORM_API}/submission/${submissionId}`, {
      params: { apiKey: JOTFORM_API_KEY },
    });

    const answers = source?.data?.content?.answers || {};
    const body = new URLSearchParams();

    // 3) Build submission[qid]... payload
    for (const [qid, a] of Object.entries(answers)) {
      const val = a?.answer;

      if (val === "" || val === null || val === undefined) continue;
      if (Array.isArray(val) && val.length === 0) continue;

      // Skip file uploads by default (URLs don’t reliably “re-upload” via API)
      if (a?.type === "control_fileupload") continue;

      append(body, ["submission", qid], val);
    }

    // 4) Create new submission
    const created = await axios.post(`${JOTFORM_API}/form/${formId}/submissions`, body.toString(), {
      params: { apiKey: JOTFORM_API_KEY },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const c = created?.data?.content || {};
    const newId = c?.submissionID || c?.id || c?.submissionId;
    if (!newId) return res.status(502).json({ error: "No new submission id returned", detail: created?.data });

    // 5) Return edit link (your “save link”), on the correct WEB host
    const editUrl = `${JOTFORM_WEB}/edit/${newId}`; // format confirmed :contentReference[oaicite:5]{index=5}
    return res.status(200).json({ newSubmissionId: newId, editUrl });
  } catch (err) {
    const detail = err?.response?.data || err?.message || String(err);
    console.error("cloneSubmission error:", detail);
    return res.status(500).json({ error: "Clone submission failed", detail });
  }
}
