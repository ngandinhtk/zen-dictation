import { apiUrl } from './api';

export interface PremiumEntitlement {
  isPremium: boolean;
  source: 'license' | 'payment' | 'admin' | 'none';
}

export interface ZaloPayOrder {
  orderUrl: string;
  appTransId: string;
  amount: number;
}

export interface ZaloPayPaymentStatus {
  status: 'pending' | 'paid';
  amount: number;
  licenseKey: string | null;
}

const DEVICE_KEY = 'zen-dictation-device-id';

export const getDeviceId = () => {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const deviceId = globalThis.crypto?.randomUUID?.() || String(Date.now()) + '-' + String(Math.random());
  localStorage.setItem(DEVICE_KEY, deviceId);
  return deviceId;
};

const readApiResponse = async <T>(response: Response): Promise<T & { error?: string }> => {
  const text = await response.text();
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    throw new Error('Cannot reach the Premium server. Start the backend on port 3002 and use the Vite dev server.');
  }
};

export const getPremiumStatus = async (): Promise<PremiumEntitlement> => {
  const response = await fetch(apiUrl('/api/premium/status?deviceId=' + encodeURIComponent(getDeviceId())), { credentials: 'include' });
  const result = await readApiResponse<PremiumEntitlement>(response);
  if (!response.ok) throw new Error(result.error || 'Premium status unavailable');
  return result;
};

export const activatePremiumLicense = async (licenseKey: string): Promise<PremiumEntitlement> => {
  const response = await fetch(apiUrl('/api/premium/activate'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey, deviceId: getDeviceId() }),
  });
  const result = await readApiResponse<PremiumEntitlement & { error?: string }>(response);
  if (!response.ok) throw new Error(result.error || 'Unable to activate license');
  return result;
};

export const createZaloPayOrder = async (email = ''): Promise<ZaloPayOrder> => {
  const response = await fetch(apiUrl('/api/payments/zalopay/create-order'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, deviceId: getDeviceId() }),
  });
  const result = await readApiResponse<ZaloPayOrder & { error?: string }>(response);
  if (!response.ok) throw new Error(result.error || 'Unable to start ZaloPay checkout');
  return result;
};

export const getZaloPayPaymentStatus = async (appTransId: string): Promise<ZaloPayPaymentStatus> => {
  const response = await fetch(apiUrl('/api/payments/zalopay/status?appTransId=' + encodeURIComponent(appTransId) + '&deviceId=' + encodeURIComponent(getDeviceId())), { credentials: 'include' });
  const result = await readApiResponse<ZaloPayPaymentStatus & { error?: string }>(response);
  if (!response.ok) throw new Error(result.error || 'Unable to check payment status');
  return result;
};
