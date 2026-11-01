export interface YoutubePlayer {
  loadVideoById(options: { videoId: string; startSeconds: number; endSeconds: number }): void;
  cueVideoById(options: { videoId: string; startSeconds: number; endSeconds: number }): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  destroy(): void;
}
interface YoutubeApi {
  Player: new (element: HTMLElement, options: {
    videoId: string;
    width: string;
    height: string;
    playerVars: Record<string, string | number>;
    events: {
      onReady: () => void;
      onError: (event: { data: number }) => void;
      onAutoplayBlocked: () => void;
    };
  }) => YoutubePlayer;
}
declare global {
  interface Window {
    YT?: YoutubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let pending: Promise<YoutubeApi> | undefined;
export function loadYoutubePlayer(): Promise<YoutubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;
  pending = new Promise<YoutubeApi>((resolve, reject) => {
    const script = document.createElement('script');
    const previous = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => fail(), 15000);
    const fail = () => {
      window.clearTimeout(timeout);
      script.remove();
      window.onYouTubeIframeAPIReady = previous;
      pending = undefined;
      reject(new Error('Unable to load the YouTube player. Check your connection and reload the page.'));
    };
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      window.onYouTubeIframeAPIReady = previous;
      if (window.YT?.Player) resolve(window.YT);
      else fail();
      previous?.();
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return pending;
}
