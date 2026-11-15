import { useRef, useState } from 'react';
import { fetchYoutubeTranscript, type YoutubeCaption } from '../../services/youtubeApi';
import './YoutubeImport.css';
import { useAppLanguage } from '../../context/useAppLanguage';

interface Props {
  busy: boolean;
  lesson: { index: number; texts: string[]; completed: boolean; videoId?: string } | null;
  onImport: (texts: string[], videoId: string, captions: YoutubeCaption[]) => void;
  onExit: () => void;
}

export default function YoutubeImport({ busy, lesson, onImport, onExit }: Props) {
  const isVietnamese = useAppLanguage().language === 'vi';
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  return <section className="youtube-import" aria-label={isVietnamese ? 'Luyện nghe từ YouTube' : 'YouTube dictation'}>
    <strong>{isVietnamese ? 'Luyện tập từ YouTube' : 'Practice from YouTube'}</strong>
    <p>{isVietnamese ? 'Dán liên kết video để nghe âm thanh gốc theo từng câu. Video sẽ tạm dừng khi bạn gõ.' : 'Paste a video link to listen to the original audio, one sentence at a time. The video pauses while you type.'}</p>
    <form onSubmit={async event => {
      event.preventDefault();
      if (pending.current || busy) return;
      pending.current = true;
      setLoading(true);
      setError('');
      try {
        const result = await fetchYoutubeTranscript(url.trim());
        onImport(result.segments, result.videoId, result.captions);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to load captions. Please try again.');
      } finally {
        pending.current = false;
        setLoading(false);
      }
    }}>
      <input type="url" required maxLength={500} value={url} disabled={loading || busy}
        onChange={event => { setUrl(event.target.value); setError(''); }}
        placeholder="https://www.youtube.com/watch?v=…" aria-label={isVietnamese ? 'Liên kết video YouTube' : 'YouTube video link'} />
      <button type="submit" disabled={loading || busy || !url.trim()}>{loading ? (isVietnamese ? 'Đang tải phụ đề…' : 'Loading captions…') : (isVietnamese ? 'Tải phụ đề' : 'Load captions')}</button>
    </form>
    {busy && <small>{isVietnamese ? 'Hoàn thành câu hiện tại trước khi nhập video.' : 'Finish the current sentence before importing a video.'}</small>}
    {loading && <p role="status">{isVietnamese ? 'Đang lấy phụ đề tiếng Anh… YouTube có thể phản hồi chậm, vui lòng chờ tối đa khoảng một phút.' : 'Fetching English captions… YouTube may respond slowly, please wait up to about a minute.'}</p>}
    {error && <p role="alert">{error}</p>}
    {lesson && <div className="youtube-progress" role="status">
      <span>{lesson.completed ? (isVietnamese ? 'Đã hoàn thành bài luyện video!' : 'Video practice complete!') : `YouTube · ${isVietnamese ? 'Phụ đề' : 'Caption'} ${lesson.index + 1}/${lesson.texts.length}`}</span>
      <a href={`https://www.youtube.com/watch?v=${lesson.videoId}`} target="_blank" rel="noreferrer">{isVietnamese ? 'Mở video' : 'Open video'}</a>
      <button type="button" disabled={loading} onClick={onExit}>{isVietnamese ? 'Quay lại luyện tập thường' : 'Back to regular practice'}</button>
    </div>}
  </section>;
}
