// components/FormSidebar.js
import React from 'react';
import { IconButton, Chip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';

export default function FormSidebar({
  forms = [],
  selected,
  onSelect,
  search,
  setSearch,
  tags = {},         // { [formId]: [ 'TAG1', 'TAG2', ... ] }
  onEditTags         // function(form) → opens tag dialog
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
      {/* Search input */}
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

      {/* Form cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {forms.map(f => {
          const fTags = tags[f.id] || [];
          // Determine background for selected vs. unselected
          const isSelected = selected?.id === f.id;
          return (
            <div
              key={f.id}
              style={{
                position: 'relative',            // allow absolutely positioned children if needed
                border: '1px solid #ddd',
                borderRadius: 6,
                padding: 8,
                background: isSelected ? '#e0f0ff' : '#fff',
                cursor: 'pointer'
              }}
              onClick={() => onSelect(f)}      // select this form when box is clicked
            >
              {/* Title row + Edit button */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontWeight: 500, fontSize: 14 }}>{f.title}</span>
                <IconButton
                  size="small"
                  onClick={e => {
                    e.stopPropagation();         // prevent parent onClick
                    onEditTags(f);
                  }}
                >
                  <EditIcon fontSize="inherit" />
                </IconButton>
              </div>

              {/* Stats: submission count · last submission date */}
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                {f.count || 0} submissions &bull;{' '}
                {f.lastSubmission?.slice(0, 10) || '—'}
              </div>

              {/* Tags (stacked vertically) */}
              {fTags.length > 0 && (
                <div
                  style={{
                    marginTop: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                  }}
                >
                  {fTags.map(tag => (
                    <Chip
                      key={tag}
                      label={tag.toUpperCase()}
                      size="small"
                      sx={{
                        fontSize: 10,
                        textTransform: 'uppercase'
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
