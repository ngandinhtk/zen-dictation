/** Web Speech API wrapper with voice loading and playback fallbacks. */

export type VoiceLanguage = 'en-US';
export type SpeechStatus = 'unsupported' | 'loading' | 'ready' | 'speaking' | 'paused' | 'error';
const normalizeLanguage = (value: string) => value.toLowerCase().replace(/_/g, '-');

class SpeechService {
  private synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  private voices: SpeechSynthesisVoice[] = [];
  private voiceListeners = new Set<() => void>();
  private statusListeners = new Set<(status: SpeechStatus) => void>();
  private voiceRetryCount = 0;
  private speakRequest = 0;
  private replayTimer: number | null = null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private startTimer: number | null = null;
  private errorMessage = '';
  private status: SpeechStatus = this.synth ? 'loading' : 'unsupported';

  constructor() {
    if (!this.synth) return;
    this.loadVoices();
    this.synth.onvoiceschanged = () => {
      this.loadVoices();
      this.voiceListeners.forEach(listener => listener());
    };
  }

  private setStatus = (status: SpeechStatus) => {
    this.status = status;
    this.statusListeners.forEach(listener => listener(status));
  };

  public getErrorMessage() { return this.errorMessage; }

  private clearStartTimer = () => {
    if (this.startTimer !== null) window.clearTimeout(this.startTimer);
    this.startTimer = null;
  };

  private loadVoices = () => {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
    if (this.voices.length === 0 && this.voiceRetryCount < 10) {
      this.voiceRetryCount += 1;
      if (!this.activeUtterance && this.status !== 'error') this.setStatus('loading');
      window.setTimeout(this.loadVoices, 250);
    } else {
      this.voiceRetryCount = 0;
      if (!this.activeUtterance && this.status !== 'error') this.setStatus('ready');
    }
  };

