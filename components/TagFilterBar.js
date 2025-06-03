// components/TagFilterBar.js
import { Chip, Stack } from '@mui/material';

export default function TagFilterBar({
  allTags = [],   // array of uppercase tag strings
  active = [],    // array of currently active filters
  setActive       // setter for active array
}) {
  const toggle = t => {
    const u = t.toUpperCase();
    setActive(a => (a.includes(u) ? a.filter(x => x !== u) : [...a, u]));
  };

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ p: 1, flexWrap: 'wrap', borderBottom: '1px solid #ddd', background: '#fafafa' }}
    >
      {allTags.map(t => (
        <Chip
          key={t}
          label={t}
          size="small"
          color={active.includes(t) ? 'primary' : 'default'}
          onClick={() => toggle(t)}
          sx={{ textTransform: 'uppercase' }}
        />
      ))}
    </Stack>
  );
}
