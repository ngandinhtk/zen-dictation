import { createContext } from 'react';
import type { AppLanguage } from '../utils/appLanguage';

export interface AppLanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

export const AppLanguageContext = createContext<AppLanguageContextValue | null>(null);
