import { useState, useEffect, useCallback, useRef } from 'react';
import { speechService } from './services/speechService';
import { soundService } from './services/soundService';
import type { VoiceLanguage } from './services/speechService';
import DictationArea from './components/DictationArea/DictationArea';
import Controls from './components/Controls/Controls';
import './styles/globals.css';
import './App.css';
import SAMPLE_SENTENCES, { type Difficulty } from './components/Stats/SampleSentence';
import { getGoalWpm, getPracticeHistory, getPracticeStreak, saveGoalWpm, savePracticeSession, type PracticeSession } from './services/premiumService';
import PremiumDashboard from './components/PremiumDashboard/PremiumDashboard';
import { getPremiumEntitlement, setPremiumPreview } from './services/premiumAccess';
import { getCurrentAccount, logoutAccount, type AccountUser } from './services/accountService';
import AccountPanel from './components/AccountPanel/AccountPanel';

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
  const [isPremium, setIsPremium] = useState(() => getPremiumEntitlement().isPremium);
  const [isPremiumOpen, setIsPremiumOpen] = useState(() => window.location.hash === '#premium');
  const [goalWpm, setGoalWpm] = useState(getGoalWpm);
  const [practiceHistory, setPracticeHistory] = useState<PracticeSession[]>(getPracticeHistory);
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem('zen-dictation-onboarding-seen') !== 'true');
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const openPremiumDashboard = () => {
    window.history.pushState({}, '', '#premium');
    setIsPremiumOpen(true);
  };
  const closePremiumDashboard = () => {
    window.history.pushState({}, '', window.location.pathname + window.location.search);
    setIsPremiumOpen(false);
  };
  const speakTimeoutRef = useRef<number | null>(null);
  const timeUpSoundPlayedRef = useRef(false);

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
    getCurrentAccount().then(setAccountUser);
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

  useEffect(() => {
    if (isTimeUp && !timeUpSoundPlayedRef.current) {
      soundService.playTimeUp();
      timeUpSoundPlayedRef.current = true;
    }
    if (!isTimeUp) {
      timeUpSoundPlayedRef.current = false;
    }
  }, [isTimeUp]);

  const handleNext = () => {
    setCurrentIndex(getRandomSentenceIndex(difficulty, currentIndex));
    setIsCompleted(false);
    setIsTimeUp(timeLeft === 0);
    setKey(prev => prev + 1);
  };

  const handleDifficultyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextDifficulty = event.target.value as Difficulty;
    if (nextDifficulty === 'hard' && !isPremium) {
      openPremiumDashboard();
      return;
    }
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

  const recordPremiumSession = (completedText: string, correctCharacters: number) => {
    const elapsedMinutes = startedAt ? Math.max((Date.now() - startedAt) / 60000, 1 / 60) : 1 / 60;
    setPracticeHistory(savePracticeSession({
      date: new Date().toISOString(),
      difficulty,
      wpm: Math.round((completedText.length / 5) / elapsedMinutes),
      accuracy: Math.round((correctCharacters / Math.max(currentSentence.length, 1)) * 100),
    }));
  };

  const handlePremiumComplete = (completedText = currentSentence, correctCharacters = currentSentence.length) => {
    recordPremiumSession(completedText, correctCharacters);
    setIsCompleted(true);
  };

  const handlePremiumFinish = (completedText: string, correctCharacters: number, isCorrect: boolean) => {
    if (!isCorrect) recordPremiumSession(completedText, correctCharacters);
  };

  const handlePremiumPreview = () => {
    const next = !isPremium;
    setIsPremium(next);
    setPremiumPreview(next);
    if (!next && difficulty === 'hard') {
      setDifficulty('medium');
      setCurrentIndex(getRandomSentenceIndex('medium'));
      setIsCompleted(false);
      setIsTimeUp(false);
      setKey(prev => prev + 1);
    }
  };

  const handleGoalChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGoalWpm(saveGoalWpm(Number(event.target.value)));
  };

  const bestWpm = practiceHistory.length ? Math.max(...practiceHistory.map(session => session.wpm)) : 0;
  const averageAccuracy = practiceHistory.length
    ? Math.round(practiceHistory.reduce((total, session) => total + session.accuracy, 0) / practiceHistory.length)
    : 0;
  const practiceStreak = getPracticeStreak(practiceHistory);

  if (isPremiumOpen) {
    return <PremiumDashboard
      isPremium={isPremium}
      goalWpm={goalWpm}
      bestWpm={bestWpm}
      averageAccuracy={averageAccuracy}
      practiceStreak={practiceStreak}
      practiceHistory={practiceHistory}
      onGoalChange={handleGoalChange}
      onPremiumPreview={handlePremiumPreview}
      onBack={closePremiumDashboard}
    />;
  }

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
        <div className="header-actions">
          <button type="button" className="account-toggle" onClick={() => setIsAccountOpen(open => !open)} aria-expanded={isAccountOpen} aria-controls="account-menu">
            {accountUser ? accountUser.email.split('@')[0] : 'Account'}
          </button>
          <button type="button" className={'premium-toggle ' + (isPremium ? 'active' : '')} onClick={openPremiumDashboard} aria-expanded={isPremiumOpen}>
            <span aria-hidden="true">✦</span> {isPremium ? 'Premium' : 'Premium preview'}
          </button>
          <button type="button" className="settings-toggle" onClick={() => setIsSettingsOpen(open => !open)} aria-expanded={isSettingsOpen} aria-controls="settings-menu">
          <span aria-hidden="true">⚙</span> Settings
        </button>
        </div>
      </header>
      {isAccountOpen && (
        <section id="account-menu" className="account-menu" aria-label="Account">
          <AccountPanel user={accountUser} onAuthenticated={user => { setAccountUser(user); setIsAccountOpen(false); }} onLogout={() => { void logoutAccount(); setAccountUser(null); }} />
        </section>
      )}
      {showOnboarding && (
        <section className="onboarding-card" aria-label="How to practice">
          <div><span className="premium-kicker">Welcome to Zen Dictation</span><h2>Three quiet steps to better listening.</h2><p>Listen, type what you hear, then use the feedback to improve your accuracy and speed.</p></div>
          <div className="onboarding-steps"><span><b>1</b> Listen</span><span><b>2</b> Type</span><span><b>3</b> Improve</span></div>
          <button type="button" onClick={() => { localStorage.setItem('zen-dictation-onboarding-seen', 'true'); setShowOnboarding(false); }}>Start practicing</button>
        </section>
      )}
      {isPremiumOpen && (
        <section className="premium-panel" aria-label="Premium features">
          {isPremium ? (
            <>
              <div className="premium-heading"><span className="premium-kicker">Zen Dictation Premium</span><strong>Your learning dashboard</strong></div>
              <div className="premium-metrics">
                <div><span>Best speed</span><strong>{bestWpm || '—'} <small>WPM</small></strong></div>
                <div><span>Accuracy</span><strong>{averageAccuracy || '—'}<small>%</small></strong></div>
                <div><span>Sessions</span><strong>{practiceHistory.length}</strong></div>
              </div>
              <label className="goal-control">Daily speed goal <input type="number" min="10" max="200" value={goalWpm} onChange={handleGoalChange} /> WPM</label>
              <div className="history-heading"><span>Recent sessions</span><small>Saved on this device</small></div>
              {practiceHistory.length === 0 ? <p className="premium-empty">Complete a practice sentence to start your personal history.</p> : <div className="history-list">{practiceHistory.slice(0, 5).map(session => <div className="history-row" key={session.id}><span>{new Date(session.date).toLocaleDateString()} · {session.difficulty}</span><strong>{session.wpm} WPM · {session.accuracy}%</strong></div>)}</div>}
              <button type="button" className="premium-secondary" onClick={handlePremiumPreview}>Turn off preview</button>
            </>
          ) : (
            <div className="premium-upsell">
              <span className="premium-kicker">Zen Dictation Premium</span>
              <strong>See your progress. Improve with purpose.</strong>
              <p>Turn every practice session into a clear, measurable learning habit.</p>
              <div className="premium-benefits">
                <div><span className="benefit-icon" aria-hidden="true">↗</span><span><strong>Know your real progress</strong><small>Track your best speed and average accuracy over time.</small></span></div>
                <div><span className="benefit-icon" aria-hidden="true">▤</span><span><strong>Never lose a practice session</strong><small>Keep a personal history of your latest 30 results.</small></span></div>
                <div><span className="benefit-icon" aria-hidden="true">◎</span><span><strong>Set a goal that keeps you moving</strong><small>Choose a WPM target and make each session count.</small></span></div>
                <div><span className="benefit-icon" aria-hidden="true">✦</span><span><strong>Make practice feel rewarding</strong><small>See your milestones in one calm, focused dashboard.</small></span></div>
              </div>
              <button type="button" className="premium-cta" onClick={handlePremiumPreview}>Explore Premium preview</button>
              <small className="premium-note">One-time unlock coming soon · No payment required in preview</small>
            </div>
          )}
        </section>
      )}
      {isSettingsOpen && (
        <section id="settings-menu" className="settings-panel" aria-label="Settings">
          <label className="settings-field">
            <span>Level</span>
            <select value={difficulty} onChange={handleDifficultyChange}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard" disabled={!isPremium}>Hard {isPremium ? '' : '(Premium)'}</option>
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
          <label className="settings-field premium-preview-field"><span>Premium preview</span><input type="checkbox" checked={isPremium} onChange={handlePremiumPreview} /></label>
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
         <div className="status-badge" role="status" aria-live="polite">
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
        <DictationArea key={key} targetText={currentSentence} onComplete={isPremium ? handlePremiumComplete : () => setIsCompleted(true)} onFinish={isPremium ? handlePremiumFinish : undefined} onNext={handleNext} onTypingChange={handleTypingChange} isHidden={isSentenceHidden} disabled={isTimeUp} />
          <button type="button" className="visibility-toggle" onClick={() => setIsSentenceHidden(prev => !prev)} aria-pressed={isSentenceHidden}>
          {isSentenceHidden ? 'Show sentence' : 'Hide sentence'}
        </button>
        <Controls onReplay={handleSpeak} onNext={handleNext} />
        
      </main>
      <footer className="app-footer"><p>Tip: Focus on the sounds, then the letters.</p></footer>
    </div>
  );
}

export default App;
