import { apiUrl } from './api';

export const fetchYoutubeTranscript = async (url: string) => {
  const response = await fetch(apiUrl('/api/youtube/transcript'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const raw = await response.text();
  let result: { error?: string; segments?: string[]; videoId?: string };
  try {
    result = JSON.parse(raw) as { error?: string; segments?: string[]; videoId?: string };
  } catch {
    throw new Error(response.status === 404
      ? 'Không tìm thấy API server. Hãy chạy backend ở cổng 3002.'
      : 'API server trả về phản hồi không hợp lệ. Hãy kiểm tra backend/proxy.');
  }
  if (!response.ok) throw new Error(result.error || 'Could not load the YouTube transcript');
  return result as { segments: string[]; videoId: string };
};
