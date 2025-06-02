import { useState } from 'react';
import { Stack, Typography, TextField, Button } from '@mui/material';
import axios from 'axios';
import FormPicker from '../components/FormPicker';
import ManualRefresh from '../components/ManualRefresh';

export default function Webhooks() {
  const [form,  setForm]  = useState(null);   // selected form object
  const [url,   setUrl]   = useState('');     // new webhook url input
  const [hooks, setHooks] = useState([]);     // list of current hooks

  /* ----- API helpers ----- */
  const list   = () =>
    axios.get(`/api/webhooks?form=${form.id}`).then(r => setHooks(r.data));

  const add    = () => {
    if (!url.trim()) return;
    axios.post('/api/webhooks', { form: form.id, url }).then(() => {
      setUrl('');
      list();
    });
  };

  const remove = hook =>
    axios.delete(`/api/webhooks?form=${form.id}&url=${encodeURIComponent(hook)}`)
         .then(list);

  /* ----- UI ----- */
  return (
    <Stack spacing={2} sx={{ p: 3, maxWidth: 800 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="h5">Webhook Manager</Typography>
        {form && <ManualRefresh onClick={list} title="Reload hooks" />}
      </Stack>

      {/* form selector */}
      <FormPicker onSelect={setForm} />

      {form && (
        <>
          {/* add new */}
          <Stack direction="row" spacing={2}>
            <TextField
              fullWidth
              label="New Webhook URL"
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
            <Button variant="outlined" onClick={add}>Add</Button>
          </Stack>

          {/* list */}
          {hooks.length === 0
            ? <Typography sx={{ mt:2 }}>No hooks configured.</Typography>
            : (
              <ul>
                {hooks.map(h => (
                  <li key={h}>
                    {h}{' '}
                    <Button size="small" onClick={() => remove(h)}>Delete</Button>
                  </li>
                ))}
              </ul>
            )}
        </>
      )}
    </Stack>
  );
}
