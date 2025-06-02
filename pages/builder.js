import { useState } from 'react';
import { Button, Stack, Typography } from '@mui/material';
import axios from 'axios';

export default function Builder() {
  const [newId, setNewId] = useState('');
  const [errJson, setErrJson] = useState('');
  const [busy,   setBusy]   = useState(false);

  const copy = () => navigator.clipboard.writeText(errJson);

  const clone = async () => {
    try {
      setBusy(true);
      const { data } = await axios.post('/api/clone', {});
      setNewId(`https://www.jotform.com/build/${data.id}`);
      setErrJson('');
    } catch (err) {
      const msg = JSON.stringify(err.response?.data || err.message, null, 2);
      setErrJson(msg);
    } finally { setBusy(false); }
  };

  return (
    <Stack spacing={2} sx={{ p:3, maxWidth:600 }}>
      <Typography variant="h5">Create New Form from Template</Typography>
      <Button disabled={busy} variant="contained" onClick={clone}>{busy?'Cloning…':'Clone Template'}</Button>

      {newId && (
        <Typography>
          Success! <a href={newId} target="_blank" rel="noreferrer">Open in builder ↗</a>
        </Typography>
      )}

      {errJson && (
        <pre style={{ background:'#fee', padding:8, whiteSpace:'pre-wrap' }}>
          {errJson}
          <Button size="small" onClick={copy}>Copy</Button>
        </pre>
      )}
    </Stack>
  );
}
