import { getWeeklyReport, LEARNING_PATHS, type LearningFocus, type LearningState } from '../../services/learningCoach';
import type { Difficulty } from '../../utils/sentenceTranslations';
import './LearningCoach.css';
import { useEffect, useState } from 'react';
import { applyTheme, getTheme } from '../../services/themeService';

interface Props {
  state: LearningState;
  focus: LearningFocus;
  difficulty: Difficulty;
  premium: boolean;
  ready: boolean;
  busy: boolean;
  lesson: { texts: string[]; index: number; completed: boolean } | null;
  onStart: () => void;
  onReview: () => void;
  onExit: () => void;
  onPath: (focus: LearningFocus) => void;
}
export default function LearningCoach({ state, focus, difficulty, premium, ready, busy, lesson, onStart, onReview, onExit, onPath }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [theme, setTheme] = useState(getTheme);
  const toggleTheme = () => {
    const nextTheme = getTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme, true);
    setTheme(nextTheme);
  };
  const [panel, setPanel] = useState<'review' | 'progress' | 'goal' | null>(null);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  const reportNow = Math.max(now, Date.parse(state.attempts[0]?.date || '') || now);
  const report = getWeeklyReport(state.attempts, focus, difficulty, reportNow);
  const due = state.reviews.filter(item => item.focus === focus && item.difficulty === difficulty && Date.parse(item.nextReviewAt) <= reportNow).length;
  const path = LEARNING_PATHS.find(item => item.focus === focus)!;
  const completed = new Set(state.attempts.filter(item => item.focus === focus && item.difficulty === difficulty && item.errors === 0).map(item => item.text)).size;
  const milestones = [5, 15, 30];
  const milestone = milestones.find(target => completed < target) || 30;
  const togglePanel = (next: 'review' | 'progress' | 'goal') => setPanel(current => current === next ? null : next);
  return <section className="learning-coach" aria-label="Your learning plan">
    <div className="coach-main">
      <button type="button" className="coach-symbol" onClick={toggleTheme} aria-label="Dark mode" aria-pressed={theme === 'dark'} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{theme === 'dark' ? <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" /> : <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="4" /></>}</svg></button>
      <div className="coach-intro"><span className="coach-eyebrow">A LITTLE EVERY DAY</span><h2>{lesson?.completed ? 'Nicely done.' : lesson ? 'Your daily lesson' : 'Make time for progress.'}</h2><p role={lesson ? 'status' : undefined}>{lesson ? lesson.completed ? `${lesson.texts.length} sentences practised today` : `Sentence ${lesson.index + 1} of ${lesson.texts.length} · Enter to check, then Next` : '5 minutes · a few reviews, something new'}</p></div>
      {lesson ? <button type="button" className="coach-primary" onClick={onExit}>{lesson.completed ? 'Finish lesson' : 'End lesson'}</button> : <button type="button" className="coach-primary" disabled={!ready || busy} onClick={onStart}>Start lesson <span aria-hidden="true">↗</span></button>}
    </div>
    {lesson && <progress className="coach-lesson-progress" aria-label="Lesson progress" max={lesson.texts.length} value={lesson.completed ? lesson.texts.length : lesson.index} />}
    <div className="coach-shortcuts">
      <button type="button" aria-expanded={panel === 'review'} aria-controls="coach-review-panel" onClick={() => togglePanel('review')}><span className="coach-dot" /><span>Review <b>{due ? `${due} due` : 'All caught up'}</b></span><span className="coach-chevron" aria-hidden="true">⌄</span></button>
      <button type="button" aria-expanded={panel === 'progress'} aria-controls="coach-progress-panel" onClick={() => togglePanel('progress')}><span className="coach-dot coach-dot-purple" /><span>This week <b>{report.accuracy === null ? 'Your first step' : `${report.accuracy}% accuracy`}</b></span><span className="coach-chevron" aria-hidden="true">⌄</span></button>
      <button type="button" aria-expanded={panel === 'goal'} aria-controls="coach-goal-panel" onClick={() => togglePanel('goal')}><span className="coach-dot coach-dot-gold" /><span>Learning goal <b>{path.name}</b></span><span className="coach-chevron" aria-hidden="true">⌄</span></button>
    </div>
    <div id="coach-review-panel" className="coach-panel" hidden={panel !== 'review'}><div className="coach-panel-title"><h3>{due ? `${due} sentences ready to revisit` : 'You’re all caught up'}</h3><span>{difficulty}</span></div><p>{due ? 'A little repetition makes yesterday’s mistakes easier today.' : 'Missed sentences will appear here when it’s time to practise again.'}</p><small>Review schedule: 1 day after a mistake, then 3, 7 and 14 days after correct reviews.</small><button type="button" className="coach-secondary" disabled={!ready || busy || !due || Boolean(lesson && !lesson.completed)} onClick={onReview}>Start review</button></div>
    <div id="coach-progress-panel" className="coach-panel" hidden={panel !== 'progress'}><div className="coach-panel-title"><h3>Your week in practice</h3><span>{difficulty}</span></div><div className="coach-metrics"><div><strong>{report.accuracy === null ? '—' : `${report.accuracy}%`}</strong><small>Accuracy</small></div><div><strong>{report.count}</strong><small>Attempts</small></div><div><strong>{report.mastered}</strong><small>Sentences mastered</small></div></div><p>{report.change === null ? report.count ? 'Your weekly comparison will appear once you have practice in both weeks.' : 'Finish a sentence to start your progress story.' : `${report.change > 0 ? '+' : ''}${report.change} percentage points · ${report.errorChange! >= 0 ? `${report.errorChange} fewer` : `${Math.abs(report.errorChange!)} more`} word errors per attempt`}</p><small>Last 7 days versus the previous 7 · same goal and difficulty.</small></div>
    <div id="coach-goal-panel" className="coach-panel" hidden={panel !== 'goal'}><div className="coach-panel-title"><h3>Find your direction</h3><span>{difficulty}</span></div><div className="coach-paths">{LEARNING_PATHS.map(item => <button type="button" key={item.focus} aria-pressed={focus === item.focus} disabled={busy || Boolean(lesson && !lesson.completed)} onClick={() => onPath(item.focus)}><span className="coach-path-heading"><strong>{item.name}</strong>{!premium && ['business', 'ielts'].includes(item.focus) && <span className="coach-premium">Premium</span>}{item.focus === focus && <span aria-hidden="true">✓</span>}</span><small>{item.description}</small></button>)}</div><div className="coach-milestone"><span>{completed >= 30 ? 'All stages complete' : `Stage ${milestones.indexOf(milestone) + 1}`} · {Math.min(completed, milestone)}/{milestone} mastered</span><progress aria-label="Learning goal progress" max={milestone} value={Math.min(completed, milestone)} /></div><small>Milestones: 5, 15 and 30 different sentences without errors.</small></div>
  </section>;
}
