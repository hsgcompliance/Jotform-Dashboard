// components/useAllForms.js
// combine jotform sign and normal forms for feed
import { useEffect, useState } from 'react';
import axios from 'axios';
import useCachedForms from './useCachedForms';

export default function useAllForms() {
  // 1) Load normal “forms” from existing hook
  const [forms, reloadForms] = useCachedForms();

  // 2) State for Sign forms
  const [signForms, setSignForms] = useState([]);

  // 3) Merged list
  const allForms = [
    // Mark each normal form with isSign:false
    ...forms.map(f => ({ ...f, isSign: false })),
    // Mark each Sign form with isSign:true
    ...signForms.map(sf => ({ ...sf, isSign: true }))
  ];

  // 4) Reload Sign forms whenever the normal forms reload
  useEffect(() => {
    const fetchSign = async () => {
      try {
        const { data } = await axios.get('/api/signForms');
        // data is array of { id, title, status, ... }
        setSignForms(data);
      } catch (e) {
        console.error('Failed to fetch Sign forms:', e);
        setSignForms([]);
      }
    };
    fetchSign();
  }, [forms]); // re-fetch Sign forms any time the regular forms array changes

  return [allForms, reloadForms];
}
