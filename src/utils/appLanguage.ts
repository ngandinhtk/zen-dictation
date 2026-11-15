export type AppLanguage = 'en' | 'vi';

export const readAppLanguage = (): AppLanguage => {
  try {
    return localStorage.getItem('zen-dictation-language') === 'vi' ? 'vi' : 'en';
  } catch {
    return 'en';
  }
};
