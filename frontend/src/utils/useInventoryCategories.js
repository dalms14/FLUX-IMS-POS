import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

const api = 'http://localhost:5000/api/inventory/categories';
export const mergeCategoryNames = (...lists) => {
  const names = new Map();
  lists.flat().forEach(value => {
    if (typeof value !== 'string') return;
    const name = value.trim().replace(/\s+/g, ' ');
    if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  });
  return [...names.values()];
};

export default function useInventoryCategories() {
  const [categories, setCategories] = useState(['General']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(api);
      if (!Array.isArray(response.data?.data) || response.data.data.some(name => typeof name !== 'string')) throw new Error('Invalid categories');
      setCategories(current => mergeCategoryNames(response.data.data, current));
      setError('');
    } catch {
      setError('Could not load categories. Retry to see the full list.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const addCategory = async name => {
    const response = await axios.post(api, { name });
    const saved = response.data?.category?.name;
    if (typeof saved !== 'string' || !saved.trim()) throw new Error('Could not confirm the saved category. Retry loading the list.');
    setCategories(current => mergeCategoryNames(current, [saved]));
    return saved;
  };
  return { categories, addCategory, error, loading, reload: load };
}
