import { apiUrl } from './api';

export interface YoutubeCaption { text: string; start: number; end: number }
interface TranscriptResponse { error?: string; segments?: string[]; videoId?: string; captions?: YoutubeCaption[] }

export const fetchYoutubeTranscript = async (url: string) => {
  let response: Response;
  let raw: string;
  try {
    response = await fetch(apiUrl('/api/youtube/transcript'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(70000),
    });
    raw = await response.text();
  } catch (error) {
    if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) {
      throw new Error('Hết thời gian chờ lấy phụ đề. Vui lòng thử lại; nếu lỗi tiếp diễn, kiểm tra kết nối của API server tới YouTube.', { cause: error });
    }
    throw new Error('Không kết nối được API lấy phụ đề. Kiểm tra backend và kết nối mạng rồi thử lại.', { cause: error });
  }
  let result: TranscriptResponse;
  try {
    result = JSON.parse(raw) as TranscriptResponse;
  } catch {
    throw new Error(response.status === 404
      ? 'Không tìm thấy API server. Hãy chạy backend ở cổng 3002.'
      : 'API server trả về phản hồi không hợp lệ. Hãy kiểm tra backend/proxy.');
  }
  if (!response.ok) throw new Error(result.error || 'Could not load the YouTube transcript');
  if (!Array.isArray(result.segments) || !result.segments.length || !result.segments.every(segment => typeof segment === 'string' && segment.trim()) || typeof result.videoId !== 'string' || !/^[\w-]{11}$/.test(result.videoId)) {
    throw new Error('This video has no readable captions. Please choose another video.');
  }
  if (!Array.isArray(result.captions) || result.captions.length !== result.segments.length || !result.captions.every((caption, index) => caption && caption.text === result.segments![index] && Number.isFinite(caption.start) && caption.start >= 0 && Number.isFinite(caption.end) && caption.end > caption.start)) {
    throw new Error('Timed captions are unavailable. Restart the API server and try another video.');
  }
  return result as { segments: string[]; videoId: string; captions: YoutubeCaption[] };
};
