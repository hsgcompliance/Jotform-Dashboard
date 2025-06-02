import axios from 'axios';

export default async function handler(req, res) {
  const { method, query: { form, url }, body } = req;
  const apiKey = process.env.JOTFORM_API_KEY;

  if (method === 'GET') {
    const { data } = await axios.get(`https://api.jotform.com/form/${form}/webhooks?apiKey=${apiKey}`);
    return res.json(data.content || []);
  }
  if (method === 'POST') {
    await axios.post(`https://api.jotform.com/form/${body.form}/webhooks?apiKey=${apiKey}`, { webhookURL: body.url });
    return res.json({ ok: true });
  }
  if (method === 'DELETE') {
    await axios.delete(`https://api.jotform.com/form/${form}/webhooks/${url}?apiKey=${apiKey}`);
    return res.json({ ok: true });
  }
  res.status(405).end();
}
