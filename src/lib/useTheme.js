import { useState, useEffect } from 'react';

/**
 * Dark/Light mode hook.
 * Reads preference from localStorage, applies class to document.documentElement.
 * Default: 'dark' (matches existing design).
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('ece-theme') || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('ece-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return [theme, toggleTheme];
}
