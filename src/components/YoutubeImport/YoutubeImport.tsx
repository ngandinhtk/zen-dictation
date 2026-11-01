import { useRef, useState } from 'react';
import { fetchYoutubeTranscript, type YoutubeCaption } from '../../services/youtubeApi';
import './YoutubeImport.css';

interface Props {
  busy: boolean;
  lesson: { index: number; texts: string[]; completed: boolean; videoId?: string } | null;
  onImport: (texts: string[], videoId: string, captions: YoutubeCaption[]) => void;
  onExit: () => void;
}

export default function YoutubeImport({ busy, lesson, onImport, onExit }: Props) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  return <section className="youtube-import" aria-label="YouTube dictation">
    <strong>Practice from YouTube</strong>
    <p>Paste a video link to listen to the original audio, one sentence at a time. The video pauses while you type.</p>
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
        placeholder="https://www.youtube.com/watch?v=…" aria-label="YouTube video link" />
      <button type="submit" disabled={loading || busy || !url.trim()}>{loading ? 'Loading captions…' : 'Load captions'}</button>
    </form>
    {busy && <small>Finish the current sentence before importing a video.</small>}
    {loading && <p role="status">Đang lấy phụ đề tiếng Anh… YouTube có thể phản hồi chậm, vui lòng chờ tối đa khoảng một phút.</p>}
    {error && <p role="alert">{error}</p>}
    {lesson && <div className="youtube-progress" role="status">
      <span>{lesson.completed ? 'Video practice complete!' : `YouTube · Caption ${lesson.index + 1} of ${lesson.texts.length}`}</span>
      <a href={`https://www.youtube.com/watch?v=${lesson.videoId}`} target="_blank" rel="noreferrer">Open video</a>
      <button type="button" disabled={loading} onClick={onExit}>Back to regular practice</button>
    </div>}
  </section>;
}
