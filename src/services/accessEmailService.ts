import { apiUrl } from './api';

interface AccessEmailResponse {
  accepted: boolean;
  error?: string;
}

export async function submitAccessEmail(email: string, promoConsent: boolean, language: 'en' | 'vi'): Promise<void> {
  const response = await fetch(apiUrl('/api/access-email'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, promoConsent, language }),
  });
  const result = await response.json() as AccessEmailResponse;
  if (!response.ok) {
    if (response.status === 429) throw new Error('ACCESS_EMAIL_RATE_LIMITED');
    if (result.error === 'WELCOME_EMAIL_FAILED') throw new Error('WELCOME_EMAIL_FAILED');
    throw new Error('ACCESS_EMAIL_FAILED');
  }
  if (!result.accepted) throw new Error('ACCESS_EMAIL_FAILED');
}
