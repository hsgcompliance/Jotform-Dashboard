import { useState } from 'react';

const LS_KEY = 'formTags';   // { [formId]: ["finance","2024"] }

const read = () => JSON.parse(localStorage.getItem(LS_KEY) || '{}');
const write = obj => localStorage.setItem(LS_KEY, JSON.stringify(obj));

export default function useFormTags() {
  const [map, setMap] = useState(read);

  const setTags = (formId, tags) => {
    const next = { ...map, [formId]: tags };
    setMap(next);
    write(next);
  };

  return [map, setTags]; // [ {id: ["tag"]}, setter ]
}
