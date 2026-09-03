import { useState, useEffect, useCallback, useRef } from 'react';
import { speechService } from './services/speechService';
import { soundService } from './services/soundService';
import type { SpeechStatus, VoiceLanguage } from './services/speechService';
import DictationArea from './components/DictationArea/DictationArea';
import Controls from './components/Controls/Controls';
import './styles/globals.css';
import './App.css';
import SAMPLE_SENTENCES, { CAMBRIDGE_LEVELS, VOCABULARY_SENTENCES_TEXT as VOCABULARY_SENTENCES } from './data/sentenceBank';
import {  type Difficulty } from './utils/sentenceTranslations';
import { analyzeAttempt, type AttemptAnalysis } from './utils/textUtils';
import { addReviewWord, getDueReviewWords, getReviewSummary, getReviewWords, recordWordAttempt, removeReviewWord, saveReviewNoteForAttempt, updateReviewWord, type ReviewWord } from './services/spacedRepetitionService';
import { addPoints, claimDailyTargetReward, getDailyTarget, getPoints, getUnlockedAchievements, PERFECT_SENTENCE_POINTS, subtractPoints, TIMEOUT_PENALTY_POINTS, updateDailyTargetProgress } from './services/pointsService';
import { getGoalWpm, getPracticeHistory, getPracticeStreak, saveGoalWpm, savePracticeSession, type PracticeSession } from './services/premiumService';
import PremiumDashboard from './components/PremiumDashboard/PremiumDashboard';
import ReviewPage from './components/ReviewPage/ReviewPage';
import { getPremiumStatus } from './services/premiumAccess';
import { getAccountSessions, getCurrentAccount, saveAccountSession, type AccountUser } from './services/accountService';
import Header from './components/Header/Header';
import PaymentPage, { PaymentResultPage } from './components/PaymentPage/PaymentPage';

const DEFAULT_TIME_LIMIT = 30;
const LANG: VoiceLanguage = 'en-US';
const DEFAULT_DIFFICULTY: Difficulty = 'easy';
const SPEECH_SPEEDS = [0.5, 0.75, 1, 1.25];
const ACHIEVEMENT_TOAST_DURATION_MS = 8000;
type PracticeFocus = 'mixed' | 'vocabulary';
const getRandomSentenceIndex = (sentences: string[], currentIndex?: number) => {
  const sentenceCount = sentences.length;
  if (sentenceCount < 2) return 0;

  let nextIndex = Math.floor(Math.random() * sentenceCount);
  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * sentenceCount);
  }
  return nextIndex;
};

const shuffleSentenceIndices = (sentences: string[], excludedIndex?: number) => {
  const indices = Array.from({ length: sentences.length }, (_, index) => index)
    .filter(index => index !== excludedIndex);
  for (let index = indices.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [indices[index], indices[swapIndex]] = [indices[swapIndex], indices[index]];
  }
  return indices;
};

