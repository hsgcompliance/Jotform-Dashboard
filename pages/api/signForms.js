// pages/api/signForms.js
//returns all Sign workflow forms
import axios from 'axios';

export default async function handler(req, res) {
  const apiKey = process.env.JOTFORM_API_KEY;
  if (req.method !== 'GET') return res.status(405).end();

  try {
    // Fetch all Sign workflows for this account
    const { data } = await axios.get(
      `https://api.jotform.com/user/signforms?apiKey=${apiKey}`
    );
    // data.content is an array of objects: { id, title, status, ... }
    res.status(200).json(data.content || []);
  } catch (err) {
    console.error('Error fetching sign forms:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not fetch sign forms' });
  }
}
