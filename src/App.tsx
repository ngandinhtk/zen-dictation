import { useState, useEffect, useCallback } from 'react';
import { speechService } from './services/speechService';
import type { VoiceLanguage } from './services/speechService';
import DictationArea from './components/DictationArea/DictationArea';
import Controls from './components/Controls/Controls';
import './styles/globals.css';
import './App.css';
import SAMPLE_SENTENCES from './components/Stats/SampleSentence';

const DEFAULT_TIME_LIMIT = 30;

function App() {
  const [lang, setLang] = useState<VoiceLanguage>('en-US');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isCompleted, setIsCompleted] = useState(false);
  const [key, setKey] = useState(0); // For resetting DictationArea
  const [correctChars, setCorrectChars] = useState(0);
  const [timeLimit, setTimeLimit] = useState(DEFAULT_TIME_LIMIT);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME_LIMIT);
  const [typingSpeed, setTypingSpeed] = useState(0);
  // const [accuracy, setAccuracy] = useState(100);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [isSentenceHidden, setIsSentenceHidden] = useState(false);

  const currentSentence = SAMPLE_SENTENCES[lang][currentIndex];

  const resetStats = useCallback((nextTimeLimit = timeLimit) => {
    setCorrectChars(0);
    setTimeLeft(nextTimeLimit);
    setTypingSpeed(0);
    // setAccuracy(100);
    setStartedAt(null);
    setHasStartedTyping(false);
  }, [timeLimit]);

  const handleSpeak = useCallback(() => {
    speechService.speak(currentSentence, lang, speed);
  }, [currentSentence, lang, speed]);

  useEffect(() => {
    // Speak the first sentence when language or index changes
    handleSpeak();
  }, [handleSpeak]);

  useEffect(() => {
    if (!hasStartedTyping || !startedAt) {
      return;
    }

    const tick = () => {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const remainingSeconds = Math.max(0, timeLimit - elapsedSeconds);
      const minutes = Math.max(elapsedSeconds / 60, 1 / 60);
      const nextSpeed = correctChars > 0 ? (correctChars / 5) / minutes : 0;

      setTimeLeft(remainingSeconds);
      setTypingSpeed(nextSpeed);
    };

    tick();
    const intervalId = window.setInterval(tick, 250);

    return () => window.clearInterval(intervalId);
  }, [correctChars, hasStartedTyping, startedAt, timeLimit]);

  const handleNext = () => {
    const nextIndex = (currentIndex + 1) % SAMPLE_SENTENCES[lang].length;
    setCurrentIndex(nextIndex);
    setIsCompleted(false);
    resetStats();
    setKey(prev => prev + 1);
  };

  const handleLanguageToggle = () => {
    setLang(prev => prev === 'en-US' ? 'vi-VN' : 'en-US');
    setCurrentIndex(0);
    setIsCompleted(false);
    resetStats();
    setKey(prev => prev + 1);
  };

  const handleTimeLimitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    const safeValue = Number.isFinite(nextValue) ? Math.min(Math.max(nextValue, 10), 180) : DEFAULT_TIME_LIMIT;

    setTimeLimit(safeValue);
    resetStats(safeValue);
    setKey(prev => prev + 1);
  };

  const handleTypingChange = (nextValue: string) => {
    const nextCorrectChars = Array.from(nextValue).reduce((count, char, index) => {
      const targetChar = currentSentence[index];
      return count + (targetChar && char.toLowerCase() === targetChar.toLowerCase() ? 1 : 0);
    }, 0);

    // const nextAccuracy = nextValue.length > 0 ? (nextCorrectChars / nextValue.length) * 100 : 100;

    setCorrectChars(nextCorrectChars);
    // setAccuracy(nextAccuracy);

    if (nextValue.length > 0 && !hasStartedTyping) {
      setHasStartedTyping(true);
      setStartedAt(Date.now());
    }

    if (nextValue.length === 0) {
      setHasStartedTyping(false);
      setStartedAt(null);
      setTypingSpeed(0);
      setTimeLeft(timeLimit);
      // setAccuracy(100);
      setCorrectChars(0);
    }
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1 className="logo">Zen Dictation</h1>
        <button className="lang-toggle" type="button" onClick={handleLanguageToggle}>
          {lang === 'en-US' ? '🇬🇧 English' : '🇻🇳 Tiếng Việt'}
        </button>
      </header>

      <main className="app-content">
        <div className="stats-row">
          <div>
            <span className="stat-label">Typing speed</span>
            <strong>{typingSpeed.toFixed(1)} WPM</strong>
          </div>
          <div>
            <span className="stat-label">Time limit</span>
            <div className="time-limit-control">
              <input
                type="number"
                min={10}
                max={180}
                step={5}
                value={timeLimit}
                onChange={handleTimeLimitChange}
                aria-label="Custom time limit in seconds"
              />
              <span>s</span>
            </div>
            <strong>{hasStartedTyping ? `${timeLeft}s left` : 'Waiting...'}</strong>
          </div>
        </div>

        <div className="status-badge">
          {isCompleted ? '🎉 Done! Perfect!' : '🎧 Listen and type...'}
        </div>

        <button
          type="button"
          className="visibility-toggle"
          onClick={() => setIsSentenceHidden(prev => !prev)}
        >
          {isSentenceHidden ? 'Show sentence' : 'Hide sentence'}
        </button>

        <DictationArea 
          key={key}
          targetText={currentSentence} 
          onComplete={() => setIsCompleted(true)} 
          onNext={handleNext}
          onTypingChange={handleTypingChange}
          isHidden={isSentenceHidden}
        />

        <Controls 
          onReplay={handleSpeak}
          speed={speed}
          onSpeedChange={setSpeed}
          onNext={handleNext}
        />
      </main>

      <footer className="app-footer">
        <p>Tip: Focus on the sounds, then the letters.</p>
      </footer>
    </div>
  );
}

export default App;
