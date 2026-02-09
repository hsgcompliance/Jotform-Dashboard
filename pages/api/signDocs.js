// pages/api/signDocs.js
//given a Sign form ID, returns its signed‐document metadata// jot form does not allow sign docs integration, this script does not work, but it is a placeholder for when/if they do allow it. It is based on the same pattern as the pdf.js api route, but points to the (undocumented) sign docs endpoint instead of the pdf endpoints.
import axios from 'axios';
import { requireSession } from "../../lib/requireSession";

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  const apiKey = process.env.JOTFORM_API_KEY;
  if (req.method !== 'GET') return res.status(405).end();

  const { formId } = req.query;
  if (!formId) return res.status(400).json({ error: 'formId required' });

  try {
    // Fetch the latest signed documents for this Sign workflow
    const { data } = await axios.get(
      `https://api.jotform.com/sign/${formId}/documents?apiKey=${apiKey}`
    );
    // data.content is an array of docs: { id, created_at, download_url, signers: [...] }
    res.status(200).json(data.content || []);
  } catch (err) {
    console.error('Error fetching sign docs for', formId, err.response?.data || err.message);
    res.status(500).json({ error: 'Could not fetch sign documents' });
  }
}
