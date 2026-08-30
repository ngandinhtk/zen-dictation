class SoundService {
  private context: AudioContext | null = null;

  private getContext() {
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
    return this.context;
  }

  private playTone(frequency: number, duration: number, type: OscillatorType, volume: number) {
    const context = this.getContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  public playTyping() {
    this.playTone(720, 0.035, 'sine', 0.025);
  }

  public playWrong() {
    const isBoing = Math.random() > 0.5;
    if (isBoing) {
      this.playTone(520, 0.08, 'triangle', 0.04);
      window.setTimeout(() => this.playTone(260, 0.14, 'triangle', 0.035), 65);
      window.setTimeout(() => this.playTone(150, 0.18, 'sine', 0.025), 125);
    } else {
      this.playTone(390, 0.1, 'square', 0.028);
      window.setTimeout(() => this.playTone(300, 0.1, 'square', 0.024), 75);
      window.setTimeout(() => this.playTone(210, 0.16, 'triangle', 0.03), 150);
    }
  }

  public playSuccess() {
    // Ascending tones for a satisfying completion sound
    this.playTone(523, 0.1, 'sine', 0.04);
    window.setTimeout(() => this.playTone(659, 0.1, 'sine', 0.04), 110);
    window.setTimeout(() => this.playTone(784, 0.15, 'sine', 0.05), 220);
  }

  public playTimeUp() {
    // Descending alert sound for time running out
    this.playTone(800, 0.12, 'sine', 0.05);
    window.setTimeout(() => this.playTone(600, 0.12, 'sine', 0.05), 130);
    window.setTimeout(() => this.playTone(400, 0.2, 'sine', 0.06), 260);
  }
}

export const soundService = new SoundService();
