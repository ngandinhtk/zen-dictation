/**
 * SpeechService - Wrapper for Web Speech API
 */

export type VoiceLanguage = 'en-US';

class SpeechService {
  private synth: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];
  private voiceListeners = new Set<() => void>();

  constructor() {
    this.synth = window.speechSynthesis;
    this.loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => {
        this.loadVoices();
        this.voiceListeners.forEach(listener => listener());
      };
    }
  }

  private loadVoices = () => {
    this.voices = this.synth.getVoices();
  };

  public speak(text: string, lang: VoiceLanguage, rate: number = 1, voiceName?: string) {
    // Cancel any ongoing speech
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Find suitable voice
    const voice = this.voices.find(v => v.name === voiceName && v.lang === lang)
      ?? this.voices.find(v => v.name === 'Google US English' && v.lang === lang)
      ?? this.voices.find(v => v.lang === lang);
    if (voice) {
      utterance.voice = voice;
    }
    
    utterance.lang = lang;
    utterance.rate = rate;
    
    this.synth.speak(utterance);
  }

  public stop() {
    this.synth.cancel();
  }

  public getVoicesByLang(lang: string) {
    return this.voices.filter(v => v.lang.startsWith(lang));
  }

  public subscribeToVoices(listener: () => void) {
    this.voiceListeners.add(listener);
    return () => {
      this.voiceListeners.delete(listener);
    };
  }
}

export const speechService = new SpeechService();
