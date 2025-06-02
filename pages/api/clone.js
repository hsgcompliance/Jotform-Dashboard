import axios from 'axios';

const TEMPLATE_ID = process.env.TEMPLATE_ID || '251408496435058';
const API_KEY     = process.env.JOTFORM_API_KEY;
const jot = path => `https://api.jotform.com${path}?apiKey=${API_KEY}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { data } = await axios.post(jot(`/form/${TEMPLATE_ID}/clone`));
    const newId = data?.content?.id;
    if (!newId) throw new Error('Clone succeeded but no ID returned');
    /* no rename – just return the new form */
    res.json({ id: newId });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error('Clone error', detail);
    res.status(500).json({ error: 'Clone failed', detail });
  }
}
