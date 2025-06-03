// components/useFormTags.js
import { useState } from 'react';

const LS_KEY = 'formTags';   // localStorage key

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
};
const write = obj => localStorage.setItem(LS_KEY, JSON.stringify(obj));

export default function useFormTags() {
  // Initialize from localStorage (all keys → uppercase arrays)
  const [map, setMap] = useState(() => {
    const raw = read();
    // Normalize every tag to uppercase
    const norm = {};
    Object.entries(raw).forEach(([formId, tags]) => {
      norm[formId] = Array.from(new Set(tags.map(t => t.toUpperCase())));
    });
    return norm;
  });

  // Setter: accepts array of tags (any case), stores uppercase & deduped
  const setTags = (formId, tags) => {
    const upper = Array.from(new Set(tags.map(t => t.toUpperCase())));
    const next = { ...map, [formId]: upper };
    setMap(next);
    write(next);
  };

  return [map, setTags];
}
