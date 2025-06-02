import axios from 'axios';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing form ID' });

  const apiKey = process.env.JOTFORM_API_KEY;

  const limit   = 1000;
  let offset    = 0;
  let allSubs   = [];

  try {
    while (true) {
      const { data } = await axios.get(
        `https://api.jotform.com/form/${id}/submissions`,
        { params: { apiKey, limit, offset, answers: 'yes' } }
      );

      const chunk = data?.content ?? [];
      allSubs.push(...chunk);
      if (chunk.length < limit) break;
      offset += limit;
    }

    res.status(200).json({ content: allSubs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
