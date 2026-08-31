export interface PremiumEntitlement {
  isPremium: boolean;
  source: 'preview' | 'payment' | 'admin';
}

const PREMIUM_PREVIEW_KEY = 'zen-dictation-premium-preview';

// Temporary local provider. Replace this implementation with an API-backed
// provider when authentication and one-time payment are connected.
export const getPremiumEntitlement = (): PremiumEntitlement => ({
  isPremium: localStorage.getItem(PREMIUM_PREVIEW_KEY) === 'true',
  source: 'preview',
});

export const setPremiumPreview = (enabled: boolean) => {
  localStorage.setItem(PREMIUM_PREVIEW_KEY, String(enabled));
};
