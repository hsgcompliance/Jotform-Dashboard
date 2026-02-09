import axios from 'axios';
import { requireSession } from "../../lib/requireSession";

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  const apiKey = process.env.JOTFORM_API_KEY;
  const { data } = await axios.get(`https://api.jotform.com/user/submissions?apiKey=${apiKey}&offset=0&limit=50`);
  res.json(data.content || []);
}
