/**
 * SpeechService - Wrapper for Web Speech API
 */

export type VoiceLanguage = 'en-US' | 'vi-VN';

class SpeechService {
  private synth: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.synth = window.speechSynthesis;
    this.loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = this.loadVoices;
    }
  }

  private loadVoices = () => {
    this.voices = this.synth.getVoices();
  };

  public speak(text: string, lang: VoiceLanguage, rate: number = 1) {
    // Cancel any ongoing speech
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Find suitable voice
    const voice = this.voices.find(v => v.lang === lang);
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
}

export const speechService = new SpeechService();
