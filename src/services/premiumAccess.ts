export interface PremiumEntitlement {
  isPremium: boolean;
  source: 'license' | 'payment' | 'admin' | 'none';
}

const DEVICE_KEY = 'zen-dictation-device-id';

export const getDeviceId = () => {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const deviceId = globalThis.crypto?.randomUUID?.() || String(Date.now()) + '-' + String(Math.random());
  localStorage.setItem(DEVICE_KEY, deviceId);
  return deviceId;
};

// Temporary local provider. Replace this implementation with an API-backed
// provider when authentication and one-time payment are connected.
export const getPremiumStatus = async (): Promise<PremiumEntitlement> => {
  const response = await fetch('/api/premium/status?deviceId=' + encodeURIComponent(getDeviceId()));
  if (!response.ok) throw new Error('Premium status unavailable');
  return response.json();
};

export const activatePremiumLicense = async (licenseKey: string): Promise<PremiumEntitlement> => {
  const response = await fetch('/api/premium/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey, deviceId: getDeviceId() }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to activate license');
  return result;
};
