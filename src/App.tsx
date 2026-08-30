import { useState, useEffect, useCallback, useRef } from 'react';
import { speechService } from './services/speechService';
import type { VoiceLanguage } from './services/speechService';
import DictationArea from './components/DictationArea/DictationArea';
import Controls from './components/Controls/Controls';
import './styles/globals.css';
import './App.css';
import SAMPLE_SENTENCES, { type Difficulty } from './components/Stats/SampleSentence';

const DEFAULT_TIME_LIMIT = 30;
const LANG: VoiceLanguage = 'en-US';
const DEFAULT_DIFFICULTY: Difficulty = 'easy';
const SPEECH_SPEEDS = [0.5, 0.75, 1, 1.25];
const getRandomSentenceIndex = (difficulty: Difficulty, currentIndex?: number) => {
  const sentenceCount = SAMPLE_SENTENCES[LANG][difficulty].length;
  if (sentenceCount < 2) return 0;

  let nextIndex = Math.floor(Math.random() * sentenceCount);
  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * sentenceCount);
  }
  return nextIndex;
};

function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY);
  const [currentIndex, setCurrentIndex] = useState(() => getRandomSentenceIndex(DEFAULT_DIFFICULTY));
  const [speed, setSpeed] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const speakTimeoutRef = useRef<number | null>(null);

  const currentSentence = SAMPLE_SENTENCES[LANG][difficulty][currentIndex];

  useEffect(() => {
    const updateVoices = () => {
      const availableVoices = speechService.getVoicesByLang(LANG);
      setVoices(availableVoices);
      setSelectedVoice(current => current || availableVoices.find(voice => voice.name === 'Google US English')?.name || '');
    };
    updateVoices();
    return speechService.subscribeToVoices(updateVoices);
  }, []);

  useEffect(() => {
    if (!isSettingsOpen) return;

    const closeSettings = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.settings-panel, .settings-toggle')) {
        setIsSettingsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSettingsOpen(false);
    };

    document.addEventListener('mousedown', closeSettings);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', closeSettings);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isSettingsOpen]);

  const resetStats = useCallback((nextTimeLimit = timeLimit) => {
    setCorrectChars(0);
    setTimeLeft(nextTimeLimit);
    setTypingSpeed(0);
    setStartedAt(null);
    setHasStartedTyping(false);
  }, [timeLimit]);

  const handleSpeak = useCallback(() => {
    if (speakTimeoutRef.current !== null) {
      window.clearTimeout(speakTimeoutRef.current);
    }
    speechService.stop();
    speakTimeoutRef.current = window.setTimeout(() => {
      speechService.speak(currentSentence, LANG, speed, selectedVoice);
      speakTimeoutRef.current = null;
    }, 120);
  }, [currentSentence, selectedVoice, speed]);

  useEffect(() => {
    if (speakTimeoutRef.current !== null) {
      window.clearTimeout(speakTimeoutRef.current);
    }
    speechService.stop();
    speakTimeoutRef.current = window.setTimeout(() => {
      speechService.speak(currentSentence, LANG, speed, selectedVoice);
      speakTimeoutRef.current = null;
    }, 120);

    return () => {
      if (speakTimeoutRef.current !== null) {
        window.clearTimeout(speakTimeoutRef.current);
        speakTimeoutRef.current = null;
      }
    };
    // Voice and speed changes should apply on the next manual replay,
    // not trigger an automatic repeat of the current sentence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSentence]);

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
    setCurrentIndex(getRandomSentenceIndex(difficulty, currentIndex));
    setIsCompleted(false);
    setIsTimeUp(timeLeft === 0);
    setKey(prev => prev + 1);
  };

  const handleDifficultyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextDifficulty = event.target.value as Difficulty;
    setDifficulty(nextDifficulty);
    setCurrentIndex(getRandomSentenceIndex(nextDifficulty));
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
        <button type="button" className="settings-toggle" onClick={() => setIsSettingsOpen(open => !open)} aria-expanded={isSettingsOpen} aria-controls="settings-menu">
          <span aria-hidden="true">⚙</span> Settings
        </button>
      </header>
      {isSettingsOpen && (
        <section id="settings-menu" className="settings-panel" aria-label="Settings">
          <label className="settings-field">
            <span>Level</span>
            <select value={difficulty} onChange={handleDifficultyChange}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Voice</span>
            <select value={selectedVoice} onChange={event => setSelectedVoice(event.target.value)} disabled={voices.length === 0}>
              <option value="">Browser default voice</option>
              {voices.map(voice => <option key={`${voice.name}-${voice.voiceURI}`} value={voice.name}>{voice.name}</option>)}
            </select>
          </label>
          <div className="settings-field settings-speed-field">
            <span>speed</span>
            <div className="settings-speed-options">
              {SPEECH_SPEEDS.map(option => (
                <button
                  key={option}
                  type="button"
                  className={speed === option ? 'active' : ''}
                  onClick={() => setSpeed(option)}
                >
                  {option}x
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
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
      
         {/* <div className="status-badge">{isCompleted ? '🎉 Done! Perfect!' : '🎧 Listen and type...' }</div> */}
         <div className="status-badge">
            {isTimeUp && !isCompleted ? (
           <>
                <span aria-hidden="true">⏰</span> <strong>Time’s up</strong> — Choose Reset Timer to try again.
            </>
           ) : isCompleted ? '🎉 Done! Perfect!' : '🎧 Listen and type...'}
        </div>
        {/* {isCompleted && isTimeUp && (
          <div className="completion-notice" role="status">
            <strong>Excellent work!</strong>
            <span>You completed the sentence perfectly.</span>
            <small>Typing speed: {typingSpeed.toFixed(1)} WPM</small>
          </div>
        )}
        {isTimeUp && !isCompleted && (
          <div className="time-up-notice" role="alert">
            <strong>Time’s up</strong>
            <span>Your sentence wasn’t completed.</span>
            <small>Choose Reset Timer to try again.</small>
          </div>
        )} */}
        <button type="button" className="reset-timer-btn" onClick={handleResetTimer}>
               Reset Timer
           </button>
        <DictationArea key={key} targetText={currentSentence} onComplete={() => setIsCompleted(true)} onNext={handleNext} onTypingChange={handleTypingChange} isHidden={isSentenceHidden} disabled={isTimeUp} />
          <button type="button" className="visibility-toggle" onClick={() => setIsSentenceHidden(prev => !prev)}>
          {isSentenceHidden ? 'Show sentence' : 'Hide sentence'}
        </button>
        <Controls onReplay={handleSpeak} onNext={handleNext} />
        
      </main>
      <footer className="app-footer"><p>Tip: Focus on the sounds, then the letters.</p></footer>
    </div>
  );
}

export default App;
