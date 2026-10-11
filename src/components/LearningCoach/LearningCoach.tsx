import { getWeeklyReport, LEARNING_PATHS, type LearningFocus, type LearningState } from '../../services/learningCoach';
import type { Difficulty } from '../../utils/sentenceTranslations';
import './LearningCoach.css';
import { useEffect, useState } from 'react';

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
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  const reportNow = Math.max(now, Date.parse(state.attempts[0]?.date || '') || now);
  const report = getWeeklyReport(state.attempts, focus, difficulty, reportNow);
  const due = state.reviews.filter(item => item.focus === focus && item.difficulty === difficulty && Date.parse(item.nextReviewAt) <= reportNow).length;
  const path = LEARNING_PATHS.find(item => item.focus === focus)!;
  const completed = new Set(state.attempts.filter(item => item.focus === focus && item.difficulty === difficulty && item.errors === 0).map(item => item.text)).size;
  const milestones = [5, 15, 30];
  return <section className="learning-coach" aria-label="Your learning plan">
    <div className="coach-heading"><div><h2>Your next step</h2><p>A short lesson, then a clear picture of your progress.</p></div><span>{difficulty} · {path.name}</span></div>
    <div className="coach-grid">
      <div><h3>Daily practice · about 5 minutes</h3>
        {lesson ? <><p role="status">{lesson.completed ? `Lesson complete! You practised ${lesson.texts.length} sentences.` : `Sentence ${lesson.index + 1} of ${lesson.texts.length} · Submit your answer, then choose Next.`}</p><progress aria-label="Lesson progress" max={lesson.texts.length} value={lesson.completed ? lesson.texts.length : lesson.index} /><button type="button" onClick={onExit}>{lesson.completed ? 'Back to practice' : 'End lesson'}</button></> : <><p>Review up to 2 sentences due today, then practise new sentences at your selected level.</p><button type="button" disabled={!ready || busy} onClick={onStart}>Start daily lesson</button><button type="button" disabled={!ready || busy || !due} onClick={onReview}>Review sentences ({due} due)</button></>}
        <small>Missed sentences return after 1 day; correct reviews return after 3, 7 and 14 days.</small>
      </div>
      <div><h3>Last 7 days</h3><p>Compared with the previous 7 days at the same level and goal.</p>
        {report.count ? <><strong>{report.accuracy}% accuracy · {report.count} attempts</strong><p>{report.change === null ? 'Keep practising to build your first weekly comparison.' : `${report.change > 0 ? '+' : ''}${report.change} percentage points · ${report.errorChange! >= 0 ? `${report.errorChange} fewer` : `${Math.abs(report.errorChange!)} more`} word errors per attempt`}</p><small>{report.mastered} different sentences completed without word errors.</small></> : <p>Complete your first sentence to start tracking progress.</p>}
      </div>
    </div>
    <details><summary>Choose your learning goal · {completed} sentences mastered</summary><div className="coach-paths">{LEARNING_PATHS.map(item => <button type="button" key={item.focus} aria-pressed={focus === item.focus} disabled={busy || Boolean(lesson && !lesson.completed)} onClick={() => onPath(item.focus)}><strong>{item.name}{!premium && ['business', 'ielts'].includes(item.focus) ? ' · Premium' : ''}</strong><small>{item.description}</small></button>)}</div><p>{path.name}: {milestones.map((target, index) => `Stage ${index + 1}: ${Math.min(completed, target)}/${target}`).join(' · ')}</p><small>Finish 5, 15 and 30 different sentences without word errors at this level to complete each stage.</small></details>
  </section>;
}
