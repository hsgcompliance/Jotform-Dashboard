// components/FormSidebar.js
import { useState } from 'react';
import { IconButton, Chip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';

export default function FormSidebar({
  forms = [],
  selected,
  onSelect,
  search,
  setSearch,
  tags = {},        // map: { [formId]: [ 'TAG1', 'TAG2', … ] }
  onEditTags
}) {
  return (
    <div
      style={{
        width: '26%',
        minWidth: 250,
        borderRight: '1px solid #ddd',
        padding: 16,
        overflowY: 'auto'
      }}
    >
      <input
        style={{
          width: '100%',
          padding: 6,
          marginBottom: 12,
          border: '1px solid #ccc',
          borderRadius: 4
        }}
        placeholder="Search forms…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {forms.map(f => {
          const fTags = tags[f.id] || [];
          return (
            <div
              key={f.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: 6,
                padding: 8,
                background: selected?.id === f.id ? '#e0f0ff' : '#fff',
              }}
            >
              {/* Title + Edit Icon */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontWeight: 500, fontSize: 14 }}>{f.title}</span>
                <IconButton size="small" onClick={() => onEditTags(f)}>
                  <EditIcon fontSize="inherit" />
                </IconButton>
              </div>

              {/* Stats: count + last submission */}
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                {f.count || 0} submissions ‒ {f.lastSubmission?.slice(0, 10) || '—'}
              </div>

              {/* Tags (stacked vertically) */}
              {fTags.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {fTags.map(tag => (
                    <Chip
                      key={tag}
                      label={tag.toUpperCase()}
                      size="small"
                      sx={{ fontSize: 10, textTransform: 'uppercase' }}
                    />
                  ))}
                </div>
              )}

              {/* Clickable overlay button (fills the entire box) */}
              <button
                onClick={() => onSelect(f)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer'
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
