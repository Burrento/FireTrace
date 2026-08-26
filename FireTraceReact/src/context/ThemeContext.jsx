import { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeContext } from './themeContextObject';

const STORAGE_KEY = 'ft-theme';

function systemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/* Returns 'light' | 'dark' when the user has chosen one, or null when they
   have not, in which case the device preference wins and keeps winning if it
   later changes. */
function storedPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(storedPreference);
  const [deviceTheme, setDeviceTheme] = useState(systemTheme);

  const theme = preference ?? deviceTheme;

  // Keep following the device while the user has no explicit preference.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event) => setDeviceTheme(event.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // The attribute on <html> is what index.css keys off; the boot script in
  // index.html sets it first so there is no flash before React mounts.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback((next) => {
    setPreference(next);
    try {
      if (next === null) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      // Private mode or blocked storage — the theme still applies for this session.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      /* null means "follow the device" */
      preference,
      setTheme,
      toggleTheme,
      useSystemTheme: () => setTheme(null),
    }),
    [theme, preference, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
