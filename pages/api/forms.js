import axios from 'axios';

/**
 * GET /api/forms
 * Returns every form that has at least one submission, plus metadata we need.
 */
export default async function handler(req, res) {
  const apiKey = process.env.JOTFORM_API_KEY;
  const limit  = 100;   // page size
  let offset   = 0;
  let forms    = [];

  try {
    // paginate until no more
    while (true) {
      const { data } = await axios.get(
        'https://api.jotform.com/user/forms',
        { params: { apiKey, limit, offset } }
      );

      const chunk = data?.content ?? [];
      forms.push(...chunk);

      if (chunk.length < limit) break;
      offset += limit;
    }

    // keep only forms that actually have submissions
    const withSubs = forms.filter(
      f => Number(f.submissionsCount ?? f.count ?? 0) > 0
    );

    // map a slimmer payload for the UI
    const slim = withSubs.map(f => ({
      id:                f.id,
      title:             f.title,
      count:             Number(f.submissionsCount ?? f.count ?? 0),
      lastSubmission:    f.last_submission,   // ISO string or ''
      url:               f.url                // public form link
    }));

    res.status(200).json({ content: slim });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
