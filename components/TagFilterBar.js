import { Chip, Stack } from '@mui/material';

export default function TagFilterBar({ allTags, active, setActive }) {
  const toggle = t =>
    setActive(a => a.includes(t) ? a.filter(x=>x!==t) : [...a, t]);

  return (
    <Stack direction="row" spacing={1} sx={{ p:1, flexWrap:'wrap' }}>
      {allTags.map(t => (
        <Chip
          key={t}
          label={t}
          color={active.includes(t) ? 'primary' : 'default'}
          onClick={() => toggle(t)}
        />
      ))}
    </Stack>
  );
}
