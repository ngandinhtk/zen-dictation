import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { readAppLanguage, type AppLanguage } from '../utils/appLanguage';
import { AppLanguageContext } from './languageContext';

export function AppLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState(readAppLanguage);
  const setLanguage = (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    try {
      localStorage.setItem('zen-dictation-language', nextLanguage);
    } catch {
      // The selected language still applies for this session if storage is unavailable.
    }
  };
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage }), [language]);

  return <AppLanguageContext.Provider value={value}>{children}</AppLanguageContext.Provider>;
}
