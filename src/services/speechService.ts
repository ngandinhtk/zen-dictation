/** Web Speech API wrapper with voice loading and playback fallbacks. */

export type VoiceLanguage = 'en-US';
export type SpeechStatus = 'unsupported' | 'loading' | 'ready' | 'speaking' | 'paused' | 'error';

class SpeechService {
  private synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  private voices: SpeechSynthesisVoice[] = [];
  private voiceListeners = new Set<() => void>();
  private statusListeners = new Set<(status: SpeechStatus) => void>();
  private voiceRetryCount = 0;
  private speakRequest = 0;
  private replayTimer: number | null = null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
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

  private loadVoices = () => {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
    if (this.voices.length === 0 && this.voiceRetryCount < 10) {
      this.voiceRetryCount += 1;
      this.setStatus('loading');
      window.setTimeout(this.loadVoices, 250);
    } else {
      this.voiceRetryCount = 0;
      this.setStatus('ready');
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
    if (this.replayTimer !== null) window.clearTimeout(this.replayTimer);
    this.replayTimer = null;
    let remaining = Number.isFinite(repeatCount) ? Math.max(1, Math.min(5, Math.floor(repeatCount))) : 1;
    const gap = Number.isFinite(repeatGapMs) ? Math.max(0, repeatGapMs) : 1000;
    this.synth.cancel();
    this.synth.resume();

    const play = () => {
      if (requestId !== this.speakRequest) return;
      this.replayTimer = null;
      const utterance = new SpeechSynthesisUtterance(text);
      this.activeUtterance = utterance;
      const normalizedLanguage = lang.toLowerCase();
      const languageMatches = (voice: SpeechSynthesisVoice) => {
        const voiceLanguage = voice.lang.toLowerCase();
        return voiceLanguage === normalizedLanguage || voiceLanguage.startsWith(normalizedLanguage.split('-')[0]);
      };
      const voice = this.voices.find(item => item.name === voiceName && languageMatches(item))
        ?? this.getPreferredVoice(lang);

      // If no matching voice is installed, leaving voice unset lets the browser
      // choose its default voice while the utterance language remains English.
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || lang;
      utterance.text = /[.!?…]["')\]]*$/.test(speechText) ? speechText : `${speechText}.`;
      utterance.rate = Math.max(0.1, Math.min(rate, 10));
      utterance.onstart = () => this.setStatus('speaking');
      utterance.onend = () => {
        if (requestId !== this.speakRequest) return;
        this.activeUtterance = null;
        this.setStatus('ready');
        remaining -= 1;
        if (remaining > 0) this.replayTimer = window.setTimeout(play, gap);
      };
      utterance.onpause = () => this.setStatus('paused');
      utterance.onresume = () => this.setStatus('speaking');
      utterance.onerror = event => {
        if (requestId !== this.speakRequest) return;
        this.activeUtterance = null;
        if (event.error === 'canceled' || event.error === 'interrupted') return;
        this.setStatus('error');
        console.warn('Speech synthesis error:', event.error);
      };

      this.synth?.resume();
      this.synth?.speak(this.activeUtterance);
    };
    // Manual playback must stay in the tap/click call stack on mobile.
    // Keep the short cancel-to-speak delay for automatic desktop playback.
    if (startImmediately) play();
    else this.replayTimer = window.setTimeout(play, 50);
  }

  /** Resume the browser speech engine from a user gesture (important on iOS/Safari). */
  public prime() {
    if (!this.synth) {
      this.setStatus('unsupported');
      return;
    }
    this.synth.resume();
    if (this.voices.length === 0) this.loadVoices();
  }

  public stop() {
    this.speakRequest += 1;
    if (this.replayTimer !== null) window.clearTimeout(this.replayTimer);
    this.replayTimer = null;
    this.synth?.cancel();
    this.activeUtterance = null;
    if (this.synth) this.setStatus('ready');
  }

  public getVoicesByLang(lang: string) {
    const normalizedLanguage = lang.toLowerCase();
    return this.voices.filter(voice => voice.lang.toLowerCase() === normalizedLanguage || voice.lang.toLowerCase().startsWith(normalizedLanguage.split('-')[0]));
  }

  public getPreferredVoice(lang: string) {
    const normalizedLanguage = lang.toLowerCase();
    const languageMatches = (voice: SpeechSynthesisVoice) => {
      const voiceLanguage = voice.lang.toLowerCase();
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
