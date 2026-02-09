// components/useAllForms.js
import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import useCachedForms from './useCachedForms';

export default function useAllForms() {
  const [forms, reloadForms] = useCachedForms();
  const [signForms, setSignForms] = useState([]);

  const fetchSignForms = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/signForms');

      // Accept either: [] OR { content: [] }
      const list = Array.isArray(data) ? data : (data?.content ?? []);
      setSignForms(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('Failed to fetch Sign forms:', e?.response?.data || e?.message || e);
      setSignForms([]);
    }
  }, []);

  // ✅ Don’t let one failing call abort the other
  const reloadAll = useCallback(async () => {
    const [formsRes, signRes] = await Promise.allSettled([
      reloadForms(),
      fetchSignForms(),
    ]);

    if (formsRes.status === 'rejected') {
      console.error('reloadForms failed:', formsRes.reason?.response?.data || formsRes.reason);
    }
    if (signRes.status === 'rejected') {
      console.error('fetchSignForms failed:', signRes.reason?.response?.data || signRes.reason);
    }
  }, [reloadForms, fetchSignForms]);

  useEffect(() => {
    fetchSignForms();
  }, [fetchSignForms]);

  // Optional: memoize to reduce churn
  const allForms = useMemo(() => ([
    ...forms.map(f => ({ ...f, isSign: false })),
    ...signForms.map(sf => ({ ...sf, isSign: true })),
  ]), [forms, signForms]);

  return [allForms, reloadAll];
}
