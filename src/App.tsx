import { useState, useEffect, useCallback } from 'react';
import { speechService } from './services/speechService';
import type { VoiceLanguage } from './services/speechService';
import DictationArea from './components/DictationArea/DictationArea';
import Controls from './components/Controls/Controls';
import './styles/globals.css';
import './App.css';
import SAMPLE_SENTENCES from './components/Stats/SampleSentence';

const DEFAULT_TIME_LIMIT = 30;
const LANG: VoiceLanguage = 'en-US';
const getRandomSentenceIndex = (currentIndex?: number) => {
  const sentenceCount = SAMPLE_SENTENCES[LANG].length;
  if (sentenceCount < 2) return 0;

  let nextIndex = Math.floor(Math.random() * sentenceCount);
  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * sentenceCount);
  }
  return nextIndex;
};

function App() {
  const [currentIndex, setCurrentIndex] = useState(() => getRandomSentenceIndex());
  const [speed, setSpeed] = useState(1);
  const [isCompleted, setIsCompleted] = useState(false);
  const [key, setKey] = useState(0);
  const [correctChars, setCorrectChars] = useState(0);
  const [timeLimit, setTimeLimit] = useState(DEFAULT_TIME_LIMIT);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME_LIMIT);
  const [typingSpeed, setTypingSpeed] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [isSentenceHidden, setIsSentenceHidden] = useState(false);

  const currentSentence = SAMPLE_SENTENCES[LANG][currentIndex];

  const resetStats = useCallback((nextTimeLimit = timeLimit) => {
    setCorrectChars(0);
    setTimeLeft(nextTimeLimit);
    setTypingSpeed(0);
    setStartedAt(null);
    setHasStartedTyping(false);
  }, [timeLimit]);

  const handleSpeak = useCallback(() => {
    speechService.stop();
    window.setTimeout(() => speechService.speak(currentSentence, LANG, speed), 120);
  }, [currentSentence, speed]);

  useEffect(() => { handleSpeak(); }, [handleSpeak]);

  useEffect(() => {
    const handleControlKey = (event: KeyboardEvent) => {
      if (event.key === 'Control' && !event.repeat) {
        handleSpeak();
      }
    };

    window.addEventListener('keydown', handleControlKey);
    return () => window.removeEventListener('keydown', handleControlKey);
  }, [handleSpeak]);

  useEffect(() => {
    if (!hasStartedTyping || !startedAt) return;
    const tick = () => {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const remainingSeconds = Math.max(0, timeLimit - elapsedSeconds);
      const minutes = Math.max(elapsedSeconds / 60, 1 / 60);
      setTimeLeft(remainingSeconds);
      setTypingSpeed(correctChars > 0 ? (correctChars / 5) / minutes : 0);
      if (remainingSeconds === 0) {
        setIsTimeUp(true);
        setHasStartedTyping(false);
        setStartedAt(null);
      }
    };
    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [correctChars, hasStartedTyping, startedAt, timeLimit]);

  const handleNext = () => {
    setCurrentIndex(getRandomSentenceIndex(currentIndex));
    setIsCompleted(false);
    setIsTimeUp(timeLeft === 0);
    setKey(prev => prev + 1);
  };

  const handleTimeLimitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    const safeValue = Number.isFinite(nextValue) ? Math.min(Math.max(nextValue, 10), 180) : DEFAULT_TIME_LIMIT;
    setTimeLimit(safeValue);
    setIsTimeUp(false);
    resetStats(safeValue);
    setKey(prev => prev + 1);
  };

  const handleResetTimer = () => {
    setIsCompleted(false);
    setIsTimeUp(false);
    resetStats(timeLimit);
    setKey(prev => prev + 1);
  };

  const handleTypingChange = (nextValue: string) => {
    if (isTimeUp) return;
    const nextCorrectChars = Array.from(nextValue).reduce((count, char, index) => {
      const targetChar = currentSentence[index];
      return count + (targetChar && char.toLowerCase() === targetChar.toLowerCase() ? 1 : 0);
    }, 0);
    setCorrectChars(nextCorrectChars);
    if (nextValue.length > 0 && !hasStartedTyping) {
      setHasStartedTyping(true);
      setStartedAt(Date.now());
    }
    if (nextValue.length === 0) {
      setHasStartedTyping(false);
      setStartedAt(null);
      setTypingSpeed(0);
      setTimeLeft(timeLimit);
      setCorrectChars(0);
    }
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1 className="logo">Zen Dictation</h1>
      </header>
      <main className="app-content">
        <div className="stats-row">
          <div className="time-limit-control" ><span className="stat-label">Typing speed</span><strong>{typingSpeed.toFixed(1)} WPM</strong></div>
          <div>
            
            <div className="time-limit-control"> <span className="stat-label">Time limit</span>
              <input type="number" min={10} max={180} step={5} value={timeLimit} onChange={handleTimeLimitChange} aria-label="Custom time limit in seconds" />
              <span>s</span>
            </div>
            <strong>{hasStartedTyping ? `${timeLeft}s left` : 'Waiting...'}</strong>
          
          </div>
        </div>
        <div className="status-badge">{isCompleted ? '🎉 Done! Perfect!' : '🎧 Listen and type...'}</div>
        {isTimeUp && <div className="time-up-notice" role="alert">Time is up! Click Reset to try again!</div>}
        <button type="button" className="reset-timer-btn" onClick={handleResetTimer}>
               Reset Timer
           </button>
        <DictationArea key={key} targetText={currentSentence} onComplete={() => setIsCompleted(true)} onNext={handleNext} onTypingChange={handleTypingChange} isHidden={isSentenceHidden} disabled={isTimeUp} />
          <button type="button" className="visibility-toggle" onClick={() => setIsSentenceHidden(prev => !prev)}>
          {isSentenceHidden ? 'Show sentence' : 'Hide sentence'}
        </button>
        <Controls onReplay={handleSpeak} speed={speed} onSpeedChange={setSpeed} onNext={handleNext} />
        
      </main>
      <footer className="app-footer"><p>Tip: Focus on the sounds, then the letters.</p></footer>
    </div>
  );
}

export default App;
