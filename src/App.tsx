import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { DEFAULT_VOICE_NAME, speechService } from './services/speechService';
import { soundService } from './services/soundService';
import type { SpeechStatus, VoiceLanguage } from './services/speechService';
import DictationArea from './components/DictationArea/DictationArea';
import Controls from './components/Controls/Controls';
import SiteNotice from './components/SiteNotice/SiteNotice';
import LanguageSwitcher from './components/LanguageSwitcher/LanguageSwitcher';
import './styles/globals.css';
import './App.css';
import {  type Difficulty } from './utils/sentenceTranslations';
import { clearLearnerLevel, getLearnerLevel, isLearnerLevel, LEARNER_LEVEL_DIFFICULTY, saveLearnerLevel, type LearnerLevel } from './services/learnerLevelService';
import { analyzeAttempt, type AttemptAnalysis } from './utils/textUtils';
import { getTypingSpeed, isNextButtonDisabled, remainingSeconds, resolvePracticeSentence } from './utils/practiceState';
import { addReviewWord, clearReviewWords, getDueReviewWords, getReviewSummary, getReviewWords, recordWordAttempt, removeReviewWord, replaceReviewWords, saveReviewNoteForAttempt, saveReviewWordNotes, updateReviewWord, type ReviewWord } from './services/spacedRepetitionService';
import { addPoints, claimDailyTargetReward, clearPointsState, getDailyTarget, getPoints, getUnlockedAchievements, mergeDailyTarget, PERFECT_SENTENCE_POINTS, replaceDailyTarget, replacePoints, subtractPoints, TIMEOUT_PENALTY_POINTS, updateDailyTargetProgress, type DailyTarget } from './services/pointsService';
import { clearPremiumLearningState, getGoalWpm, getPracticeHistory, getPracticeStreak, saveGoalWpm, savePracticeSession, type PracticeSession } from './services/premiumService';
const PremiumDashboard = lazy(() => import('./components/PremiumDashboard/PremiumDashboard'));
const ReviewPage = lazy(() => import('./components/ReviewPage/ReviewPage'));
import { getPremiumStatus } from './services/premiumAccess';
import { fetchSentencePack, getCachedSentencePack, type DatabaseSentence } from './services/sentenceApi';
import { getAccountLearningState, getCurrentAccount, saveAccountLearningState, saveAccountSession, syncAccountSessions, type AccountUser } from './services/accountService';
import Header from './components/Header/Header';
import LearningCoach from './components/LearningCoach/LearningCoach';
import YoutubeImport from './components/YoutubeImport/YoutubeImport';
import YoutubeVideo, { type YoutubeVideoHandle } from './components/YoutubeImport/YoutubeVideo';
import type { YoutubeCaption } from './services/youtubeApi';
import { buildDailyLesson, clearLearningState, mergeLearningStates, readLearningState, recordLearningAttempt, replaceLearningState, type LearningFocus, type LearningState } from './services/learningCoach';
import { clearPracticeNotes, mergePracticeNotes, readPracticeNotes, replacePracticeNotes, type PracticeNote } from './services/practiceNotesService';
import { getVerifiedSentenceTranslation } from './utils/sentenceTranslations';
import { findReviewSentence } from './services/reviewSentence';
import { chooseRandomSentenceIndex, isRecentlyUsedSentence, loadRecentSentenceHistory, rememberRecentSentence, saveRecentSentenceHistory } from './services/sentenceRotation';
import { useAppLanguage } from './context/useAppLanguage';
const PaymentPage = lazy(() => import('./components/PaymentPage/PaymentPage'));
const SupportPage = lazy(() => import('./components/SupportPage/SupportPage'));
const PaymentResultPage = lazy(async () => {
  const module = await import('./components/PaymentPage/PaymentPage');
  return { default: module.PaymentResultPage };
});

