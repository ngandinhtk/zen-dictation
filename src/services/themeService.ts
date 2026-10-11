export type Theme = 'light' | 'dark';
const THEME_KEY = 'zen-dictation-theme';

export const getTheme = (): Theme => {
  const current = document.documentElement.dataset.theme;
  if (current === 'light' || current === 'dark') return current;
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* Use the system preference when storage is unavailable. */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const applyTheme = (theme: Theme, persist = false) => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  if (persist) {
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* Theme switching still works. */ }
  }
};
