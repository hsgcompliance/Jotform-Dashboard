import { useState } from 'react';
import { Dialog, DialogTitle, DialogActions, DialogContent,
         Button, TextField, Chip, Stack } from '@mui/material';

export default function FormTagPicker({ open, onClose, tags, setTags }) {
  const [input, setInput] = useState('');

  const add = () => {
    const t = input.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setInput('');
  };
  const remove = t => setTags(tags.filter(x => x !== t));

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Edit Tags</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={1} sx={{ flexWrap:'wrap', mb:2 }}>
          {tags.map(t => (
            <Chip key={t} label={t} onDelete={() => remove(t)} />
          ))}
        </Stack>
        <TextField
          size="small"
          label="New tag"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==='Enter' && add()}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={add}>Add</Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
