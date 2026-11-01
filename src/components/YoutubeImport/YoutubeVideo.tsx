import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { loadYoutubePlayer, type YoutubePlayer } from '../../services/youtubePlayer';
import type { YoutubeCaption } from '../../services/youtubeApi';

export interface YoutubeVideoHandle { replay: () => void }
interface Props {
  ref: Ref<YoutubeVideoHandle>;
  videoId: string;
  caption: YoutubeCaption;
  speed: number;
  completed: boolean;
}

export default function YoutubeVideo({ ref, videoId, caption, speed, completed }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const player = useRef<YoutubePlayer | null>(null);
  const current = useRef({ caption, speed, completed });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { current.current = { caption, speed, completed }; }, [caption, speed, completed]);

  useImperativeHandle(ref, () => ({ replay() {
    if (!ready || !player.current || current.current.completed) return;
    setNotice('');
    const { caption: cue, speed: rate } = current.current;
    player.current.loadVideoById({ videoId, startSeconds: cue.start, endSeconds: cue.end });
    player.current.setPlaybackRate(rate);
  } }), [ready, videoId]);

  useEffect(() => {
    let disposed = false;
    let interval: number | undefined;
    let instance: YoutubePlayer | undefined;
    const host = document.createElement('div');
    container.current?.appendChild(host);
    void loadYoutubePlayer().then(api => {
      if (disposed) return;
      instance = new api.Player(host, {
        videoId, width: '100%', height: '100%',
        playerVars: { playsinline: 1, cc_load_policy: 0, origin: window.location.origin, rel: 0 },
        events: {
          onReady() {
            if (disposed || !instance) return;
            player.current = instance;
            setReady(true);
            const cue = current.current.caption;
            instance.cueVideoById({ videoId, startSeconds: cue.start, endSeconds: cue.end });
            interval = window.setInterval(() => {
              if (!instance || instance.getPlayerState() !== 1) return;
              const { caption: active, completed: done } = current.current;
              const time = instance.getCurrentTime();
              if (done || time >= active.end || time < active.start - .5) instance.pauseVideo();
            }, 80);
          },
          onError(event) {
            if (disposed) return;
            setError([101, 150].includes(event.data) ? 'This video does not allow embedded playback. Choose another video.' : 'Unable to play this video. It may be restricted or unavailable. Try another video.');
          },
          onAutoplayBlocked() { if (!disposed) setNotice('Press Play sentence or the video play button to begin.'); },
        },
      });
    }).catch(cause => { if (!disposed) setError(cause instanceof Error ? cause.message : 'Unable to load video.'); });
    return () => {
      disposed = true;
      window.clearInterval(interval);
      player.current = null;
      instance?.destroy();
      host.remove();
    };
  }, [videoId]);

  useEffect(() => {
    if (!ready || !player.current) return;
    player.current.pauseVideo();
    if (completed) return;
    player.current.loadVideoById({ videoId, startSeconds: caption.start, endSeconds: caption.end });
    player.current.setPlaybackRate(speed);
    // Speed changes apply on the next replay, without restarting the sentence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, videoId, caption.start, caption.end, completed]);

  return <div className="youtube-video">
    <div ref={container} className="youtube-player" />
    {!ready && !error && <p role="status">Loading video player…</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <button type="button" disabled={!ready || Boolean(error) || completed} onClick={() => {
      const active = player.current;
      if (!active) return;
      setNotice('');
      active.loadVideoById({ videoId, startSeconds: caption.start, endSeconds: caption.end });
      active.setPlaybackRate(speed);
    }}>Play sentence / Replay</button>
    <small> {caption.start.toFixed(1)}–{caption.end.toFixed(1)}s · Pauses at the end of this sentence</small>
  </div>;
}
