import { parseTimedCaptions } from './youtubeCaptions.mjs';

export class YoutubeTranscriptError extends Error {
  constructor(message, status = 502, code = 'YOUTUBE_UNAVAILABLE') {
    super(message);
    this.name = 'YoutubeTranscriptError';
    this.status = status;
    this.code = code;
  }
}

export const getYoutubeVideoId = value => {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    let id = '';
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
    if (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com')) id = url.searchParams.get('v') || url.pathname.match(/\/(?:shorts|embed|live)\/([^/]+)/)?.[1] || '';
    return /^[\w-]{11}$/.test(id) ? id : '';
  } catch { return ''; }
};

export async function fetchYoutubeTranscript(videoUrl, { fetchImpl = fetch, requestTimeoutMs = 25000, totalTimeoutMs = 60000 } = {}) {
  const videoId = getYoutubeVideoId(videoUrl);
  if (!videoId) throw new YoutubeTranscriptError('Vui lòng nhập link YouTube hợp lệ.', 400, 'INVALID_YOUTUBE_URL');
  const deadline = Date.now() + totalTimeoutMs;
  const read = async (url, stage) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - Date.now();
      try {
        if (remaining <= 0) throw new DOMException('Deadline exceeded', 'TimeoutError');
        const response = await fetchImpl(url, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9' },
          signal: AbortSignal.timeout(Math.max(1, Math.min(requestTimeoutMs, remaining))),
        });
        if ([403, 429].includes(response.status)) {
          await response.body?.cancel();
          throw new YoutubeTranscriptError('YouTube đang chặn hoặc giới hạn yêu cầu từ máy chủ. Vui lòng thử lại sau hoặc chọn video khác.', 502, 'YOUTUBE_BLOCKED');
        }
        if (!response.ok) {
          await response.body?.cancel();
          if (response.status >= 500 && attempt === 0) continue;
          throw new YoutubeTranscriptError(`Không thể ${stage} (YouTube HTTP ${response.status}). Vui lòng thử video khác.`);
        }
        return await response.text();
      } catch (error) {
        if (error instanceof YoutubeTranscriptError) throw error;
        const timedOut = ['TimeoutError', 'AbortError'].includes(error?.name) || ['UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'].includes(error?.cause?.code);
        const networkError = error instanceof TypeError && error.message === 'fetch failed';
        if ((timedOut || networkError) && attempt === 0 && Date.now() < deadline) continue;
        if (timedOut) throw new YoutubeTranscriptError(`YouTube phản hồi quá chậm khi ${stage}. Đã hết thời gian chờ; vui lòng thử lại hoặc chọn video khác.`, 504, 'YOUTUBE_TIMEOUT');
        if (networkError) throw new YoutubeTranscriptError(`Máy chủ không kết nối được YouTube khi ${stage}. Kiểm tra kết nối mạng rồi thử lại.`, 502, 'YOUTUBE_NETWORK');
        throw error;
      }
    }
  };

  const html = await read(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, 'mở video');
  const match = html.match(/"captionTracks"\s*:\s*(\[[\s\S]*?\])/);
  if (!match) throw new YoutubeTranscriptError('Không tìm thấy phụ đề công khai. Video có thể không có phụ đề hoặc yêu cầu đăng nhập.', 422, 'NO_CAPTIONS');
  let tracks;
  try { tracks = JSON.parse(match[1]); } catch { throw new YoutubeTranscriptError('Không đọc được thông tin phụ đề của video.'); }
  const track = tracks.find(item => /^en(?:-|$)/.test(item.languageCode) && item.kind !== 'asr') || tracks.find(item => /^en(?:-|$)/.test(item.languageCode));
  if (!track?.baseUrl) throw new YoutubeTranscriptError('Video không có phụ đề tiếng Anh khả dụng. Vui lòng chọn video khác.', 422, 'NO_ENGLISH_CAPTIONS');
  const captionUrl = new URL(track.baseUrl);
  if (captionUrl.protocol !== 'https:' || !(captionUrl.hostname === 'youtube.com' || captionUrl.hostname.endsWith('.youtube.com'))) throw new YoutubeTranscriptError('Nguồn phụ đề không hợp lệ.');
  const originalCaptionUrl = captionUrl.toString();
  captionUrl.searchParams.set('fmt', 'json3');
  let captions = parseTimedCaptions(await read(captionUrl, 'tải phụ đề'));
  if (!captions.length && originalCaptionUrl !== captionUrl.toString()) {
    captions = parseTimedCaptions(await read(originalCaptionUrl, 'tải phụ đề gốc'));
  }
  if (!captions.length) throw new YoutubeTranscriptError('Video có phụ đề tiếng Anh nhưng YouTube trả về dữ liệu rỗng cho máy chủ. Vui lòng thử lại sau; tăng thời gian chờ không giải quyết được trường hợp này.', 502, 'EMPTY_CAPTIONS');
  return { videoId, language: track.languageCode || 'unknown', segments: captions.map(caption => caption.text), captions };
}