function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY);
  const [practiceFocus, setPracticeFocus] = useState<PracticeFocus>('mixed');
  const [currentIndex, setCurrentIndex] = useState(() => getRandomSentenceIndex(SAMPLE_SENTENCES[LANG][DEFAULT_DIFFICULTY]));
  const [speed, setSpeed] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceStatus, setVoiceStatus] = useState<SpeechStatus>(() => speechService.getStatus());
  const [selectedVoice, setSelectedVoice] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<AttemptAnalysis | null>(null);
  const [reviewSummary, setReviewSummary] = useState<ReturnType<typeof getReviewSummary>>(() => getReviewSummary());
  const [reviewWords, setReviewWords] = useState<ReviewWord[]>(getReviewWords);
  const [reviewNow] = useState(() => Date.now());
  const [lastAttemptText, setLastAttemptText] = useState('');
  const [lastAttemptTargetText, setLastAttemptTargetText] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [isReviewNoteSaved, setIsReviewNoteSaved] = useState(false);
  const [points, setPoints] = useState(getPoints);
  const [dailyTarget, setDailyTarget] = useState(() => getDailyTarget());
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
  const [isPremium, setIsPremium] = useState(false);
  const [isPremiumOpen, setIsPremiumOpen] = useState(() => window.location.hash === '#premium');
  const [isPaymentOpen, setIsPaymentOpen] = useState(() => window.location.hash === '#payment');
  const [isPaymentResultOpen, setIsPaymentResultOpen] = useState(() => window.location.hash === '#payment-result');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(() => window.location.hash === '#review');
  // const [showTranslation, setShowTranslation] = useState(false);
  const [reviewWord, setReviewWord] = useState<string | undefined>();
  const [focusTimeLeft, setFocusTimeLeft] = useState(20 * 60);
  const [goalWpm, setGoalWpm] = useState(getGoalWpm);
  const [practiceHistory, setPracticeHistory] = useState<PracticeSession[]>(getPracticeHistory);
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem('zen-dictation-onboarding-seen') !== 'true');
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [achievementToast, setAchievementToast] = useState<{ title: string; description: string; icon: string } | null>(null);
  const unlockedAchievementIdsRef = useRef<Set<string> | null>(null);
  const openPremiumDashboard = () => {
    window.history.pushState({}, '', '#premium');
    setIsPremiumOpen(true);
  };
  const closePremiumDashboard = () => {
    window.history.pushState({}, '', window.location.pathname + window.location.search);
    setIsPremiumOpen(false);
  };
  const openPaymentPage = () => {
    window.history.pushState({}, '', '#payment');
    setIsPaymentOpen(true);
  };
  const closePaymentPage = () => {
    window.history.pushState({}, '', window.location.pathname + window.location.search);
    setIsPaymentOpen(false);
  };
  const closePaymentResult = () => {
    window.history.pushState({}, '', window.location.pathname + window.location.search);
    setIsPaymentResultOpen(false);
  };
  const startFocusSession = (durationMinutes: number) => {
    if (!isPremium) {
      setIsPremiumOpen(false);
      openPaymentPage();
      return;
    }
    setFocusTimeLeft(durationMinutes * 60);
    setIsFocusMode(true);
    setIsCompleted(false);
    setIsTimeUp(false);
    resetStats(timeLimit);
    setIsPremiumOpen(false);
    setIsSettingsOpen(false);
    setIsAccountOpen(false);
    window.history.pushState({}, '', '#focus');
  };
  const exitFocusMode = () => {
    setIsFocusMode(false);
    window.history.pushState({}, '', window.location.pathname + window.location.search);
  };
  const openReviewPage = (word?: string) => {
    window.history.pushState({}, '', '#review');
    setIsSettingsOpen(false);
    setReviewWord(word);
    setIsReviewOpen(true);
  };
  const closeReviewPage = () => {
    window.history.pushState({}, '', window.location.pathname + window.location.search);
    setReviewWord(undefined);
    setIsReviewOpen(false);
  };
  const handleAddReviewWord = (word: string) => {
    const nextWords = addReviewWord(word);
    setReviewWords(nextWords.filter(review => review.mistakes > 0));
    setReviewSummary(getReviewSummary());
  };
  const handleUpdateReviewWord = (currentWord: string, nextWord: string, note: string) => {
    const nextWords = updateReviewWord(currentWord, nextWord, note);
    setReviewWords(nextWords.filter(review => review.mistakes > 0));
    setReviewSummary(getReviewSummary());
  };
  const handleRemoveReviewWord = (word: string) => {
    const nextWords = removeReviewWord(word);
    setReviewWords(nextWords.filter(review => review.mistakes > 0));
    setReviewSummary(getReviewSummary());
  };
  const startDueWordPractice = (word: string) => {
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordPattern = new RegExp(`\\b${escapedWord}\\b`, 'i');
    const availableDifficulties: Difficulty[] = isPremium ? ['easy', 'medium', 'hard'] : ['easy'];
    const matchingDifficulty = availableDifficulties.find(level => {
      const pool = practiceFocus === 'vocabulary' ? VOCABULARY_SENTENCES[LANG][level] : SAMPLE_SENTENCES[LANG][level];
      return pool.some(sentence => wordPattern.test(sentence));
    });
    const nextDifficulty = matchingDifficulty || difficulty;
    const nextPool = practiceFocus === 'vocabulary' ? VOCABULARY_SENTENCES[LANG][nextDifficulty] : SAMPLE_SENTENCES[LANG][nextDifficulty];
    const matchingIndex = nextPool.findIndex(sentence => wordPattern.test(sentence));
    setDifficulty(nextDifficulty);
    setCurrentIndex(matchingIndex >= 0 ? matchingIndex : getRandomSentenceIndex(nextPool));
    // setShowTranslation(false);
    setIsCompleted(false);
    setIsTimeUp(false);
    resetStats(timeLimit);
    setLastAttempt(null);
    setIsReviewOpen(false);
    setReviewWord(undefined);
    setIsSettingsOpen(false);
    window.history.pushState({}, '', window.location.pathname + window.location.search);
    setKey(prev => prev + 1);
  };
  const speakTimeoutRef = useRef<number | null>(null);
  const timeUpSoundPlayedRef = useRef(false);
  const timeoutPenaltyAppliedRef = useRef(false);
  const sentenceDecksRef = useRef<Record<string, number[]>>({});
  const recentSentenceIndicesRef = useRef<Record<string, number[]>>({});
  const focusSessionComplete = isFocusMode && focusTimeLeft === 0;

  const sentencePool = practiceFocus === 'vocabulary' ? VOCABULARY_SENTENCES[LANG][difficulty] : SAMPLE_SENTENCES[LANG][difficulty];
  const currentSentence = sentencePool[currentIndex] || sentencePool[0];
  // const currentTranslation = getSentenceTranslation(currentSentence, difficulty);

  useEffect(() => {
    if (!isFocusMode || focusTimeLeft <= 0) return;
    const timer = window.setTimeout(() => setFocusTimeLeft(value => Math.max(value - 1, 0)), 1000);
    return () => window.clearTimeout(timer);
  }, [isFocusMode, focusTimeLeft]);

  useEffect(() => {
    if (!isFocusMode) return;
    const handleFocusEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') exitFocusMode();
    };
    document.addEventListener('keydown', handleFocusEscape);
    return () => document.removeEventListener('keydown', handleFocusEscape);
  }, [isFocusMode]);

  const getNextSentenceIndex = (nextDifficulty: Difficulty, previousIndex?: number) => {
    const nextPool = practiceFocus === 'vocabulary' ? VOCABULARY_SENTENCES[LANG][nextDifficulty] : SAMPLE_SENTENCES[LANG][nextDifficulty];
    const deckKey = `${practiceFocus}-${nextDifficulty}`;
    const recentIndices = recentSentenceIndicesRef.current[deckKey] || [];
    const rememberSentence = (index: number) => {
      recentSentenceIndicesRef.current[deckKey] = [...recentIndices.filter(value => value !== index), index].slice(-3);
    };
    const dueWords = getDueReviewWords();
    const reviewCandidates = nextPool.map((sentence, index) => ({ sentence, index })).filter(item => dueWords.some(word => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i').test(item.sentence)) && item.index !== previousIndex);
    const freshReviewCandidates = reviewCandidates.filter(item => !recentIndices.includes(item.index));
    if (freshReviewCandidates.length > 0 || reviewCandidates.length > 0) {
      const candidates = freshReviewCandidates.length > 0 ? freshReviewCandidates : reviewCandidates;
      const candidateIndex = getRandomSentenceIndex(candidates.map(item => item.sentence));
      const nextIndex = candidates[candidateIndex].index;
      rememberSentence(nextIndex);
      return nextIndex;
    }
    let deck = sentenceDecksRef.current[deckKey];
    if (!deck || deck.length === 0) deck = shuffleSentenceIndices(nextPool, previousIndex).filter(index => !recentIndices.includes(index));
    let nextIndex: number | undefined;
    while (deck.length > 0 && nextIndex === undefined) {
      const candidate = deck.pop();
      if (candidate !== undefined && !recentIndices.includes(candidate)) nextIndex = candidate;
    }
    sentenceDecksRef.current[deckKey] = deck;
    if (nextIndex === undefined) {
      const fallbackCandidates = nextPool.map((sentence, index) => ({ sentence, index })).filter(item => item.index !== previousIndex && !recentIndices.includes(item.index));
      if (fallbackCandidates.length > 0) {
        const fallbackIndex = getRandomSentenceIndex(fallbackCandidates.map(item => item.sentence));
        nextIndex = fallbackCandidates[fallbackIndex].index;
      } else {
        nextIndex = getRandomSentenceIndex(nextPool, previousIndex);
      }
    }
    rememberSentence(nextIndex);
    return nextIndex;
  };

  useEffect(() => {
    const updateVoices = () => {
      const availableVoices = speechService.getVoicesByLang(LANG);
      setVoices(availableVoices);
      setSelectedVoice(current => current || availableVoices.find(voice => voice.name === 'Google US English')?.name || '');
    };
    updateVoices();
    const unsubscribeVoices = speechService.subscribeToVoices(updateVoices);
    const unsubscribeStatus = speechService.subscribeToStatus(setVoiceStatus);
    return () => {
      unsubscribeVoices();
      unsubscribeStatus();
    };
  }, []);

  useEffect(() => {
    getCurrentAccount().then(setAccountUser);
  }, []);

  useEffect(() => {
    if (!accountUser) return;
    getAccountSessions().then(remoteSessions => {
      if (remoteSessions.length > 0) setPracticeHistory(remoteSessions);
    }).catch(() => undefined);
  }, [accountUser]);

  useEffect(() => {
    getPremiumStatus().then(entitlement => {
      if (entitlement.isPremium) setIsPremium(true);
    }).catch(() => undefined);
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

  useEffect(() => {
    if (!isAccountOpen) return;

    const closeAccount = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.account-menu, .account-toggle')) setIsAccountOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAccountOpen(false);
    };

    document.addEventListener('mousedown', closeAccount);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', closeAccount);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isAccountOpen]);

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
    if (isFocusMode || !hasStartedTyping || !startedAt) return;
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
  }, [correctChars, hasStartedTyping, isFocusMode, startedAt, timeLimit]);

  useEffect(() => {
    if (isTimeUp && !timeUpSoundPlayedRef.current) {
      soundService.playTimeUp();
      timeUpSoundPlayedRef.current = true;
    }
    if (isTimeUp && !timeoutPenaltyAppliedRef.current) {
      setPoints(subtractPoints(TIMEOUT_PENALTY_POINTS));
      timeoutPenaltyAppliedRef.current = true;
    }
    if (!isTimeUp) {
      timeUpSoundPlayedRef.current = false;
      timeoutPenaltyAppliedRef.current = false;
    }
  }, [isTimeUp]);

  const handleNext = () => {
    setCurrentIndex(getNextSentenceIndex(difficulty, currentIndex));
    // setShowTranslation(false);
    setIsCompleted(false);
    setIsTimeUp(false);
    resetStats(timeLimit);
    setKey(prev => prev + 1);
  };

  const handleDifficultyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextDifficulty = event.target.value as Difficulty;
    if (nextDifficulty !== 'easy' && !isPremium) {
      openPremiumDashboard();
      return;
    }
    setDifficulty(nextDifficulty);
    setCurrentIndex(getNextSentenceIndex(nextDifficulty));
    // setShowTranslation(false);
    setIsCompleted(false);
    setIsTimeUp(false);
    resetStats(timeLimit);
    setKey(prev => prev + 1);
  };

  const handleFocusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextFocus = event.target.value as PracticeFocus;
    const nextPool = nextFocus === 'vocabulary' ? VOCABULARY_SENTENCES[LANG][difficulty] : SAMPLE_SENTENCES[LANG][difficulty];
    setPracticeFocus(nextFocus);
    setCurrentIndex(getRandomSentenceIndex(nextPool));
    // setShowTranslation(false);
    setIsCompleted(false);
    setIsTimeUp(false);
    resetStats(timeLimit);
    setReviewSummary(getReviewSummary());
    setKey(prev => prev + 1);
  };

  const handleTimeLimitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    const safeValue = Number.isFinite(nextValue) ? Math.min(Math.max(nextValue, 10), 1800) : DEFAULT_TIME_LIMIT;
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
    const session = {
      date: new Date().toISOString(),
      difficulty,
      wpm: Math.round((completedText.length / 5) / elapsedMinutes),
      accuracy: Math.round((correctCharacters / Math.max(currentSentence.length, 1)) * 100),
    };
    setPracticeHistory(savePracticeSession(session));
    if (accountUser) void saveAccountSession(session);
  };

  const handlePremiumComplete = (completedText = currentSentence, correctCharacters = currentSentence.length) => {
    recordPremiumSession(completedText, correctCharacters);
    setIsCompleted(true);
  };

  const handlePerfectComplete = (completedText = currentSentence, correctCharacters = currentSentence.length) => {
    const nextPoints = addPoints(PERFECT_SENTENCE_POINTS);
    setPoints(nextPoints);

    const nextDailyTarget = updateDailyTargetProgress(difficulty);
    setDailyTarget(nextDailyTarget);

    if (nextDailyTarget.completed) {
      const rewardResult = claimDailyTargetReward();
      setPoints(rewardResult.points);
      setDailyTarget(rewardResult.target);
    }

    if (isPremium) handlePremiumComplete(completedText, correctCharacters);
    else setIsCompleted(true);
    setTypingSpeed(0);
    setHasStartedTyping(false);
    setStartedAt(null);
  };

  const handlePremiumFinish = (completedText: string, correctCharacters: number, isCorrect: boolean) => {
    if (!isCorrect) recordPremiumSession(completedText, correctCharacters);
  };

  const handleAttemptFinish = (completedText: string, correctCharacters: number, isCorrect: boolean) => {
    setLastAttempt(analyzeAttempt(currentSentence, completedText));
    setLastAttemptText(completedText);
    setLastAttemptTargetText(currentSentence);
    setReviewNote('');
    setIsReviewNoteSaved(false);
    recordWordAttempt(currentSentence, completedText);
    setReviewSummary(getReviewSummary());
    setReviewWords(getReviewWords());
    if (isPremium) handlePremiumFinish(completedText, correctCharacters, isCorrect);
  };

  const handleSaveReviewNote = () => {
    saveReviewNoteForAttempt(lastAttemptTargetText, lastAttemptText, reviewNote);
    setReviewWords(getReviewWords());
    setReviewSummary(getReviewSummary());
    setIsReviewNoteSaved(Boolean(reviewNote.trim()));
  };

  const handleGoalChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGoalWpm(saveGoalWpm(Number(event.target.value)));
  };

  const bestWpm = practiceHistory.length ? Math.max(...practiceHistory.map(session => session.wpm)) : 0;
  const averageAccuracy = practiceHistory.length
    ? Math.round(practiceHistory.reduce((total, session) => total + session.accuracy, 0) / practiceHistory.length)
    : 0;
  const practiceStreak = getPracticeStreak(practiceHistory);
  const achievements = getUnlockedAchievements(points);

  useEffect(() => {
    const currentAchievements = getUnlockedAchievements(points);
    const nextUnlockedIds = new Set(currentAchievements.filter(achievement => achievement.unlocked).map(achievement => achievement.id));
    if (unlockedAchievementIdsRef.current === null) {
      unlockedAchievementIdsRef.current = nextUnlockedIds;
      return;
    }
    const previousUnlockedIds = unlockedAchievementIdsRef.current;
    const newlyUnlocked = currentAchievements.filter(achievement => achievement.unlocked && !previousUnlockedIds.has(achievement.id));

    unlockedAchievementIdsRef.current = nextUnlockedIds;

    if (newlyUnlocked.length === 0) return;

    const nextAchievement = newlyUnlocked[0];
    setAchievementToast({
      title: nextAchievement.title,
      description: nextAchievement.description,
      icon: nextAchievement.icon,
    });
  }, [points]);

  useEffect(() => {
    if (!achievementToast) return;

    const timeoutId = window.setTimeout(() => {
      setAchievementToast(null);
    }, ACHIEVEMENT_TOAST_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [achievementToast]);

  const achievementToastNode = achievementToast ? (
    <div className="achievement-toast" role="status" aria-live="polite">
      <span className="achievement-toast-badge" aria-hidden="true">{achievementToast.icon}</span>
      <div>
        <strong>Achievement unlocked!</strong>
        <span>{achievementToast.title}</span>
        <small>{achievementToast.description}</small>
      </div>
    </div>
  ) : null;

  if (isReviewOpen) {
    return <>
      {achievementToastNode}
      <ReviewPage
        words={reviewWords}
        onAddWord={handleAddReviewWord}
        onUpdateWord={handleUpdateReviewWord}
        onRemoveWord={handleRemoveReviewWord}
        onPracticeWord={startDueWordPractice}
        initialWord={reviewWord}
        onBack={closeReviewPage}
      />
    </>;
  }

  if (isPremiumOpen) {
    return <>
      {achievementToastNode}
      <PremiumDashboard
        isPremium={isPremium}
        goalWpm={goalWpm}
        bestWpm={bestWpm}
        averageAccuracy={averageAccuracy}
        practiceStreak={practiceStreak}
        practiceHistory={practiceHistory}
        totalPoints={points}
        dailyTarget={dailyTarget}
        achievements={achievements}
        onGoalChange={handleGoalChange}
        onLicenseActivated={() => setIsPremium(true)}
        onStartFocus={startFocusSession}
        onBack={closePremiumDashboard}
      />
    </>;
  }

  if (isPaymentResultOpen) {
    return <>
      {achievementToastNode}
      <PaymentResultPage onBack={closePaymentResult} onActivated={() => { setIsPaymentResultOpen(false); openPremiumDashboard(); }} />
    </>;
  }

  if (isPaymentOpen) {
    if (isPremium) {
      return <>
        {achievementToastNode}
        <PremiumDashboard
          isPremium={isPremium}
          goalWpm={goalWpm}
          bestWpm={bestWpm}
          averageAccuracy={averageAccuracy}
          practiceStreak={practiceStreak}
          practiceHistory={practiceHistory}
          totalPoints={points}
          dailyTarget={dailyTarget}
          achievements={achievements}
          onGoalChange={handleGoalChange}
          onLicenseActivated={() => setIsPremium(true)}
          onStartFocus={startFocusSession}
          onBack={closePaymentPage}
        />
      </>;
    }
    return <>
      {achievementToastNode}
      <PaymentPage onBack={closePaymentPage} onLicenseClick={() => { closePaymentPage(); openPremiumDashboard(); }} />
    </>;
  }

  const handleTypingChange = (nextValue: string) => {
    if (isTimeUp) return;
    const nextCorrectChars = Array.from(nextValue).reduce((count, char, index) => {
      const targetChar = currentSentence[index];
      return count + (targetChar && char.toLowerCase() === targetChar.toLowerCase() ? 1 : 0);
    }, 0);
    if (nextValue.length > 0) setLastAttempt(null);
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
    <div className={`app-layout ${isFocusMode ? 'focus-mode' : ''}`}>
      {achievementToastNode}
      {!isFocusMode && <Header
        accountUser={accountUser}
        isAccountOpen={isAccountOpen}
        isPremium={isPremium}
        isPremiumOpen={isPremiumOpen}
        isSettingsOpen={isSettingsOpen}
        isReviewOpen={isReviewOpen}
        onAccountToggle={() => setIsAccountOpen(open => !open)}
        onAuthenticated={user => { setAccountUser(user); setIsAccountOpen(false); }}
        onLoggedOut={() => setAccountUser(null)}
        onPremiumOpen={isPremium ? openPremiumDashboard : openPaymentPage}
        onSettingsToggle={() => setIsSettingsOpen(open => !open)}
        onReviewOpen={() => openReviewPage()}
      />}
      {!isFocusMode && showOnboarding && (
        <section className="onboarding-card" aria-label="How to practice">
          <div><span className="premium-kicker">Welcome to Zen Dictation</span><h2>Three quiet steps to better listening.</h2><p>Listen, type what you hear, then use the feedback to improve your accuracy and speed.</p></div>
          <div className="onboarding-steps"><span><b>1</b> Listen</span><span><b>2</b> Type</span><span><b>3</b> Improve</span></div>
          <button type="button" onClick={() => { localStorage.setItem('zen-dictation-onboarding-seen', 'true'); setShowOnboarding(false); }}>Start practicing</button>
        </section>
      )}
      {!isFocusMode && isPremiumOpen && (
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
            </div>
          )}
        </section>
      )}
      {!isFocusMode && isSettingsOpen && (
        <section id="settings-menu" className="settings-panel" aria-label="Settings">
          <label className="settings-field">
            <span>Level</span>
            <select value={difficulty} onChange={handleDifficultyChange}>
              <option value="easy">Easy · A1–A2</option>
              <option value="medium" disabled={!isPremium}>Medium · B1–B2 {isPremium ? '' : '(Premium)'}</option>
              <option value="hard" disabled={!isPremium}>Hard · C1–C2 {isPremium ? '' : '(Premium)'}</option>
            </select>
            <small className="level-guide" role="note">{CAMBRIDGE_LEVELS[difficulty].exams}</small>
          </label>
          <label className="settings-field">
            <span>Focus</span>
            <select value={practiceFocus} onChange={handleFocusChange}>
              <option value="mixed">Mixed practice</option>
              <option value="vocabulary">Vocabulary</option>
            </select>
            <small className="review-status" role="status">
              {reviewSummary.due > 0 ? `${reviewSummary.due} word${reviewSummary.due === 1 ? '' : 's'} ready to review` : `${reviewSummary.total} words tracked`}
            </small>
          </label>
          {reviewWords.length > 0 && (
            <section className="review-words" aria-label="Words to review">
              <div className="review-words-heading"><strong>Review words</strong><small>{reviewSummary.due} due now</small></div>
              <div className="review-words-list">
                {reviewWords.slice(0, 8).map(review => {
                  const isDue = new Date(review.nextReviewAt).getTime() <= reviewNow;
                  return <div className="review-word" key={review.word}><strong>{review.word}</strong>{isDue ? <button type="button" className="review-due-button" onClick={() => startDueWordPractice(review.word)}>{review.mistakes} mistake{review.mistakes === 1 ? '' : 's'} · Due now</button> : <span>{review.mistakes} mistake{review.mistakes === 1 ? '' : 's'} · Streak {review.correctStreak}</span>}</div>;
                })}
              </div>
              {reviewWords.length > 8 && <small className="review-words-more">Showing 8 of {reviewWords.length} words</small>}
              <button type="button" className="review-words-button" onClick={() => openReviewPage()}>Open review page</button>
            </section>
          )}
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
          <label className="settings-field">
            <span>Voice</span>
            <select value={selectedVoice} onChange={event => setSelectedVoice(event.target.value)} disabled={voiceStatus === 'unsupported'}>
              <option value="">Browser default voice</option>
              {voices.map(voice => <option key={`${voice.name}-${voice.voiceURI}`} value={voice.name}>{voice.name}</option>)}
            </select>
            <small className={`voice-status voice-status-${voiceStatus}`} role="status">
              {voiceStatus === 'loading' ? 'Loading voices…' : voiceStatus === 'unsupported' ? 'Speech unavailable' : voiceStatus === 'speaking' ? 'Speaking' : voiceStatus === 'error' ? 'Try Again' : 'Ready'}
            </small>
          </label>
          
        </section>
      )}
      {isFocusMode && <div className="focus-toolbar"><span><b>Focus mode</b><small>Distraction-free practice</small></span><strong>{Math.floor(focusTimeLeft / 60)}:{String(focusTimeLeft % 60).padStart(2, '0')}</strong><button type="button" onClick={exitFocusMode}>Exit focus</button></div>}
      {isFocusMode && focusSessionComplete && <section className="focus-summary" role="status"><span className="premium-kicker">Session complete</span><h2>Well done. You stayed focused.</h2><p>You practiced for this session with {typingSpeed.toFixed(1)} WPM on the last attempt.</p><button type="button" className="action-btn next" onClick={exitFocusMode}>Back to practice</button></section>}
      <main className="app-content">
        {!isFocusMode && (
          <>
            <div className="stats-row">
              <div className="time-limit-control" ><span className="stat-label">Typing speed</span><strong>{typingSpeed.toFixed(1)} WPM</strong></div>
              <div>
                <div className="time-limit-control"> <span className="stat-label">Time limit</span>
                  <input type="number" min={10} max={1800} step={5} value={timeLimit} onChange={handleTimeLimitChange} aria-label="Custom time limit in seconds" />
                  <span>s</span>
                </div>
                <strong>{hasStartedTyping ? `${timeLeft}s left` : 'Waiting...'}</strong>
              </div>
              <div className="daily-target-card">
                <span className="stat-label">Daily target</span>
                <strong>{Math.min(dailyTarget.progress, dailyTarget.target)}/{dailyTarget.target}</strong>
                <div className="stat-label" aria-label="Daily target progress">
                  <span style={{ width: `${Math.min((dailyTarget.progress / dailyTarget.target) * 100, 100)}%` }} />
                </div>
                <small > {dailyTarget.completed ? `Reward claimead +${dailyTarget.rewardPoints}` : `Reward +${dailyTarget.rewardPoints}`}</small>
              </div>
              <div className="points-stat"><span className="stat-label">Points</span><strong>{points}</strong><small></small></div>
            </div>

            <div className={'status-badge ' + (isTimeUp ? 'status-error' : isCompleted ? 'status-success' : 'status-ready')} role="status" aria-live="polite">
              {isTimeUp && !isCompleted ? (
                <>
                  <span aria-hidden="true">⏰</span> <strong>Time’s up</strong> — Hit Reset Timer to try again.
                </>
              ) : isCompleted ? '🎉 Done! +10 points perfect sentence' : '🎧 Listen and type...'}
            </div>

            <button type="button" className="reset-timer-btn" onClick={handleResetTimer}>
              Reset Timer
            </button>
          </>
        )}

        <DictationArea key={key} targetText={currentSentence} onComplete={handlePerfectComplete} onFinish={handleAttemptFinish} onNext={handleNext} onTypingChange={handleTypingChange} isHidden={isSentenceHidden} disabled={isTimeUp || (isFocusMode && focusSessionComplete)} />

        {/* {!isFocusMode && (
          <div className="translation-panel">
            <button type="button" className="translation-toggle" onClick={() => setShowTranslation(value => !value)}>
              <span className="translation-toggle-icon" aria-hidden="true">{showTranslation ? '−' : '+'}</span>
              {showTranslation ? 'Hide' : 'Reveal'}
            </button>
            {showTranslation && <p className="translation-text">{currentTranslation}</p>}
          </div>
        )} */}

        <button type="button" className="visibility-toggle" onClick={() => setIsSentenceHidden(prev => !prev)} aria-pressed={isSentenceHidden}>
          {isSentenceHidden ? 'Show sentence' : 'Hide sentence'}
        </button>

        {!isFocusMode && lastAttempt && (
          <div className="attempt-summary" role="status" aria-live="polite">
            <strong>{lastAttempt.accuracy}% accuracy</strong>
            {lastAttempt.incorrectWords.length > 0 && <div className="incorrect-details" aria-label="Incorrect words">
              {/* <span>Words */}
              <div className="incorrect-details-list">
                {lastAttempt.incorrectWords.map((detail, index) => <span className="incorrect-word" key={`${detail.actual}-${detail.expected}-${index}`}><b>{detail.actual}</b><i>→</i><strong>{detail.expected}</strong></span>)}
              </div>
            </div>}
            <p><small>Grammar focus: {lastAttempt.grammarTip}</small></p>
            {(lastAttempt.incorrectCharacters > 0 || lastAttempt.missingCharacters > 0) && <div className="review-note-editor">
              <label htmlFor="practice-review-note">Note for review <small>Saved with the words you missed</small></label>
              <textarea id="practice-review-note" value={reviewNote} onChange={event => { setReviewNote(event.target.value); setIsReviewNoteSaved(false); }} placeholder="e.g. Remember the spelling or meaning..." maxLength={240} />
              <button type="button" onClick={handleSaveReviewNote} disabled={!reviewNote.trim()}>Save note</button>
              {isReviewNoteSaved && <span role="status">Note saved to Review Words.</span>}
            </div>}
          </div>
        )}

        {!isFocusMode && <Controls onReplay={handleSpeak} onNext={handleNext} />}
        
      </main>
      {!isFocusMode && <footer className="app-footer"><p> <i> Tip: Focus on the sounds, then the letters. Repeat three times for best results. </i> </p>  </footer>}
    </div>
  );
}

export default App;
