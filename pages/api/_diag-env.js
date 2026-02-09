// pages/api/_diag-env.js
import { requireSession } from "../../lib/requireSession";

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  res.status(200).json({
    nextauthUrl: process.env.NEXTAUTH_URL || null,
    hasNextauthSecret: !!process.env.NEXTAUTH_SECRET,
    jotformApi: process.env.JOTFORM_API || "https://api.jotform.com",
    hasJotformKey: !!process.env.JOTFORM_API_KEY,
    jotformKeyLen: (process.env.JOTFORM_API_KEY || "").length,
  });
}
