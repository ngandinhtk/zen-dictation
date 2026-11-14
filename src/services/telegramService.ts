const DEFAULT_TELEGRAM_URL = 'https://t.me/giniddinh';

export const getTelegramContactUrl = (configuredUrl?: string) => {
  const value = configuredUrl?.trim() || DEFAULT_TELEGRAM_URL;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 't.me' || !url.pathname || url.pathname === '/') return undefined;
    return url.href;
  } catch {
    return undefined;
  }
};

export const getTelegramMessageUrl = (configuredUrl: string | undefined, message: string) => {
  const contactUrl = getTelegramContactUrl(configuredUrl);
  if (!contactUrl) return undefined;
  const url = new URL(contactUrl);
  url.searchParams.set('text', message);
  return url.href;
};