const DEFAULT_TIME_LIMIT = 30;
const LANG: VoiceLanguage = 'en-US';
const DEFAULT_DIFFICULTY: Difficulty = 'easy';
const SPEECH_SPEEDS = [0.5, 0.75, 1, 1.25];
const REPEAT_COUNTS = [1, 2, 3, 4, 5];
const REPEAT_GAPS = [0.5, 1, 2, 3, 5];
const readReplaySetting = (key: string, allowed: number[], fallback: number) => {
  try {
    const value = Number(localStorage.getItem(key));
    return allowed.includes(value) ? value : fallback;
  } catch { return fallback; }
};
const SHOW_YOUTUBE_IMPORT = false;
const ACHIEVEMENT_TOAST_DURATION_MS = 8000;
const ACHIEVEMENT_TRANSLATIONS_VI: Record<string, { title: string; description: string }> = {
  Starter: { title: 'Người bắt đầu', description: 'Đạt 1.000 điểm' },
  Committed: { title: 'Kiên trì', description: 'Đạt 5.000 điểm' },
  'Focused learner': { title: 'Người học tập trung', description: 'Đạt 10.000 điểm' },
  'Master practice': { title: 'Bậc thầy luyện tập', description: 'Đạt 50.000 điểm' },
};
type PracticeFocus = 'mixed' | 'vocabulary' | 'idioms' | 'ielts' | 'business';
const CAMBRIDGE_LEVELS: Record<Difficulty, { exams: string }> = {
  easy: { exams: 'Starters · A2 Key' },
  medium: { exams: 'B1 Preliminary · B2 First' },
  hard: { exams: 'C1 Advanced · C2 Proficiency' },
};
const databaseSentencePools: Partial<Record<PracticeFocus, Record<Difficulty, string[]>>> = {};
const updateDatabaseSentencePool = (focus: PracticeFocus, sentences: DatabaseSentence[]) => {
  const existing = databaseSentencePools[focus] || { easy: [], medium: [], hard: [] };
  databaseSentencePools[focus] = {
    easy: sentences.some(sentence => sentence.difficulty === 'easy') ? sentences.filter(sentence => sentence.difficulty === 'easy').sort((a, b) => a.sort_order - b.sort_order).map(sentence => sentence.text) : existing.easy,
    medium: sentences.some(sentence => sentence.difficulty === 'medium') ? sentences.filter(sentence => sentence.difficulty === 'medium').sort((a, b) => a.sort_order - b.sort_order).map(sentence => sentence.text) : existing.medium,
    hard: sentences.some(sentence => sentence.difficulty === 'hard') ? sentences.filter(sentence => sentence.difficulty === 'hard').sort((a, b) => a.sort_order - b.sort_order).map(sentence => sentence.text) : existing.hard,
  };
};
const getSentencePool = (focus: PracticeFocus, difficulty: Difficulty) => {
  const databasePool = databaseSentencePools[focus]?.[difficulty];
  return databasePool || [];
};
const ACTIVE_PRACTICE_KEY = 'zen-dictation-active-practice';
const LAST_SENTENCE_KEY = 'zen-dictation-last-sentence';
type ActivePractice = { difficulty: Difficulty; focus: PracticeFocus; index: number; targetText: string };
const readActivePractice = (): ActivePractice | null => {
  try {
    const saved = JSON.parse(localStorage.getItem(ACTIVE_PRACTICE_KEY) || 'null') as Partial<ActivePractice> | null;
    if (!saved || !['easy', 'medium', 'hard'].includes(saved.difficulty || '') || !['mixed', 'vocabulary', 'idioms', 'ielts', 'business'].includes(saved.focus || '') || !Number.isInteger(saved.index) || !saved.targetText) return null;
    return saved as ActivePractice;
  } catch {
    return null;
  }
};
const savedPractice = readActivePractice();
const initialFocus = savedPractice?.focus || 'mixed';
const initialDifficulty = savedPractice?.difficulty || DEFAULT_DIFFICULTY;
const initialLearnerLevel = getLearnerLevel(initialDifficulty);
const initialPack = initialFocus === 'mixed' ? 'core' : initialFocus;
const initialSentences = getCachedSentencePack(initialPack, initialDifficulty);
if (initialSentences?.length) updateDatabaseSentencePool(initialFocus, initialSentences);
// Start the request while the module loads, before React mounts and runs effects.
if (initialFocus === 'mixed' || initialFocus === 'vocabulary') {
  void fetchSentencePack(initialPack, initialDifficulty).catch(() => undefined);
}
const mergeReviewWords = (localWords: ReviewWord[], remoteWords: ReviewWord[]) => {
  const merged = new Map(remoteWords.map(word => [word.word, { ...word }]));
  localWords.forEach(local => {
    const remote = merged.get(local.word);
    if (!remote) {
      merged.set(local.word, { ...local });
      return;
    }
    merged.set(local.word, {
      ...remote,
      mistakes: Math.max(remote.mistakes, local.mistakes),
      correctStreak: Math.max(remote.correctStreak, local.correctStreak),
      nextReviewAt: new Date(Math.min(new Date(remote.nextReviewAt).getTime(), new Date(local.nextReviewAt).getTime())).toISOString(),
      note: local.note || remote.note,
      lastMistakeAt: new Date(Math.max(new Date(remote.lastMistakeAt || remote.nextReviewAt).getTime(), new Date(local.lastMistakeAt || local.nextReviewAt).getTime())).toISOString(),
    });
  });
  return [...merged.values()];
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

const getAdaptiveDifficulty = (difficulty: Difficulty, accuracy: number): Difficulty => {
  if (accuracy >= 95) return difficulty === 'easy' ? 'medium' : 'hard';
  if (accuracy < 75) return difficulty === 'hard' ? 'medium' : 'easy';
  return difficulty;
};

function App() {
  const { language } = useAppLanguage();
  const isVietnamese = language === 'vi';
  const [learnerLevel, setLearnerLevel] = useState<LearnerLevel>(() => initialLearnerLevel);
  const [learnerLevelSaveError, setLearnerLevelSaveError] = useState('');
  const [accountSyncError, setAccountSyncError] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(() => initialDifficulty);
  const [practiceFocus, setPracticeFocus] = useState<PracticeFocus>(() => savedPractice?.focus || 'mixed');
  const [isAdaptiveMode, setIsAdaptiveMode] = useState(false);
  const [coachState, setCoachState] = useState<LearningState>(readLearningState);
  const [practiceNotes, setPracticeNotes] = useState<PracticeNote[]>(readPracticeNotes);
  const [lesson, setLesson] = useState<{ texts: string[]; index: number; completed: boolean; videoId?: string; captions?: YoutubeCaption[] } | null>(null);
  const youtubeVideoRef = useRef<YoutubeVideoHandle>(null);
  const recordedAttemptRef = useRef(false);
  const [sentenceCatalogVersion, setSentenceCatalogVersion] = useState(0);
  const [sentenceLoadError, setSentenceLoadError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(() => {
    const pool = getSentencePool(initialFocus, initialDifficulty);
    const savedIndex = savedPractice ? pool.indexOf(savedPractice.targetText) : -1;
    if (savedIndex >= 0) return savedIndex;
    const previousText = savedPractice?.targetText;
    const recentSentences = previousText
      ? rememberRecentSentence(loadRecentSentenceHistory(), previousText)
      : loadRecentSentenceHistory();
    return pool.length ? chooseRandomSentenceIndex(pool, recentSentences) : 0;
  });
  const [speed, setSpeed] = useState(1);
  const [repeatCount, setRepeatCount] = useState(() => readReplaySetting('zen-dictation-repeat-count', REPEAT_COUNTS, 1));
  const [repeatGap, setRepeatGap] = useState(() => readReplaySetting('zen-dictation-repeat-gap', REPEAT_GAPS, 1));
  useEffect(() => {
    try {
      localStorage.setItem('zen-dictation-repeat-count', String(repeatCount));
      localStorage.setItem('zen-dictation-repeat-gap', String(repeatGap));
    } catch { /* Settings still work when storage is unavailable. */ }
  }, [repeatCount, repeatGap]);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceStatus, setVoiceStatus] = useState<SpeechStatus>(() => speechService.getStatus());
  const [voiceError, setVoiceError] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE_NAME);
  const speechPlaybackRequestedRef = useRef(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<AttemptAnalysis | null>(null);
  const [reviewSummary, setReviewSummary] = useState<ReturnType<typeof getReviewSummary>>(() => getReviewSummary());
  const [reviewWords, setReviewWords] = useState<ReviewWord[]>(getReviewWords);
  const [reviewPracticeError, setReviewPracticeError] = useState('');
  const [reviewNow] = useState(() => Date.now());
  const [lastAttemptText, setLastAttemptText] = useState('');
  const [lastAttemptTargetText, setLastAttemptTargetText] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewNoteWord, setReviewNoteWord] = useState('');
  const [reviewNoteError, setReviewNoteError] = useState('');
  const [isReviewNoteSaved, setIsReviewNoteSaved] = useState(false);
  const [isReviewNoteEditorOpen, setIsReviewNoteEditorOpen] = useState(false);
  const [points, setPoints] = useState(getPoints);
  const [dailyTarget, setDailyTarget] = useState(() => getDailyTarget());
  const [key, setKey] = useState(0);
  const [correctChars, setCorrectChars] = useState(0);
  const [timeLimit, setTimeLimit] = useState(DEFAULT_TIME_LIMIT);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME_LIMIT);
  const [typingSpeed, setTypingSpeed] = useState(0);
  const [isSpeedTrackingDisabled, setIsSpeedTrackingDisabled] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const attemptStartedAtRef = useRef<number | null>(null);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [isSentenceHidden, setIsSentenceHidden] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const initialHash = window.location.hash.split('?')[0];
  const [isPremiumOpen, setIsPremiumOpen] = useState(() => initialHash === '#premium');
  const [isPaymentOpen, setIsPaymentOpen] = useState(() => initialHash === '#payment');
  const [isPaymentResultOpen, setIsPaymentResultOpen] = useState(() => initialHash === '#payment-result');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(() => initialHash === '#review');
  const [isSupportOpen, setIsSupportOpen] = useState(() => initialHash === '#support');
  // const [showTranslation, setShowTranslation] = useState(false);
  const [reviewWord, setReviewWord] = useState<string | undefined>();
  const [focusTimeLeft, setFocusTimeLeft] = useState(20 * 60);
  const [focusDeadline, setFocusDeadline] = useState<number | null>(null);
  const [goalWpm, setGoalWpm] = useState(getGoalWpm);
  const [practiceHistory, setPracticeHistory] = useState<PracticeSession[]>(getPracticeHistory);
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem('zen-dictation-onboarding-seen') !== 'true');
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const learningStateHydratedRef = useRef(false);
  const accountHydrationGenerationRef = useRef(0);
  const accountLearningSnapshotRef = useRef({ learnerLevel, coachState, practiceNotes, isVietnamese });
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [achievementToast, setAchievementToast] = useState<{ title: string; description: string; icon: string } | null>(null);
  const unlockedAchievementIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    accountLearningSnapshotRef.current = { learnerLevel, coachState, practiceNotes, isVietnamese };
  }, [coachState, isVietnamese, learnerLevel, practiceNotes]);
  useEffect(() => {
    const handlePopState = () => {
      const isSupportRoute = window.location.hash.split('?')[0] === '#support';
      if (!isSupportRoute && !isSupportOpen) return;

      setIsSupportOpen(isSupportRoute);
      if (isSupportRoute) {
        setIsPremiumOpen(false);
        setIsPaymentOpen(false);
        setIsPaymentResultOpen(false);
        setIsReviewOpen(false);
        setIsSettingsOpen(false);
        setIsAccountOpen(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isSupportOpen]);
  const openPremiumDashboard = () => {
    setIsSupportOpen(false);
    window.history.pushState({}, '', '#premium');
    setIsPremiumOpen(true);
  };
  const closePremiumDashboard = () => {
    window.history.pushState({}, '', window.location.pathname + window.location.search);
    setIsPremiumOpen(false);
  };
  const openPaymentPage = () => {
    setIsSupportOpen(false);
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
    setLesson(null);
    setFocusTimeLeft(durationMinutes * 60);
    // This callback runs only when the user starts a Focus session.
    // eslint-disable-next-line react-hooks/purity
    setFocusDeadline(Date.now() + durationMinutes * 60_000);
    setIsFocusMode(true);
    setIsCompleted(false);
    setIsTimeUp(false);
    resetStats(timeLimit);
    setKey(value => value + 1);
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
    setIsSupportOpen(false);
    window.history.pushState({}, '', '#review');
    setIsSettingsOpen(false);
    setReviewWord(word);
    setIsReviewOpen(true);
  };
  const openSupportPage = () => {
    setIsPremiumOpen(false);
    setIsPaymentOpen(false);
    setIsPaymentResultOpen(false);
    setIsReviewOpen(false);
    setIsSettingsOpen(false);
    setIsAccountOpen(false);
    window.history.pushState({}, '', '#support');
    setIsSupportOpen(true);
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
  const startDueWordPractice = async (word: string) => {
    setReviewPracticeError('');
    const candidateFocuses: PracticeFocus[] = [practiceFocus, 'mixed', 'vocabulary', 'idioms'];
    if (isPremium) candidateFocuses.push('ielts', 'business');
    const focusOrder = [...new Set(candidateFocuses)];
    const availableDifficulties: Difficulty[] = [LEARNER_LEVEL_DIFFICULTY[learnerLevel]];
    const findMatch = () => findReviewSentence(word, focusOrder.flatMap(focus => availableDifficulties.map(level => ({
      focus,
      difficulty: level,
      sentences: getSentencePool(focus, level),
    }))));
    let matchingSentence = findMatch();

    if (!matchingSentence) {
      const results = await Promise.allSettled(focusOrder.map(async focus => {
        const sentences = await fetchSentencePack(focus === 'mixed' ? 'core' : focus);
        updateDatabaseSentencePool(focus, sentences);
      }));
      matchingSentence = findMatch();
      if (!matchingSentence) {
        const failedToLoad = results.some(result => result.status === 'rejected');
        setReviewPracticeError(failedToLoad ? 'Could not load practice sentences. Please try again.' : `No available sentence contains “${word}”.`);
        return;
      }
    }

    setLesson(null);
    setPracticeFocus(matchingSentence.focus);
    setDifficulty(matchingSentence.difficulty);
    setCurrentIndex(matchingSentence.index);
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
  const recentSentenceHistoryRef = useRef<string[] | null>(null);
  if (recentSentenceHistoryRef.current === null) recentSentenceHistoryRef.current = loadRecentSentenceHistory();
  const focusSessionComplete = isFocusMode && focusTimeLeft === 0;

  const sentencePool = getSentencePool(practiceFocus, difficulty);
  const sentenceCatalogStatus = sentencePool.length ? 'ready' : sentenceLoadError === `${practiceFocus}:${difficulty}` ? 'error' : 'loading';
  const currentSentence = String(resolvePracticeSentence(sentencePool, currentIndex, lesson));
  useEffect(() => {
    if (!isReviewNoteEditorOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsReviewNoteEditorOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isReviewNoteEditorOpen]);
  const attemptDeadline = !isFocusMode && hasStartedTyping && startedAt !== null
    ? startedAt + timeLimit * 1000
    : null;
  const nextButtonDisabled = isNextButtonDisabled(isTimeUp, focusSessionComplete, attemptDeadline);
  // const currentTranslation = getSentenceTranslation(currentSentence, difficulty);
  const rememberPracticeSentence = useCallback((sentence: string) => {
    const nextHistory = rememberRecentSentence(recentSentenceHistoryRef.current || [], sentence);
    recentSentenceHistoryRef.current = nextHistory;
    saveRecentSentenceHistory(nextHistory);
    try { localStorage.setItem(LAST_SENTENCE_KEY, sentence); } catch { /* Best effort. */ }
  }, []);

  useEffect(() => {
    if (!isFocusMode || focusDeadline === null) return;
    const tick = () => setFocusTimeLeft(remainingSeconds(focusDeadline));
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [isFocusMode, focusDeadline]);

  useEffect(() => {
    if (!isFocusMode) return;
    const handleFocusEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') exitFocusMode();
    };
    document.addEventListener('keydown', handleFocusEscape);
    return () => document.removeEventListener('keydown', handleFocusEscape);
  }, [isFocusMode]);

  const getNextSentenceIndex = (nextDifficulty: Difficulty, previousIndex?: number) => {
    const nextPool = getSentencePool(practiceFocus, nextDifficulty);
    const deckKey = `${practiceFocus}-${nextDifficulty}`;
    const recentSentences = recentSentenceHistoryRef.current || [];
    const wasRecentlyUsed = (sentence: string) => isRecentlyUsedSentence(recentSentences, sentence);
    const dueWords = getDueReviewWords();
    const reviewCandidates = nextPool.map((sentence, index) => ({ sentence, index })).filter(item => dueWords.some(word => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i').test(item.sentence)) && item.index !== previousIndex);
    const freshReviewCandidates = reviewCandidates.filter(item => !wasRecentlyUsed(item.sentence));
    if (freshReviewCandidates.length > 0 || reviewCandidates.length > 0) {
      const candidates = freshReviewCandidates.length > 0 ? freshReviewCandidates : reviewCandidates;
      const candidateIndex = chooseRandomSentenceIndex(candidates.map(item => item.sentence), recentSentences);
      const nextIndex = candidates[candidateIndex].index;
      if (nextPool[nextIndex]) rememberPracticeSentence(nextPool[nextIndex]);
      return nextIndex;
    }
    let deck = sentenceDecksRef.current[deckKey];
    if (!deck || deck.length === 0) deck = shuffleSentenceIndices(nextPool, previousIndex).filter(index => !wasRecentlyUsed(nextPool[index]));
    let nextIndex: number | undefined;
    while (deck.length > 0 && nextIndex === undefined) {
      const candidate = deck.pop();
      if (candidate !== undefined && candidate < nextPool.length && candidate !== previousIndex && !wasRecentlyUsed(nextPool[candidate])) nextIndex = candidate;
    }
    sentenceDecksRef.current[deckKey] = deck;
    if (nextIndex === undefined) {
      const fallbackCandidates = nextPool.map((sentence, index) => ({ sentence, index })).filter(item => item.index !== previousIndex && !wasRecentlyUsed(item.sentence));
      if (fallbackCandidates.length > 0) {
        const fallbackIndex = chooseRandomSentenceIndex(fallbackCandidates.map(item => item.sentence), recentSentences);
        nextIndex = fallbackCandidates[fallbackIndex].index;
      } else {
        nextIndex = chooseRandomSentenceIndex(nextPool, recentSentences, previousIndex);
      }
    }
    if (nextPool[nextIndex]) rememberPracticeSentence(nextPool[nextIndex]);
    return nextIndex;
  };
  useEffect(() => {
    if (sentenceCatalogStatus === 'ready' && !lesson && currentSentence) rememberPracticeSentence(currentSentence);
  }, [currentSentence, difficulty, lesson, practiceFocus, rememberPracticeSentence, sentenceCatalogStatus]);

  useEffect(() => {
    const updateVoices = () => {
      const availableVoices = speechService.getVoicesByLang(LANG);
      setVoices(availableVoices);
      setSelectedVoice(current => current === DEFAULT_VOICE_NAME || current === '' || availableVoices.some(voice => voice.name === current) ? current : DEFAULT_VOICE_NAME);
    };
    updateVoices();
    const unsubscribeVoices = speechService.subscribeToVoices(updateVoices);
    const unsubscribeStatus = speechService.subscribeToStatus(status => {
      setVoiceStatus(status);
      setVoiceError(speechService.getErrorMessage());
    });
    return () => {
      unsubscribeVoices();
      unsubscribeStatus();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const currentPool = databaseSentencePools[practiceFocus]?.[difficulty];
    if (currentPool?.length) {
      return;
    }
    if ((practiceFocus === 'ielts' || practiceFocus === 'business') && !isPremium) return;
    fetchSentencePack(practiceFocus === 'mixed' ? 'core' : practiceFocus, difficulty)
      .then(sentences => {
        if (!sentences.length) throw new Error('Sentence pack is empty');
        updateDatabaseSentencePool(practiceFocus, sentences);
        if (cancelled) return;
        const nextPool = getSentencePool(practiceFocus, difficulty);
        const lastSentence = localStorage.getItem(LAST_SENTENCE_KEY);
        const recentSentences = lastSentence
          ? rememberRecentSentence(recentSentenceHistoryRef.current || [], lastSentence)
          : recentSentenceHistoryRef.current || [];
        const active = readActivePractice();
        const restoredIndex = active?.focus === practiceFocus && active.difficulty === difficulty ? nextPool.indexOf(active.targetText) : -1;
        const nextIndex = restoredIndex >= 0 ? restoredIndex : chooseRandomSentenceIndex(nextPool, recentSentences);
        setCurrentIndex(nextIndex);
        rememberPracticeSentence(nextPool[nextIndex]);
        setSentenceLoadError(null);
        setSentenceCatalogVersion(version => version + 1);
      })
      .catch(() => { if (!cancelled) setSentenceLoadError(`${practiceFocus}:${difficulty}`); });
    return () => { cancelled = true; };
  }, [difficulty, isPremium, practiceFocus, rememberPracticeSentence]);

  useEffect(() => {
    const currentPool = databaseSentencePools[practiceFocus]?.[difficulty];
    if (!currentPool?.length || ((practiceFocus === 'ielts' || practiceFocus === 'business') && !isPremium)) return;
    const nextDifficulty: Difficulty | null = isPremium
      ? difficulty === 'easy' ? 'medium' : difficulty === 'medium' ? 'hard' : null
      : practiceFocus === 'mixed' ? difficulty : null;
    if (!nextDifficulty) return;
    const pack = !isPremium && practiceFocus === 'mixed' ? 'vocabulary' : practiceFocus === 'mixed' ? 'core' : practiceFocus;
    const timeoutId = window.setTimeout(() => {
      void fetchSentencePack(pack, nextDifficulty)
        .then(sentences => {
          if (sentences.length) updateDatabaseSentencePool(pack === 'core' ? 'mixed' : pack, sentences);
        })
        .catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(timeoutId);
  }, [difficulty, isPremium, practiceFocus, sentenceCatalogVersion]);

  useEffect(() => {
    getCurrentAccount().then(setAccountUser);
  }, []);

  useEffect(() => {
    const generation = ++accountHydrationGenerationRef.current;
    learningStateHydratedRef.current = false;
    if (!accountUser) return;
    const isCurrentHydration = () => accountHydrationGenerationRef.current === generation;
    const localSessions = getPracticeHistory().map(session => ({
      date: session.date,
      difficulty: session.difficulty,
      wpm: session.wpm,
      accuracy: session.accuracy,
    }));
    const localReviews = getReviewWords();
    const localPoints = getPoints();
    const localTarget = getDailyTarget();
    const localGoal = getGoalWpm();
    const { learnerLevel: localLevel, coachState: localCoachState, practiceNotes: localPracticeNotes, isVietnamese: currentLanguageIsVietnamese } = accountLearningSnapshotRef.current;
    Promise.all([syncAccountSessions(localSessions, isCurrentHydration), getAccountLearningState()]).then(([remoteSessions, remoteState]) => {
      if (!isCurrentHydration()) return;
      const remoteReviews = Array.isArray(remoteState?.review_words) ? remoteState.review_words as ReviewWord[] : [];
      const mergedReviews = mergeReviewWords(localReviews, remoteReviews);
      const remoteTarget = remoteState?.daily_target && typeof remoteState.daily_target === 'object' ? remoteState.daily_target as DailyTarget : null;
      const mergedTarget = mergeDailyTarget(localTarget, remoteTarget);
      const mergedPoints = Math.max(localPoints, remoteState?.points || 0);
      const mergedGoal = remoteState?.goal_wpm || localGoal;
      const mergedLearnerLevel = isLearnerLevel(remoteState?.learner_level) ? remoteState.learner_level : localLevel;
      const mergedCoachState = mergeLearningStates(localCoachState, remoteState?.coach_state);
      const mergedPracticeNotes = mergePracticeNotes(localPracticeNotes, remoteState?.practice_notes);
      replaceReviewWords(mergedReviews);
      replacePoints(mergedPoints);
      replaceDailyTarget(mergedTarget);
      saveGoalWpm(mergedGoal);
      replaceLearningState(mergedCoachState);
      replacePracticeNotes(mergedPracticeNotes);
      if (!saveLearnerLevel(mergedLearnerLevel)) {
        setLearnerLevelSaveError(currentLanguageIsVietnamese ? 'Không thể lưu trình độ trên thiết bị này.' : 'Unable to save your level on this device.');
      } else {
        setLearnerLevelSaveError('');
      }
      setPracticeHistory(remoteSessions);
      setLearnerLevel(mergedLearnerLevel);
      setCoachState(mergedCoachState);
      setPracticeNotes(mergedPracticeNotes);
      setReviewWords(getReviewWords());
      setReviewSummary(getReviewSummary());
      setPoints(getPoints());
      setDailyTarget(getDailyTarget());
      setGoalWpm(getGoalWpm());
      setAccountSyncError('');
      learningStateHydratedRef.current = true;
    }).catch(error => {
      console.error('Unable to sync account learning data:', error);
      if (isCurrentHydration()) setAccountSyncError(currentLanguageIsVietnamese ? 'Chưa thể đồng bộ dữ liệu học tập. Hãy kiểm tra mạng rồi tải lại.' : 'Learning data could not sync. Check your connection and reload.');
    });
    return () => {
      if (isCurrentHydration()) accountHydrationGenerationRef.current += 1;
      learningStateHydratedRef.current = false;
    };
  }, [accountUser]);

  useEffect(() => {
    if (!accountUser || !learningStateHydratedRef.current) return;
    const generation = accountHydrationGenerationRef.current;
    const timer = window.setTimeout(() => {
      if (generation !== accountHydrationGenerationRef.current) return;
      void saveAccountLearningState({
        reviewWords,
        points,
        dailyTarget,
        goalWpm,
        learnerLevel,
        coachState,
        practiceNotes,
      }).then(() => {
        if (generation === accountHydrationGenerationRef.current) setAccountSyncError('');
      }).catch(error => {
        console.error('Unable to save account learning data:', error);
        const currentLanguageIsVietnamese = accountLearningSnapshotRef.current.isVietnamese;
        if (generation === accountHydrationGenerationRef.current) setAccountSyncError(currentLanguageIsVietnamese ? 'Chưa thể đồng bộ dữ liệu học tập. Hãy kiểm tra kết nối.' : 'Learning data could not sync. Check your connection.');
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [accountUser, coachState, dailyTarget, goalWpm, learnerLevel, points, practiceNotes, reviewWords]);

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

  const resetStats = useCallback((nextTimeLimit = timeLimit, disableSpeedTracking = isSentenceHidden) => {
    attemptStartedAtRef.current = null;
    setIsSpeedTrackingDisabled(disableSpeedTracking);
    recordedAttemptRef.current = false;
    setLastAttempt(null);
    setCorrectChars(0);
    setTimeLeft(nextTimeLimit);
    setTypingSpeed(0);
    setStartedAt(null);
    setHasStartedTyping(false);
    setReviewNote('');
    setReviewNoteWord('');
    setReviewNoteError('');
    setIsReviewNoteSaved(false);
    setIsReviewNoteEditorOpen(false);
  }, [isSentenceHidden, timeLimit]);

  const handleSpeak = useCallback(() => {
    speechPlaybackRequestedRef.current = true;
    if (lesson?.videoId) {
      speechService.stop();
      youtubeVideoRef.current?.replay();
      return;
    }
    speechService.prime();
    if (speakTimeoutRef.current !== null) {
      window.clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    speechService.speak(currentSentence, LANG, speed, selectedVoice, repeatCount, repeatGap * 1000, true);
  }, [currentSentence, selectedVoice, speed, lesson?.videoId, repeatCount, repeatGap]);

  useEffect(() => {
    const stopPlayback = () => {
      if (speakTimeoutRef.current !== null) {
        window.clearTimeout(speakTimeoutRef.current);
        speakTimeoutRef.current = null;
      }
      speechService.stop();
    };
    if (lesson?.videoId) {
      stopPlayback();
      return stopPlayback;
    }
    const isMobileViewport = window.matchMedia('(max-width: 640px), (pointer: coarse)').matches;
    if (isMobileViewport || !speechPlaybackRequestedRef.current) {
      stopPlayback();
      return stopPlayback;
    }
    if (speakTimeoutRef.current !== null) {
      window.clearTimeout(speakTimeoutRef.current);
    }
    speechService.stop();
    speakTimeoutRef.current = window.setTimeout(() => {
      speechService.speak(currentSentence, LANG, speed, selectedVoice, repeatCount, repeatGap * 1000);
      speakTimeoutRef.current = null;
    }, 120);

    return stopPlayback;
    // Voice and speed changes should apply on the next manual replay,
    // not trigger an automatic repeat of the current sentence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSentence, lesson?.videoId]);

  useEffect(() => {
    const handleControlKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      const isDictationInput = target?.matches('input.hidden-input') ?? false;
      if (event.key === 'Control' && !event.repeat && !event.isComposing && !event.altKey && !event.shiftKey && !event.metaKey && (!isEditing || isDictationInput)) {
        handleSpeak();
      }
    };

    window.addEventListener('keydown', handleControlKey);
    return () => window.removeEventListener('keydown', handleControlKey);
  }, [handleSpeak]);

  useEffect(() => {
    if (isFocusMode || !hasStartedTyping || startedAt === null) return;
    const tick = () => {
      const remaining = remainingSeconds(startedAt + timeLimit * 1000);
      setTimeLeft(remaining);
      const nextTypingSpeed = getTypingSpeed(correctChars, startedAt, Date.now(), isSentenceHidden || isSpeedTrackingDisabled);
      if (nextTypingSpeed !== null) setTypingSpeed(nextTypingSpeed);
      if (remaining === 0) {
        setIsTimeUp(true);
        setHasStartedTyping(false);
        setStartedAt(null);
      }
    };
    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [correctChars, hasStartedTyping, isFocusMode, isSentenceHidden, isSpeedTrackingDisabled, startedAt, timeLimit]);

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

  const clearActivePractice = () => {
    try {
      localStorage.removeItem(ACTIVE_PRACTICE_KEY);
    } catch {
      // Draft cleanup is best-effort when storage is unavailable.
    }
  };

  const clearAllPracticeDrafts = () => {
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith('zen-dictation-draft:'))
        .forEach(key => localStorage.removeItem(key));
      localStorage.removeItem(ACTIVE_PRACTICE_KEY);
    } catch {
      // Draft cleanup is best-effort when storage is unavailable.
    }
  };

  const handleNext = () => {
    if (lesson) {
      if (!recordedAttemptRef.current || lesson.completed) return;
      if (lesson.index + 1 >= lesson.texts.length) {
        setLesson({ ...lesson, completed: true });
        return;
      }
    }
    speechPlaybackRequestedRef.current = true;
    try {
      localStorage.removeItem(`zen-dictation-draft:${encodeURIComponent(currentSentence)}`);
    } catch { /* Best effort. */ }
    clearActivePractice();
    try { localStorage.setItem(LAST_SENTENCE_KEY, currentSentence); } catch { /* best effort */ }
    const attemptAccuracy = lastAttempt?.accuracy ?? (isCompleted ? 100 : 0);
    const nextDifficulty = isAdaptiveMode && !lesson ? getAdaptiveDifficulty(difficulty, attemptAccuracy) : difficulty;
    const nextIndex = getNextSentenceIndex(nextDifficulty, currentIndex);
    const nextLesson = lesson ? { ...lesson, index: lesson.index + 1 } : null;
    const nextSentence = resolvePracticeSentence(getSentencePool(practiceFocus, nextDifficulty), nextIndex, nextLesson);
    const isMobileViewport = window.matchMedia('(max-width: 640px), (pointer: coarse)').matches;
    const updateSentence = () => {
      if (nextLesson) {
        setLesson(nextLesson);
        if (nextLesson.videoId) setIsSentenceHidden(true);
      }
      if (nextDifficulty !== difficulty) setDifficulty(nextDifficulty);
      setCurrentIndex(nextIndex);
      setIsCompleted(false);
      setIsTimeUp(false);
      resetStats(timeLimit, isSentenceHidden || Boolean(nextLesson?.videoId));
      setKey(prev => prev + 1);
    };
    if (isMobileViewport && !lesson?.videoId) {
      // Finish the previous sentence's effect cleanup before starting speech.
      // Playback must remain in the tap handler for mobile browser permissions.
      flushSync(updateSentence);
      speechService.prime();
      speechService.speak(nextSentence, LANG, speed, selectedVoice, repeatCount, repeatGap * 1000, true);
    } else {
      updateSentence();
    }
  };


  const handleLearnerLevelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLevel = event.currentTarget.value;
    if (!isLearnerLevel(nextLevel)) {
      console.error('Unexpected learner level selection:', nextLevel);
      return;
    }
    const nextDifficulty = LEARNER_LEVEL_DIFFICULTY[nextLevel];
    if (nextDifficulty === 'hard' && !isPremium) {
      openPremiumDashboard();
      return;
    }
    if (!saveLearnerLevel(nextLevel)) {
      setLearnerLevelSaveError(isVietnamese ? 'Không thể lưu trình độ trên thiết bị này.' : 'Unable to save your level on this device.');
      return;
    }
    setLearnerLevelSaveError('');
    setLearnerLevel(nextLevel);
    setLesson(null);
    clearActivePractice();
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
    if ((nextFocus === 'ielts' || nextFocus === 'business') && !isPremium) {
      openPremiumDashboard();
      return;
    }
    setLesson(null);
    const nextPool = getSentencePool(nextFocus, difficulty);
    clearActivePractice();
    setPracticeFocus(nextFocus);
    setCurrentIndex(chooseRandomSentenceIndex(nextPool, recentSentenceHistoryRef.current || []));
    // setShowTranslation(false);
    setIsCompleted(false);
    setIsTimeUp(false);
    resetStats(timeLimit);
    setReviewSummary(getReviewSummary());
    setKey(prev => prev + 1);
  };

  const handlePracticeModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextAdaptive = event.target.value === 'adaptive';
    if (nextAdaptive && !isPremium) {
      openPremiumDashboard();
      return;
    }
    setIsAdaptiveMode(nextAdaptive);
  };

  const handleTimeLimitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    const safeValue = Number.isFinite(nextValue) ? Math.min(Math.max(nextValue, 10), 1800) : DEFAULT_TIME_LIMIT;
    clearActivePractice();
    try { localStorage.removeItem(`zen-dictation-draft:${encodeURIComponent(currentSentence)}`); } catch { /* Best effort. */ }
    setTimeLimit(safeValue);
    setIsCompleted(false);
    setIsTimeUp(false);
    resetStats(safeValue);
    setKey(prev => prev + 1);
  };

  const handleResetTimer = () => {
    clearActivePractice();
    try {
      localStorage.removeItem(`zen-dictation-draft:${encodeURIComponent(currentSentence)}`);
    } catch {
      // Reset must still work when browser storage is unavailable.
    }
    setIsCompleted(false);
    setIsTimeUp(false);
    setLastAttempt(null);
    resetStats(timeLimit);
    setKey(prev => prev + 1);
  };

  const handleRetry = () => {
    handleResetTimer();
  };

  const recordPremiumSession = (completedText: string, correctCharacters: number) => {
    let wpm = 0;
    if (!isSentenceHidden && !isSpeedTrackingDisabled) {
      const elapsedMinutes = startedAt ? Math.max((Date.now() - startedAt) / 60000, 1 / 60) : 1 / 60;
      wpm = Math.round((completedText.length / 5) / elapsedMinutes);
    }
    const session = {
      date: new Date().toISOString(),
      difficulty,
      wpm,
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
    saveCoachAttempt(completedText);
    clearActivePractice();
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
    saveCoachAttempt(completedText);
    clearActivePractice();
    setLastAttempt(analyzeAttempt(currentSentence, completedText));
    setLastAttemptText(completedText);
    setLastAttemptTargetText(currentSentence);
    setReviewNote('');
    setReviewNoteWord('');
    setReviewNoteError('');
    setIsReviewNoteSaved(false);
    recordWordAttempt(currentSentence, completedText);
    setReviewSummary(getReviewSummary());
    setReviewWords(getReviewWords());
    if (isPremium) handlePremiumFinish(completedText, correctCharacters, isCorrect);
    setHasStartedTyping(false);
    setStartedAt(null);
  };

  const saveCoachAttempt = (text: string) => {
    if (recordedAttemptRef.current || !currentSentence) return;
    recordedAttemptRef.current = true;
    const analysis = analyzeAttempt(currentSentence, text);
    const errors = analysis.incorrectWords.length + analysis.missingWords.length + analysis.extraWords.length;
    setCoachState(recordLearningAttempt({ text: currentSentence, focus: practiceFocus, difficulty,
      accuracy: analysis.accuracy, errors: Math.max(errors, analysis.accuracy < 100 ? 1 : 0), date: new Date().toISOString() }));
    setLastAttempt(analysis);
    setLastAttemptTargetText(currentSentence);
  };

  const startCoachLesson = (reviewOnly = false) => {
    const now = new Date().getTime();
    const levelDifficulty = LEARNER_LEVEL_DIFFICULTY[learnerLevel];
    const levelSentencePool = getSentencePool(practiceFocus, levelDifficulty);
    const texts = reviewOnly
      ? coachState.reviews.filter(item => item.focus === practiceFocus && item.difficulty === levelDifficulty && Date.parse(item.nextReviewAt) <= now && levelSentencePool.includes(item.text)).sort((a, b) => Date.parse(a.nextReviewAt) - Date.parse(b.nextReviewAt)).slice(0, 5).map(item => item.text)
      : buildDailyLesson(levelSentencePool, coachState.reviews, practiceFocus, levelDifficulty, now, coachState.attempts, getDueReviewWords());
    if (!texts.length) return;
    try { texts.forEach(text => localStorage.removeItem(`zen-dictation-draft:${encodeURIComponent(text)}`)); } catch { /* Best effort. */ }
    clearActivePractice();
    setDifficulty(levelDifficulty);
    setLesson({ texts, index: 0, completed: false });
    setIsCompleted(false);
    setIsTimeUp(false);
    resetStats(timeLimit);
    setKey(value => value + 1);
  };

  const exitCoachLesson = () => {
    setLesson(null);
    setIsCompleted(false);
    setIsTimeUp(false);
    resetStats(timeLimit);
    setKey(value => value + 1);
  };

  const chooseLearningPath = (focus: LearningFocus) => {
    if (['ielts', 'business'].includes(focus) && !isPremium) { openPaymentPage(); return; }
    setPracticeFocus(focus);
    setCurrentIndex(0);
    exitCoachLesson();
  };

  const replayMistake = (word: string) => {
    if (speakTimeoutRef.current !== null) window.clearTimeout(speakTimeoutRef.current);
    speechService.prime();
    speechService.stop();
    speechService.speak(word, LANG, Math.min(speed, 0.75), selectedVoice, 1, 1000, true);
  };

  const canSaveReviewNote = Boolean(lastAttempt && (lastAttempt.incorrectCharacters > 0 || lastAttempt.missingCharacters > 0));
  const handleSaveReviewNote = () => {
    if (!reviewNote.trim()) return;
    const word = reviewNoteWord.trim();
    if (word) {
      if (word.split(',').some(item => !/^[a-zA-Z']+$/.test(item.trim()))) {
        setReviewNoteError(isVietnamese ? 'Nhập các từ tiếng Anh, cách nhau bằng dấu phẩy; mỗi từ chỉ gồm chữ cái hoặc dấu nháy đơn.' : 'Enter English words separated by commas; use letters or apostrophes only.');
        return;
      }
      setReviewWords(saveReviewWordNotes(word, reviewNote));
      setReviewSummary(getReviewSummary());
    } else if (canSaveReviewNote) {
      saveReviewNoteForAttempt(lastAttemptTargetText, lastAttemptText, reviewNote);
      setReviewWords(getReviewWords());
      setReviewSummary(getReviewSummary());
    } else {
      setReviewNoteError(isVietnamese ? 'Nhập từ muốn lưu vào Từ cần ôn.' : 'Enter a word to save to Review words.');
      return;
    }
    setReviewNote('');
    setReviewNoteWord('');
    setReviewNoteError('');
    setIsReviewNoteSaved(true);
    setIsReviewNoteEditorOpen(false);
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
        <strong>{isVietnamese ? 'Đã mở khóa thành tựu!' : 'Achievement unlocked!'}</strong>
        <span>{isVietnamese ? ACHIEVEMENT_TRANSLATIONS_VI[achievementToast.title]?.title || achievementToast.title : achievementToast.title}</span>
        <small>{isVietnamese ? ACHIEVEMENT_TRANSLATIONS_VI[achievementToast.title]?.description || achievementToast.description : achievementToast.description}</small>
      </div>
    </div>
  ) : null;

  const appHeader = <Header
    language={language}
    accountUser={accountUser}
    isAccountOpen={isAccountOpen}
    isPremium={isPremium}
    isPremiumOpen={isPremiumOpen}
    isSettingsOpen={isSettingsOpen}
    isReviewOpen={isReviewOpen}
    isSupportOpen={isSupportOpen}
    onAccountToggle={() => setIsAccountOpen(open => !open)}
    onAuthenticated={user => { setAccountUser(user); setIsAccountOpen(false); }}
    onLoggedOut={() => {
      accountHydrationGenerationRef.current += 1;
      learningStateHydratedRef.current = false;
      setIsAccountOpen(false);
      clearReviewWords();
      clearPointsState();
      clearPremiumLearningState();
      clearLearningState();
      setCoachState(readLearningState());
      clearPracticeNotes();
      setPracticeNotes(readPracticeNotes());
      clearLearnerLevel();
      setLearnerLevel('beginner');
      setDifficulty('easy');
      setLearnerLevelSaveError('');
      setAccountSyncError('');
      setLesson(null);
      clearAllPracticeDrafts();
      setAccountUser(null);
      setPracticeHistory([]);
      setReviewWords(getReviewWords());
      setReviewSummary(getReviewSummary());
      setPoints(getPoints());
      setDailyTarget(getDailyTarget());
      setGoalWpm(getGoalWpm());
    }}
    onPremiumOpen={isPremium ? openPremiumDashboard : openPaymentPage}
    onSettingsToggle={() => {
      if (isSupportOpen) window.history.pushState({}, '', window.location.pathname + window.location.search);
      setIsSupportOpen(false);
      setIsSettingsOpen(open => !open);
    }}
    onReviewOpen={() => openReviewPage()}
    onSupportOpen={openSupportPage}
  />;

  if (isReviewOpen) {
    return <Suspense fallback={<div className="screen-loading" role="status">{isVietnamese ? 'Đang tải mục ôn tập…' : 'Loading review…'}</div>}><>
      <SiteNotice />
      {achievementToastNode}
      <ReviewPage
        language={language}
        words={reviewWords}
        onAddWord={handleAddReviewWord}
        onUpdateWord={handleUpdateReviewWord}
        onRemoveWord={handleRemoveReviewWord}
        onPracticeWord={startDueWordPractice}
        practiceError={reviewPracticeError}
        initialWord={reviewWord}
        onBack={closeReviewPage}
      />
      <LanguageSwitcher />
    </></Suspense>;
  }

  if (isPremiumOpen) {
    return <Suspense fallback={<div className="screen-loading" role="status">{isVietnamese ? 'Đang tải bảng điều khiển…' : 'Loading dashboard…'}</div>}><>
      <SiteNotice />
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
      <footer className="app-footer"><span>Zentation</span></footer>
      <LanguageSwitcher />
    </></Suspense>;
  }

  if (isPaymentResultOpen) {
    return <Suspense fallback={<div className="screen-loading" role="status">{isVietnamese ? 'Đang tải thanh toán…' : 'Loading payment…'}</div>}><>
      <SiteNotice />
      {achievementToastNode}
      <PaymentResultPage onBack={closePaymentResult} onActivated={() => { setIsPaymentResultOpen(false); openPremiumDashboard(); }} />
      <footer className="app-footer"><span>Zentation</span></footer>
      <LanguageSwitcher />
    </></Suspense>;
  }

  if (isPaymentOpen) {
    if (isPremium) {
      return <Suspense fallback={<div className="screen-loading" role="status">{isVietnamese ? 'Đang tải bảng điều khiển…' : 'Loading dashboard…'}</div>}><>
        <SiteNotice />
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
        <footer className="app-footer"><span>Zentation</span></footer>
        <LanguageSwitcher />
      </></Suspense>;
    }

    return <Suspense fallback={<div className="screen-loading" role="status">{isVietnamese ? 'Đang tải thanh toán…' : 'Loading payment…'}</div>}><>
      <SiteNotice />
      {achievementToastNode}
      <PaymentPage onBack={closePaymentPage} onLicenseClick={() => { closePaymentPage(); openPremiumDashboard(); }} />
      <footer className="app-footer"><span>Zentation</span></footer>
      <LanguageSwitcher />
    </></Suspense>;
  }

  if (isSupportOpen) {
    return <Suspense fallback={<div className="screen-loading" role="status">{isVietnamese ? 'Đang tải trang ủng hộ…' : 'Loading support…'}</div>}>
      <>
      <SiteNotice />
      <div className="app-layout">
        {achievementToastNode}
        {appHeader}
        <main className="app-content support-content"><SupportPage /></main>
        <footer className="app-footer"><span>Zentation · {isVietnamese ? 'Luyện nghe tiếng Anh' : 'English listening practice'}</span></footer>
      </div>
      <LanguageSwitcher />
      </>
    </Suspense>;
  }

  const handleTypingChange = (nextValue: string) => {
    if (isTimeUp) return false;
    const now = Date.now();
    if (isFocusMode && focusDeadline !== null && now >= focusDeadline) {
      setFocusTimeLeft(0);
      return false;
    }
    if (!isFocusMode && attemptStartedAtRef.current !== null && remainingSeconds(attemptStartedAtRef.current + timeLimit * 1000, now) === 0) {
      setTimeLeft(0);
      setIsTimeUp(true);
      setHasStartedTyping(false);
      setStartedAt(null);
      return false;
    }
    if (nextValue) {
      try {
        localStorage.setItem(ACTIVE_PRACTICE_KEY, JSON.stringify({ difficulty, focus: practiceFocus, index: currentIndex, targetText: currentSentence } satisfies ActivePractice));
      } catch {
        // Draft persistence is best-effort when storage is unavailable.
      }
    }
    const nextCorrectChars = Array.from(nextValue).reduce((count, char, index) => {
      const targetChar = currentSentence[index];
      return count + (targetChar && char.toLowerCase() === targetChar.toLowerCase() ? 1 : 0);
    }, 0);
    if (nextValue.length > 0) setLastAttempt(null);
    setCorrectChars(nextCorrectChars);
    if (nextValue.length > 0 && attemptStartedAtRef.current === null) {
      attemptStartedAtRef.current = now;
      setHasStartedTyping(true);
      setStartedAt(now);
    }
    if (nextValue.length === 0) {
      setTypingSpeed(0);
      setCorrectChars(0);
    }
    return true;
  };

  return (
    <>
    {!isFocusMode && <SiteNotice />}
    <div className={`app-layout ${isFocusMode ? 'focus-mode' : ''}`}>
      {achievementToastNode}
      {!isFocusMode && appHeader}
      {!isFocusMode && showOnboarding && (
        <section className="onboarding-card" aria-label={isVietnamese ? 'Hướng dẫn luyện tập' : 'How to practice'}>
          <div><span className="premium-kicker">{isVietnamese ? 'Chào mừng đến với Zen Dictation' : 'Welcome to Zen Dictation'}</span><h2>{isVietnamese ? 'Bốn bước nhẹ nhàng để nghe tốt hơn.' : 'Four quiet steps to better listening.'}</h2><p>{isVietnamese ? 'Nghe, gõ lại nội dung bạn nghe được, rồi dùng phản hồi để cải thiện độ chính xác và tốc độ.' : 'Listen, type what you hear, then use the feedback to improve your accuracy and speed.'}</p></div>
          <div className="onboarding-steps"><span><b>1</b> {isVietnamese ? 'Nghe' : 'Listen'}</span><span><b>2</b> {isVietnamese ? 'Gõ' : 'Type'}</span><span><b>3</b> {isVietnamese ? 'Lặp lại' : 'Repeat'}</span><span><b>4</b> {isVietnamese ? 'Cải thiện' : 'Improve'}</span></div>
          <button type="button" onClick={() => { localStorage.setItem('zen-dictation-onboarding-seen', 'true'); setShowOnboarding(false); }}>{isVietnamese ? 'Bắt đầu luyện tập' : 'Start practicing'}</button>
        </section>
      )}
      {!isFocusMode && isPremiumOpen && (
        <section className="premium-panel" aria-label={isVietnamese ? 'Tính năng Premium' : 'Premium features'}>
          {isPremium ? (
            <>
              <div className="premium-heading"><span className="premium-kicker">Zen Dictation Premium</span><strong>{isVietnamese ? 'Tổng quan học tập' : 'Your learning dashboard'}</strong></div>
              <div className="premium-metrics">
                <div><span>{isVietnamese ? 'Tốc độ tốt nhất' : 'Best speed'}</span><strong>{bestWpm || '—'} <small>WPM</small></strong></div>
                <div><span>{isVietnamese ? 'Độ chính xác' : 'Accuracy'}</span><strong>{averageAccuracy || '—'}<small>%</small></strong></div>
                <div><span>{isVietnamese ? 'Lượt luyện tập' : 'Sessions'}</span><strong>{practiceHistory.length}</strong></div>
              </div>
              <label className="goal-control">{isVietnamese ? 'Mục tiêu tốc độ mỗi ngày' : 'Daily speed goal'} <input type="number" min="10" max="200" value={goalWpm} onChange={handleGoalChange} /> WPM</label>
              <div className="history-heading"><span>{isVietnamese ? 'Lượt gần đây' : 'Recent sessions'}</span><small>{isVietnamese ? 'Đã lưu trên thiết bị này' : 'Saved on this device'}</small></div>
              {practiceHistory.length === 0 ? <p className="premium-empty">{isVietnamese ? 'Hoàn thành một câu để bắt đầu lưu lịch sử luyện tập.' : 'Complete a practice sentence to start your personal history.'}</p> : <div className="history-list">{practiceHistory.slice(0, 5).map(session => <div className="history-row" key={session.id}><span>{new Date(session.date).toLocaleDateString(isVietnamese ? 'vi-VN' : 'en-US')} · {isVietnamese ? ({ easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' } as const)[session.difficulty] : session.difficulty}</span><strong>{session.wpm > 0 ? `${session.wpm} WPM` : '— WPM'} · {session.accuracy}%</strong></div>)}</div>}
            </>
          ) : (
            <div className="premium-upsell">
              <span className="premium-kicker">Zen Dictation Premium</span>
              <strong>{isVietnamese ? 'Theo dõi tiến độ. Học tập có mục tiêu.' : 'See your progress. Improve with purpose.'}</strong>
              <p>{isVietnamese ? 'Biến mỗi buổi luyện tập thành thói quen học tập rõ ràng và có thể đo lường.' : 'Turn every practice session into a clear, measurable learning habit.'}</p>
              <div className="premium-benefits">
                <div><span className="benefit-icon" aria-hidden="true">↗</span><span><strong>{isVietnamese ? 'Nắm rõ tiến độ của bạn' : 'Know your real progress'}</strong><small>{isVietnamese ? 'Theo dõi tốc độ tốt nhất và độ chính xác trung bình.' : 'Track your best speed and average accuracy over time.'}</small></span></div>
                <div><span className="benefit-icon" aria-hidden="true">▤</span><span><strong>{isVietnamese ? 'Không bỏ lỡ buổi luyện tập nào' : 'Never lose a practice session'}</strong><small>{isVietnamese ? 'Lưu lịch sử 30 kết quả gần nhất của bạn.' : 'Keep a personal history of your latest 30 results.'}</small></span></div>
                <div><span className="benefit-icon" aria-hidden="true">◎</span><span><strong>{isVietnamese ? 'Đặt mục tiêu giúp bạn tiến bộ' : 'Set a goal that keeps you moving'}</strong><small>{isVietnamese ? 'Chọn mục tiêu WPM và tận dụng từng buổi luyện tập.' : 'Choose a WPM target and make each session count.'}</small></span></div>
                <div><span className="benefit-icon" aria-hidden="true">✦</span><span><strong>{isVietnamese ? 'Tạo động lực khi luyện tập' : 'Make practice feel rewarding'}</strong><small>{isVietnamese ? 'Theo dõi các cột mốc trong bảng điều khiển tập trung.' : 'See your milestones in one calm, focused dashboard.'}</small></span></div>
              </div>
            </div>
          )}
        </section>
      )}
      {!isFocusMode && isSettingsOpen && (
        <section id="settings-menu" className="settings-panel" aria-label={isVietnamese ? 'Cài đặt' : 'Settings'}>
          <label className="settings-field">
            <span>{isVietnamese ? 'Trình độ' : 'Level'}</span>
            <select value={learnerLevel} onChange={handleLearnerLevelChange}>
              <option value="beginner">{isVietnamese ? 'Sơ cấp' : 'Beginner'} · A1–A2</option>
              <option value="intermediate">{isVietnamese ? 'Trung cấp' : 'Intermediate'} · B1–B2</option>
              <option value="advanced" disabled={!isPremium}>{isVietnamese ? 'Nâng cao' : 'Advanced'} · C1–C2 {isPremium ? '' : '(Premium)'}</option>
            </select>
            <small className="level-guide" role="note">{isVietnamese ? 'Cambridge: ' : 'Cambridge: '}{CAMBRIDGE_LEVELS[LEARNER_LEVEL_DIFFICULTY[learnerLevel]].exams}</small>
            {learnerLevelSaveError && <small className="level-guide" role="alert">{learnerLevelSaveError}</small>}
            {accountUser && accountSyncError && <small className="level-guide" role="alert">{accountSyncError}</small>}
          </label>
          <label className="settings-field">
            <span>{isVietnamese ? 'Nội dung' : 'Focus'}</span>
            <select value={practiceFocus} onChange={handleFocusChange}>
              <option value="mixed">{isVietnamese ? 'Luyện tập tổng hợp' : 'Mixed practice'}</option>
              <option value="vocabulary">{isVietnamese ? 'Từ vựng' : 'Vocabulary'}</option>
              <option value="idioms">{isVietnamese ? 'Thành ngữ' : 'Idioms'}</option>
              <option value="ielts" disabled={!isPremium}>IELTS · Premium</option>
              <option value="business" disabled={!isPremium}>{isVietnamese ? 'Giao tiếp công việc' : 'Business pack'} · Premium</option>
            </select>
            <small className="review-status" role="status">
              {reviewSummary.due > 0 ? (isVietnamese ? `${reviewSummary.due} từ đến hạn ôn tập` : `${reviewSummary.due} word${reviewSummary.due === 1 ? '' : 's'} ready to review`) : (isVietnamese ? `Đang theo dõi ${reviewSummary.total} từ` : `${reviewSummary.total} words tracked`)}
            </small>
          </label>
          <label className="settings-field">
            <span>{isVietnamese ? 'Chế độ luyện' : 'Practice'}</span>
            <select value={isAdaptiveMode ? 'adaptive' : 'guided'} onChange={handlePracticeModeChange}>
              <option value="guided">{isVietnamese ? 'Có hướng dẫn' : 'Guided'}</option>
              <option value="adaptive" disabled={!isPremium}>{isVietnamese ? 'Thích ứng' : 'Adaptive'} · Premium</option>
            </select>
            <small className="level-guide" role="note">
              {isAdaptiveMode ? (isVietnamese ? 'Trình độ tự điều chỉnh theo độ chính xác' : 'Level adjusts to your accuracy') : (isVietnamese ? 'Tự chọn trình độ.' : 'Choose level yourself.')}
            </small>
          </label>
          {reviewWords.length > 0 && (
            <section className="review-words" aria-label={isVietnamese ? 'Từ cần ôn tập' : 'Words to review'}>
              <div className="review-words-heading"><strong>{isVietnamese ? 'Từ cần ôn' : 'Review words'}</strong><small>{isVietnamese ? `${reviewSummary.due} từ đến hạn` : `${reviewSummary.due} due now`}</small></div>
              <div className="review-words-list">
                {reviewWords.slice(0, 8).map(review => {
                  const isDue = new Date(review.nextReviewAt).getTime() <= reviewNow;
                  return <div className="review-word" key={review.word}><strong>{review.word}</strong>{isDue ? <button type="button" className="review-due-button" onClick={() => startDueWordPractice(review.word)}>{isVietnamese ? `${review.mistakes} lỗi · Đến hạn` : `${review.mistakes} mistake${review.mistakes === 1 ? '' : 's'} · Due now`}</button> : <span>{isVietnamese ? `${review.mistakes} lỗi · Chuỗi ${review.correctStreak}` : `${review.mistakes} mistake${review.mistakes === 1 ? '' : 's'} · Streak ${review.correctStreak}`}</span>}</div>;
                })}
              </div>
              {reviewPracticeError && <small className="review-practice-error" role="alert">{reviewPracticeError}</small>}
              {reviewWords.length > 8 && <small className="review-words-more">{isVietnamese ? `Đang hiển thị 8/${reviewWords.length} từ` : `Showing 8 of ${reviewWords.length} words`}</small>}
              <button type="button" className="review-words-button" onClick={() => openReviewPage()}>{isVietnamese ? 'Mở trang ôn tập' : 'Open review page'}</button>
            </section>
          )}
                  <label className="settings-field">
            <span>{isVietnamese ? 'Số lần đọc' : 'Count'}</span>
            <select value={repeatCount} onChange={event => setRepeatCount(Number(event.target.value))}>
              {REPEAT_COUNTS.map(count => <option key={count} value={count}>{count} {isVietnamese ? 'lần' : count === 1 ? 'time' : 'times'}</option>)}
            </select>
          </label>
          <label className="settings-field">
            <span>{isVietnamese ? 'Thời gian nghỉ' : 'Pause'}</span>
            <select value={repeatGap} onChange={event => setRepeatGap(Number(event.target.value))}>
              {REPEAT_GAPS.map(gap => <option key={gap} value={gap}>{gap} {isVietnamese ? 'giây' : gap === 1 ? 'second' : 'seconds'}</option>)}
            </select>
          </label>
          <div className="settings-field settings-speed-field">
            <span>{isVietnamese ? 'Tốc độ' : 'Speed'}</span>
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
            <span>{isVietnamese ? 'Giọng đọc' : 'Voice'}</span>
            <select value={selectedVoice} onChange={event => setSelectedVoice(event.target.value)} disabled={voiceStatus === 'unsupported'}>
              <option value={DEFAULT_VOICE_NAME}>Google US English (default)</option>
              <option value="">{isVietnamese ? 'Giọng mặc định của trình duyệt' : 'Browser default voice'}</option>
              {voices.filter(voice => voice.name !== DEFAULT_VOICE_NAME).map(voice => <option key={`${voice.name}-${voice.voiceURI}`} value={voice.name}>{voice.name}</option>)}
            </select>
            <small className={`voice-status voice-status-${voiceStatus}`} role="status">
              {voiceStatus === 'loading' ? (isVietnamese ? 'Đang tải giọng đọc…' : 'Loading voices…') : voiceStatus === 'unsupported' ? (isVietnamese ? 'Không hỗ trợ đọc văn bản' : 'Speech unavailable') : voiceStatus === 'speaking' ? (isVietnamese ? 'Đang đọc' : 'Speaking') : voiceStatus === 'error' ? (isVietnamese ? 'Thử lại' : 'Try Again') : (isVietnamese ? 'Sẵn sàng' : 'Ready')}
            </small>
            <small>{isVietnamese ? 'Ưu tiên Google US English nếu có; nếu không sẽ dùng giọng tiếng Anh khác. Tùy chọn mặc định dùng giọng đọc trên thiết bị của bạn.' : 'Google US English is preferred when available; otherwise another English voice is used. Browser default uses your device’s voice.'}</small>
          </label>
          
        </section>
      )}
      {isFocusMode && <div className="focus-toolbar"><span><b>{isVietnamese ? 'Chế độ tập trung' : 'Focus mode'}</b><small>{isVietnamese ? 'Luyện tập không bị làm phiền' : 'Distraction-free practice'}</small></span><strong>{Math.floor(focusTimeLeft / 60)}:{String(focusTimeLeft % 60).padStart(2, '0')}</strong><button type="button" onClick={exitFocusMode}>{isVietnamese ? 'Thoát' : 'Exit focus'}</button></div>}
      {isFocusMode && focusSessionComplete && <section className="focus-summary" role="status"><span className="premium-kicker">{isVietnamese ? 'Hoàn thành buổi luyện tập' : 'Session complete'}</span><h2>{isVietnamese ? 'Tuyệt vời! Bạn đã tập trung luyện tập.' : 'Well done. You stayed focused.'}</h2><p>{isSentenceHidden || isSpeedTrackingDisabled ? (isVietnamese ? 'Không đo tốc độ gõ khi ẩn câu.' : 'Typing speed is not tracked while the sentence is hidden.') : (isVietnamese ? `Tốc độ ở lần luyện cuối là ${typingSpeed.toFixed(1)} WPM.` : `Your typing speed for this session was ${typingSpeed.toFixed(1)} WPM.`)}</p><button type="button" className="action-btn next" onClick={exitFocusMode}>{isVietnamese ? 'Quay lại luyện tập' : 'Back to practice'}</button></section>}
      <main className="app-content">
        {SHOW_YOUTUBE_IMPORT && !isFocusMode && <YoutubeImport busy={hasStartedTyping && !lastAttempt} lesson={lesson?.videoId ? lesson : null}
          onExit={exitCoachLesson} onImport={(texts, videoId, captions) => {
            speechService.stop();
            clearActivePractice();
            setLesson({ texts, videoId, captions, index: 0, completed: false });
            setIsSentenceHidden(true);
            setIsCompleted(false);
            setIsTimeUp(false);
            resetStats(timeLimit, true);
            setKey(value => value + 1);
          }} />}
        {lesson?.videoId && lesson.captions?.[lesson.index] && <YoutubeVideo key={lesson.videoId} ref={youtubeVideoRef}
          videoId={lesson.videoId} caption={lesson.captions[lesson.index]} speed={speed} completed={lesson.completed} />}
        {!isFocusMode && !lesson?.videoId && <LearningCoach state={coachState} focus={practiceFocus} difficulty={difficulty} premium={isPremium}
          ready={Boolean(sentencePool.length)} busy={hasStartedTyping && !lastAttempt} lesson={lesson}
          onStart={() => startCoachLesson()} onReview={() => startCoachLesson(true)} onExit={exitCoachLesson} onPath={chooseLearningPath} />}
        {!isFocusMode && (
          <>
            <div className="stats-row">
              <div className="time-limit-control" ><span className="stat-label">{isVietnamese ? 'Tốc độ gõ' : 'Typing speed'}</span><strong>{isSentenceHidden || isSpeedTrackingDisabled ? '—' : `${typingSpeed.toFixed(1)} WPM`}</strong></div>
              <div>
                <div className="time-limit-control"> <span className="stat-label">{isVietnamese ? 'Giới hạn thời gian' : 'Time limit'}</span>
                  <input type="number" min={10} max={1800} step={5} value={timeLimit} onChange={handleTimeLimitChange} aria-label={isVietnamese ? 'Giới hạn thời gian tùy chỉnh tính bằng giây' : 'Custom time limit in seconds'} />
                  <span>s</span>
                </div>
                <strong>{hasStartedTyping ? (isVietnamese ? `Còn ${timeLeft}s` : `${timeLeft}s left`) : (isVietnamese ? 'Đang chờ...' : 'Waiting...')}</strong>
              </div>
              <div className="daily-target-card">
                <span className="stat-label">{isVietnamese ? 'Mục tiêu hôm nay' : 'Daily target'}</span>
                <strong>{Math.min(dailyTarget.progress, dailyTarget.target)}/{dailyTarget.target}</strong>
                <div className="stat-label" aria-label={isVietnamese ? 'Tiến độ mục tiêu hôm nay' : 'Daily target progress'}>
                  <span style={{ width: `${Math.min((dailyTarget.progress / dailyTarget.target) * 100, 100)}%` }} />
                </div>
                <small > {dailyTarget.completed ? `${isVietnamese ? 'Đã nhận thưởng' : 'Reward claimed'} +${dailyTarget.rewardPoints}` : `${isVietnamese ? 'Thưởng' : 'Reward'} +${dailyTarget.rewardPoints}`}</small>
              </div>
              <div className="points-stat"><span className="stat-label">{isVietnamese ? 'Điểm' : 'Points'}</span><strong>{points}</strong><small></small></div>
            </div>

            <div className={'status-badge ' + (isTimeUp ? 'status-error' : isCompleted ? 'status-success' : 'status-ready')} role="status" aria-live="polite">
              {isTimeUp && !isCompleted ? (
                <>
                  <span aria-hidden="true">⏰</span> <strong>{isVietnamese ? 'Hết giờ' : 'Time’s up'}</strong> — {isVietnamese ? 'Nhấn Đặt lại giờ để thử lại.' : 'Hit Reset Timer to try again.'}
                </>
              ) : isCompleted ? (isVietnamese ? '🎉 Hoàn thành! +10 điểm cho câu chính xác' : '🎉 Done! +10 points perfect sentence') : (isVietnamese ? '🎧 Nghe và gõ lại...' : '🎧 Listen and type...')}
            </div>

            <div className="timer-action-group">
              <button type="button" className="reset-timer-btn" onClick={handleResetTimer}>{isVietnamese ? 'Đặt lại giờ' : 'Reset Timer'}</button>
              <button type="button" className="add-note-btn" onClick={() => { setIsReviewNoteSaved(false); setIsReviewNoteEditorOpen(open => !open); }} aria-expanded={isReviewNoteEditorOpen}>
                {isReviewNoteEditorOpen ? (isVietnamese ? 'Đóng ghi chú' : 'Close Note') : (isVietnamese ? 'Thêm ghi chú' : 'Add Note')}
              </button>
            </div>
            {isReviewNoteEditorOpen && (
              <div className="practice-note-modal-backdrop" onClick={event => {
                if (event.target === event.currentTarget) setIsReviewNoteEditorOpen(false);
              }}>
                <section className="practice-note-modal" role="dialog" aria-modal="true" aria-labelledby="practice-note-title">
                  <header className="practice-note-modal-header">
                    <div><h2 id="practice-note-title">{isVietnamese ? 'Thêm ghi chú' : 'Add a note'}</h2><p>{isVietnamese ? 'Lưu ghi chú cho từ sai trong câu hoặc thêm nhiều từ tiếng Anh, cách nhau bằng dấu phẩy. Ghi chú sẽ áp dụng cho tất cả từ.' : 'Save a note for a missed word or add multiple comma-separated English words. The note will apply to each word.'}</p></div>
                    <button type="button" className="practice-note-modal-close" onClick={() => setIsReviewNoteEditorOpen(false)} aria-label={isVietnamese ? 'Đóng ghi chú' : 'Close note popup'}>×</button>
                  </header>
                  <div className="review-note-editor">
                    <label htmlFor="practice-review-word">{isVietnamese ? 'Từ cần thêm (cách nhau bằng dấu phẩy; có thể bỏ trống nếu vừa làm sai)' : 'Words to add (comma-separated; optional if you just made a mistake)'}</label>
                    <input id="practice-review-word" value={reviewNoteWord} onChange={event => { setReviewNoteWord(event.target.value); setReviewNoteError(''); setIsReviewNoteSaved(false); }} placeholder={isVietnamese ? 'Ví dụ: apple, learning, practice' : 'Example: apple, learning, practice'} maxLength={1000} autoComplete="off" />
                    <label htmlFor="practice-review-note">{isVietnamese ? 'Ghi chú của bạn' : 'Your note'}</label>
                    <textarea id="practice-review-note" value={reviewNote} onChange={event => { setReviewNote(event.target.value); setReviewNoteError(''); setIsReviewNoteSaved(false); }} placeholder={isVietnamese ? 'Thêm suy nghĩ hoặc lời nhắc...' : 'Add a thought or reminder...'} maxLength={240} autoFocus />
                    {reviewNoteError && <small className="review-edit-error" role="alert">{reviewNoteError}</small>}
                    <button type="button" onClick={handleSaveReviewNote} disabled={!reviewNote.trim() || (!reviewNoteWord.trim() && !canSaveReviewNote)}>{isVietnamese ? 'Lưu vào Từ cần ôn' : 'Save to Review words'}</button>
                    {isReviewNoteSaved && <span role="status">{isVietnamese ? 'Đã lưu ghi chú.' : 'Note saved.'}</span>}
                  </div>
                </section>
              </div>
            )}
          </>
        )}

        {!currentSentence ? (
          <section className="sentence-catalog-state" role="status">
            <strong>{sentenceCatalogStatus === 'error' ? (isVietnamese ? 'Không thể tải ngân hàng câu' : 'Sentence bank unavailable') : (isVietnamese ? 'Đang tải ngân hàng câu…' : 'Loading sentence bank…')}</strong>
            <small>{sentenceCatalogStatus === 'error' ? (isVietnamese ? 'Kiểm tra máy chủ API rồi tải lại trang.' : 'Check the API server and try refreshing the page.') : (isVietnamese ? 'Đang kết nối...' : 'Connecting...')}</small>
          </section>
        ) : <>
        <DictationArea language={language} key={`${key}:${practiceFocus}:${difficulty}:${lesson?.index ?? ''}:${currentSentence}`} targetText={currentSentence} onComplete={handlePerfectComplete} onFinish={handleAttemptFinish} onNext={handleNext} onTypingChange={handleTypingChange} isHidden={isSentenceHidden && !isTimeUp && !focusSessionComplete && !(lesson?.videoId && lastAttempt)} disabled={Boolean(lesson?.completed) || focusSessionComplete} readOnly={isTimeUp} />

        {/* {!isFocusMode && (
          <div className="translation-panel">
            <button type="button" className="translation-toggle" onClick={() => setShowTranslation(value => !value)}>
              <span className="translation-toggle-icon" aria-hidden="true">{showTranslation ? '−' : '+'}</span>
              {showTranslation ? 'Hide' : 'Reveal'}
            </button>
            {showTranslation && <p className="translation-text">{currentTranslation}</p>}
          </div>
        )} */}

        <button type="button" className="visibility-toggle" onClick={() => {
          const shouldHide = !isSentenceHidden;
          setIsSentenceHidden(shouldHide);
          if (shouldHide) {
            setIsSpeedTrackingDisabled(true);
            setTypingSpeed(0);
          } else if (attemptStartedAtRef.current === null) {
            setIsSpeedTrackingDisabled(false);
          }
        }} aria-pressed={isSentenceHidden && !isTimeUp && !focusSessionComplete} disabled={isTimeUp || focusSessionComplete}>
          {isSentenceHidden && !isTimeUp && !focusSessionComplete ? (isVietnamese ? 'Hiện câu' : 'Show sentence') : (isVietnamese ? 'Ẩn câu' : 'Hide sentence')}
        </button>

        {!isFocusMode && lastAttempt && (
          <div className="attempt-summary" role="status" aria-live="polite">
            <strong>{isVietnamese ? `Độ chính xác ${lastAttempt.accuracy}%` : `${lastAttempt.accuracy}% accuracy`}</strong>
            {lastAttempt.incorrectWords.length > 0 && <div className="incorrect-details" aria-label="Incorrect words">
              {/* <span>Words */}
              <div className="incorrect-details-list">
                {lastAttempt.incorrectWords.map((detail, index) => <span className="incorrect-word" key={`${detail.actual}-${detail.expected}-${index}`}><b>{detail.actual}</b><i>→</i><strong>{detail.expected}</strong></span>)}
              </div>
            </div>}
            {lastAttempt.missingWords.length > 0 && <div className="word-difference missing-words"><span>{isVietnamese ? 'Thiếu' : 'Missing'}</span><strong>{lastAttempt.missingWords.join(', ')}</strong></div>}
            {lastAttempt.extraWords.length > 0 && <div className="word-difference extra-words"><span>{isVietnamese ? 'Thừa' : 'Extra'}</span><strong>{lastAttempt.extraWords.join(', ')}</strong></div>}
            <div className="error-coaching">
              <strong className="error-coaching-title">{lastAttempt.accuracy === 100 ? (isVietnamese ? 'Làm tốt lắm' : 'Well done') : (isVietnamese ? 'Nghe và cải thiện' : 'Listen & improve')}</strong>
              {[...new Set([...lastAttempt.incorrectWords.map(item => item.expected), ...lastAttempt.missingWords])].slice(0, 6).map(word => <button type="button" key={word} aria-label={isVietnamese ? `Nghe từ đúng: ${word}` : `Listen to the correct word: ${word}`} disabled={voiceStatus === 'unsupported'} onClick={() => replayMistake(word)}><span aria-hidden="true">▷</span> {word}</button>)}
              <details><summary>{isVietnamese ? 'Giải thích và ý nghĩa' : 'Explanation & meaning'}</summary>
            {getVerifiedSentenceTranslation(lastAttemptTargetText) && <p lang="vi">   <i> <strong> {getVerifiedSentenceTranslation(lastAttemptTargetText)}</strong> </i> </p>}
              {lastAttempt.incorrectWords.length > 0 && <p>{isVietnamese ? 'Bạn đã nhập từ khác hoặc sai chính tả. Nghe lại từ đúng thật chậm rồi đối chiếu các chữ cái.' : 'A different word or spelling was entered. Listen to the correct word slowly, then compare the letters.'}</p>}
              {lastAttempt.missingWords.length > 0 && <p>{isVietnamese ? 'Bạn còn thiếu từ. Hãy chú ý các từ nối ngắn và đuôi từ.' : 'Words are missing. Listen for short connecting words and word endings.'}</p>}
              {lastAttempt.extraWords.length > 0 && <p>{isVietnamese ? 'Bạn đã nhập thừa từ. Nghe lại câu và xác định chính xác những từ được đọc.' : 'Extra words were entered. Replay the sentence and check exactly which words you hear.'}</p>}
              {!lastAttempt.incorrectWords.length && !lastAttempt.missingWords.length && !lastAttempt.extraWords.length && <p>{lastAttempt.accuracy === 100 ? (isVietnamese ? 'Chính xác! Hãy tiếp tục luyện tập để thành thạo hơn.' : 'All correct. Keep practising to make this feel natural.') : (isVietnamese ? 'Các từ đã khớp. Kiểm tra dấu câu và khoảng trắng để hoàn thành chính xác.' : 'The words match. Check punctuation and spacing for a perfect answer.')}</p>}
              {/* <p><small>Grammar focus: {lastAttempt.grammarTip}</small></p> */}
              </details>
              {/* {lastAttempt.accuracy < 100 && <small>This sentence is saved for review tomorrow.</small>} */}
            </div>
            <button type="button" className="retry-attempt-button" onClick={handleRetry}>{isVietnamese ? 'Thử lại' : 'Try again'}</button>
          </div>
        )}

        <Controls language={language} onReplay={handleSpeak} onNext={handleNext} nextDisabled={nextButtonDisabled || Boolean(lesson && ((!lastAttempt && !isCompleted) || lesson.completed))} />
        {!lesson?.videoId && (voiceStatus === 'error' || voiceStatus === 'unsupported') && <p className="speech-playback-error" role="alert">
          {voiceStatus === 'unsupported' ? (isVietnamese ? 'Trình duyệt này không hỗ trợ phát giọng nói.' : 'Speech playback is unavailable in this browser.') : voiceError}
        </p>}
        </>}
        
      </main>
      {!isFocusMode && <footer className="app-footer"><p> <i> {isVietnamese ? 'Mẹo: Tập trung nghe âm thanh, rồi đến chữ cái. Lặp lại ba lần để đạt kết quả tốt nhất.' : 'Tip: Focus on the sounds, then the letters. Repeat three times for best results.'} </i> </p></footer>}
    </div>
    {!isFocusMode && <LanguageSwitcher />}
    </>
  );
}

export default App;
