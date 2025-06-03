// components/FormTagPicker.js
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  Button,
  Autocomplete,
  TextField,
  Chip,
  Stack
} from '@mui/material';

export default function FormTagPicker({
  open,
  onClose,
  existingTags = [],   // all tags across forms
  tags = [],           // current tags on this form
  setTags             // function(formId, tagsArray)
}) {
  const [inputValue, setInputValue]   = useState('');
  const [selected, setSelected]       = useState(tags);

  // When dialog reopens with different `tags`, reset
  useEffect(() => {
    setSelected(tags);
  }, [tags]);

  const handleSave = () => {
    setTags(selected);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Edit Tags</DialogTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mt: 1 }}>
          <Autocomplete
            multiple
            freeSolo
            options={existingTags}                // all tags in the system
            value={selected}
            onChange={(e, newVal) => setSelected(newVal)}
            inputValue={inputValue}
            onInputChange={(e, v) => setInputValue(v)}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  variant="outlined"
                  label={option.toUpperCase()}
                  size="small"
                  {...getTagProps({ index })}
                  key={option}
                />
              ))
            }
            renderInput={params => (
              <TextField
                {...params}
                label="Tags (type or select...)"
                placeholder="Enter a tag"
                onKeyDown={e => {
                  // Press Enter → commit uppercase
                  if (e.key === 'Enter' && inputValue.trim()) {
                    e.preventDefault();
                    const upper = inputValue.trim().toUpperCase();
                    if (!selected.includes(upper)) {
                      setSelected([...selected, upper]);
                    }
                    setInputValue('');
                  }
                }}
              />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}
