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

  public speak(text: string, lang: VoiceLanguage, rate = 1, voiceName?: string) {
    if (!text.trim()) return;
    if (!this.synth) {
      this.setStatus('unsupported');
      return;
    }

    const requestId = ++this.speakRequest;
    this.synth.cancel();
    this.synth.resume();

    const utterance = new SpeechSynthesisUtterance(text);
    const normalizedLanguage = lang.toLowerCase();
    const languageMatches = (voice: SpeechSynthesisVoice) => {
      const voiceLanguage = voice.lang.toLowerCase();
      return voiceLanguage === normalizedLanguage || voiceLanguage.startsWith(normalizedLanguage.split('-')[0]);
    };
    const voice = this.voices.find(item => item.name === voiceName && languageMatches(item))
      ?? this.voices.find(item => item.name === 'Google US English' && languageMatches(item))
      ?? this.voices.find(languageMatches);

    // If no matching voice is installed, leaving voice unset lets the browser
    // choose its default voice while the utterance language remains English.
    if (voice) utterance.voice = voice;
    utterance.lang = lang;
    utterance.rate = Math.max(0.1, Math.min(rate, 10));
    utterance.onstart = () => this.setStatus('speaking');
    utterance.onend = () => {
      if (requestId === this.speakRequest) this.setStatus('ready');
    };
    utterance.onpause = () => this.setStatus('paused');
    utterance.onresume = () => this.setStatus('speaking');
    utterance.onerror = event => {
      if (event.error === 'canceled' || event.error === 'interrupted') return;
      this.setStatus('error');
      console.warn('Speech synthesis error:', event.error);
    };

    // Chrome/WebKit can discard a new utterance if it follows cancel() too
    // closely, so schedule it on the next short task.
    window.setTimeout(() => {
      if (requestId !== this.speakRequest) return;
      this.synth?.resume();
      this.synth?.speak(utterance);
    }, 50);
  }

  public stop() {
    this.speakRequest += 1;
    this.synth?.cancel();
    if (this.synth) this.setStatus('ready');
  }

  public getVoicesByLang(lang: string) {
    const normalizedLanguage = lang.toLowerCase();
    return this.voices.filter(voice => voice.lang.toLowerCase() === normalizedLanguage || voice.lang.toLowerCase().startsWith(normalizedLanguage.split('-')[0]));
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