  public speak(text: string, lang: VoiceLanguage, rate = 1, voiceName?: string, repeatCount = 1, repeatGapMs = 1000, startImmediately = false) {
    const speechText = text.trim().replace(/\s+/g, ' ');
    if (!speechText) return;
    if (!this.synth) {
      this.setStatus('unsupported');
      return;
    }

    const requestId = ++this.speakRequest;
    // Android may expose its voices only after the first user interaction.
    this.voices = this.synth.getVoices();
    this.clearStartTimer();
    this.errorMessage = '';
    if (this.replayTimer !== null) window.clearTimeout(this.replayTimer);
    this.replayTimer = null;
    let remaining = Number.isFinite(repeatCount) ? Math.max(1, Math.min(5, Math.floor(repeatCount))) : 1;
    const gap = Number.isFinite(repeatGapMs) ? Math.max(0, repeatGapMs) : 1000;
    let recovered = false;
    let preferSystemVoice = voiceName === '';
    // Do not cancel an idle Android TTS engine immediately before starting it.
    if (this.activeUtterance || this.synth.speaking || this.synth.pending) this.synth.cancel();
    if (this.synth.paused) this.synth.resume();

    const retry = () => {
      if (recovered || requestId !== this.speakRequest) return false;
      recovered = true;
      preferSystemVoice = true;
      this.clearStartTimer();
      // Invalidate the old utterance before cancel(), which may fire events synchronously.
      this.activeUtterance = null;
      this.synth?.cancel();
      this.replayTimer = window.setTimeout(() => {
        if (requestId !== this.speakRequest) return;
        if (this.synth?.paused) this.synth.resume();
        play();
      }, 150);
      return true;
    };
    const play = () => {
      if (requestId !== this.speakRequest) return;
      this.replayTimer = null;
      const utterance = new SpeechSynthesisUtterance(text);
      this.activeUtterance = utterance;
      const normalizedLanguage = normalizeLanguage(lang);
      const languageMatches = (voice: SpeechSynthesisVoice) => {
        const voiceLanguage = normalizeLanguage(voice.lang);
        return voiceLanguage === normalizedLanguage || voiceLanguage.startsWith(normalizedLanguage.split('-')[0]);
      };
      const voice = preferSystemVoice ? undefined : this.voices.find(item => item.name === voiceName && languageMatches(item))
        ?? this.getPreferredVoice(lang);

      // If no matching voice is installed, leaving voice unset lets the browser
      // choose its default voice while the utterance language remains English.
      if (voice) utterance.voice = voice;
      utterance.lang = voice ? voice.lang.replace(/_/g, '-') : lang;
      utterance.text = /[.!?…]["')\]]*$/.test(speechText) ? speechText : `${speechText}.`;
      utterance.rate = Math.max(0.1, Math.min(rate, 10));
      const isCurrent = () => requestId === this.speakRequest && this.activeUtterance === utterance;
      utterance.onstart = () => {
        if (!isCurrent()) return;
        this.clearStartTimer();
        this.setStatus('speaking');
      };
      utterance.onend = () => {
        if (!isCurrent()) return;
        this.clearStartTimer();
        this.activeUtterance = null;
        this.setStatus('ready');
        remaining -= 1;
        if (remaining > 0) this.replayTimer = window.setTimeout(() => play(), gap);
      };
      utterance.onpause = () => { if (isCurrent()) this.setStatus('paused'); };
      utterance.onresume = () => { if (isCurrent()) this.setStatus('speaking'); };
      utterance.onerror = event => {
        if (!isCurrent()) return;
        this.clearStartTimer();
        if (['canceled', 'interrupted', 'voice-unavailable', 'language-unavailable', 'synthesis-unavailable', 'synthesis-failed', 'network'].includes(event.error) && retry()) return;
        this.activeUtterance = null;
        this.errorMessage = event.error === 'not-allowed'
          ? 'Playback was blocked. Open this page in Chrome and tap Replay.'
          : ['voice-unavailable', 'language-unavailable', 'synthesis-unavailable', 'synthesis-failed'].includes(event.error)
            ? 'English speech is unavailable. Enable or update your phone’s text-to-speech engine and install an English voice, then tap Replay.'
            : event.error === 'network'
              ? 'The voice could not connect. Check your connection or choose an installed English voice in Settings.'
              : 'Speech could not play. Try Replay or open this page in Chrome.';
        this.setStatus('error');
        console.warn('Speech synthesis error:', event.error);
      };

      this.setStatus('loading');
      this.startTimer = window.setTimeout(() => {
        if (!isCurrent()) return;
        if (retry()) return;
        this.stop();
        this.errorMessage = 'Speech did not start. Open this page in Chrome, check media volume and your phone’s English text-to-speech voice, then tap Replay.';
        this.setStatus('error');
      }, 8000);
      try {
        this.synth?.speak(utterance);
      } catch {
        if (retry()) return;
        this.clearStartTimer();
        this.activeUtterance = null;
        this.errorMessage = 'Speech could not start. Check your phone’s English text-to-speech voice and tap Replay.';
        this.setStatus('error');
      }
    };
    // Manual playback must stay in the tap/click call stack on mobile.
    // Keep the short cancel-to-speak delay for automatic desktop playback.
    if (startImmediately) play();
    else this.replayTimer = window.setTimeout(() => play(), 50);
  }

  /** Resume the browser speech engine from a user gesture (important on iOS/Safari). */
  public prime() {
    if (!this.synth) {
      this.setStatus('unsupported');
      return;
    }
    if (this.synth.paused) this.synth.resume();
    if (this.voices.length === 0) this.loadVoices();
  }

  public stop() {
    this.speakRequest += 1;
    this.clearStartTimer();
    if (this.replayTimer !== null) window.clearTimeout(this.replayTimer);
    this.replayTimer = null;
    if (this.activeUtterance || this.synth?.speaking || this.synth?.pending) this.synth?.cancel();
    this.activeUtterance = null;
    if (this.synth) this.setStatus('ready');
  }

  public getVoicesByLang(lang: string) {
    const normalizedLanguage = normalizeLanguage(lang);
    return this.voices.filter(voice => normalizeLanguage(voice.lang) === normalizedLanguage || normalizeLanguage(voice.lang).startsWith(normalizedLanguage.split('-')[0]));
  }

  public getPreferredVoice(lang: string) {
    const normalizedLanguage = normalizeLanguage(lang);
    const languageMatches = (voice: SpeechSynthesisVoice) => {
      const voiceLanguage = normalizeLanguage(voice.lang);
      return voiceLanguage === normalizedLanguage || voiceLanguage.startsWith(normalizedLanguage.split('-')[0]);
    };
    const score = (voice: SpeechSynthesisVoice) => {
      const name = voice.name.toLowerCase();
      return (voice.lang.toLowerCase() === normalizedLanguage ? 100 : 50)
        + (/\b(natural|neural|premium|enhanced)\b/.test(name) ? 100 : 0)
        + (name === 'google us english' ? 80 : name.includes('google') ? 40 : 0)
        + (name.includes('microsoft') ? 20 : 0)
        + (voice.default ? 5 : 0);
    };
    return this.voices.filter(languageMatches).sort((left, right) => score(right) - score(left))[0];
  }

  public getStatus() {
    return this.status;
  }

  public subscribeToVoices(listener: () => void) {
    this.voiceListeners.add(listener);
    return () => this.voiceListeners.delete(listener);
  }

  public subscribeToStatus(listener: (status: SpeechStatus) => void) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }
}

export const speechService = new SpeechService();
