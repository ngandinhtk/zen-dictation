import { useContext } from 'react';
import { AppLanguageContext } from './languageContext';

export function useAppLanguage() {
  const value = useContext(AppLanguageContext);
  if (!value) throw new Error('useAppLanguage must be used within AppLanguageProvider');
  return value;
}
