import { getWeeklyReport, LEARNING_PATHS, type LearningFocus, type LearningState } from '../../services/learningCoach';
import type { Difficulty } from '../../utils/sentenceTranslations';
import './LearningCoach.css';
import { useEffect, useState } from 'react';
import { applyTheme, getTheme } from '../../services/themeService';
import { useAppLanguage } from '../../context/useAppLanguage';

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
  const isVietnamese = useAppLanguage().language === 'vi';
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
  const pathText: Record<LearningFocus, { name: string; description: string }> = isVietnamese ? {
    mixed: { name: 'Luyện nghe hàng ngày', description: 'Tự tin hơn với các câu giao tiếp hàng ngày.' },
    vocabulary: { name: 'Mở rộng từ vựng', description: 'Luyện chính tả và nhận biết từ trong ngữ cảnh.' },
    idioms: { name: 'Thành ngữ tiếng Anh', description: 'Học các thành ngữ tiếng Anh thông dụng trong ngữ cảnh.' },
    business: { name: 'Tiếng Anh công việc', description: 'Luyện họp, báo cáo và giao tiếp chuyên nghiệp.' },
    ielts: { name: 'Luyện nghe IELTS', description: 'Luyện chủ đề học thuật và cấu trúc câu dài hơn.' },
  } : {
    mixed: { name: 'Everyday listening', description: 'Build confidence with everyday sentences.' },
    vocabulary: { name: 'Vocabulary builder', description: 'Practise spelling and recognise words in context.' },
    idioms: { name: 'English idioms', description: 'Learn common English idioms in context.' },
    business: { name: 'English at work', description: 'Practise meetings, reports and professional communication.' },
    ielts: { name: 'IELTS listening', description: 'Practise academic topics and longer sentence structures.' },
  };
  const difficultyLabel = isVietnamese ? ({ easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' } as const)[difficulty] : difficulty;
  const completed = new Set(state.attempts.filter(item => item.focus === focus && item.difficulty === difficulty && item.errors === 0).map(item => item.text)).size;
  const milestones = [5, 15, 30];
  const milestone = milestones.find(target => completed < target) || 30;
  const togglePanel = (next: 'review' | 'progress' | 'goal') => setPanel(current => current === next ? null : next);
  return <section className="learning-coach" aria-label={isVietnamese ? 'Lộ trình học tập' : 'Your learning plan'}>
    <div className="coach-main">
      <button type="button" className="coach-symbol" onClick={toggleTheme} aria-label={isVietnamese ? 'Giao diện tối' : 'Dark mode'} aria-pressed={theme === 'dark'} title={theme === 'dark' ? (isVietnamese ? 'Chuyển sang giao diện sáng' : 'Switch to light mode') : (isVietnamese ? 'Chuyển sang giao diện tối' : 'Switch to dark mode')}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{theme === 'dark' ? <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" /> : <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="4" /></>}</svg></button>
      <div className="coach-intro"><span className="coach-eyebrow">{isVietnamese ? 'MỖI NGÀY MỘT CHÚT' : 'A LITTLE EVERY DAY'}</span><h2>{lesson?.completed ? (isVietnamese ? 'Làm tốt lắm!' : 'Nicely done.') : lesson ? (isVietnamese ? 'Bài học hôm nay' : 'Your daily lesson') : (isVietnamese ? 'Dành thời gian để tiến bộ.' : 'Make time for progress.')}</h2><p role={lesson ? 'status' : undefined}>{lesson ? lesson.completed ? (isVietnamese ? `Hôm nay đã luyện ${lesson.texts.length} câu` : `${lesson.texts.length} sentences practised today`) : (isVietnamese ? `Câu ${lesson.index + 1}/${lesson.texts.length} · Tự kiểm tra khi hoàn thành · Nhấn Enter để tiếp tục` : `Sentence ${lesson.index + 1} of ${lesson.texts.length} · Auto-check when complete · Enter for next`) : (isVietnamese ? '5 phút · ôn vài câu, học điều mới' : '5 minutes · a few reviews, something new')}</p></div>
      {lesson ? <button type="button" className="coach-primary" onClick={onExit}>{lesson.completed ? (isVietnamese ? 'Kết thúc bài học' : 'Finish lesson') : (isVietnamese ? 'Dừng bài học' : 'End lesson')}</button> : <button type="button" className="coach-primary" disabled={!ready || busy} onClick={onStart}>{isVietnamese ? 'Bắt đầu bài học' : 'Start lesson'} <span aria-hidden="true">↗</span></button>}
    </div>
    {lesson && <progress className="coach-lesson-progress" aria-label={isVietnamese ? 'Tiến độ bài học' : 'Lesson progress'} max={lesson.texts.length} value={lesson.completed ? lesson.texts.length : lesson.index} />}
    <div className="coach-shortcuts">
      <button type="button" aria-expanded={panel === 'review'} aria-controls="coach-review-panel" onClick={() => togglePanel('review')}><span className="coach-dot" /><span>{isVietnamese ? 'Ôn tập' : 'Review'} <b>{due ? (isVietnamese ? `${due} đến hạn` : `${due} due`) : (isVietnamese ? 'Đã ôn hết' : 'All caught up')}</b></span><span className="coach-chevron" aria-hidden="true">⌄</span></button>
      <button type="button" aria-expanded={panel === 'progress'} aria-controls="coach-progress-panel" onClick={() => togglePanel('progress')}><span className="coach-dot coach-dot-purple" /><span>{isVietnamese ? 'Tuần này' : 'This week'} <b>{report.accuracy === null ? (isVietnamese ? 'Bước đầu tiên' : 'Your first step') : (isVietnamese ? `Độ chính xác ${report.accuracy}%` : `${report.accuracy}% accuracy`)}</b></span><span className="coach-chevron" aria-hidden="true">⌄</span></button>
      <button type="button" aria-expanded={panel === 'goal'} aria-controls="coach-goal-panel" onClick={() => togglePanel('goal')}><span className="coach-dot coach-dot-gold" /><span>{isVietnamese ? 'Mục tiêu học tập' : 'Learning goal'} <b>{pathText[focus].name}</b></span><span className="coach-chevron" aria-hidden="true">⌄</span></button>
    </div>
    <div id="coach-review-panel" className="coach-panel" hidden={panel !== 'review'}><div className="coach-panel-title"><h3>{due ? (isVietnamese ? `${due} câu đã đến hạn ôn` : `${due} sentences ready to revisit`) : (isVietnamese ? 'Bạn đã ôn hết' : 'You’re all caught up')}</h3><span>{difficultyLabel}</span></div><p>{due ? (isVietnamese ? 'Ôn tập một chút giúp bạn dễ nhớ những lỗi mắc phải hôm qua.' : 'A little repetition makes yesterday’s mistakes easier today.') : (isVietnamese ? 'Các câu bạn sai sẽ xuất hiện ở đây khi đến lúc cần ôn.' : 'Missed sentences will appear here when it’s time to practise again.')}</p><small>{isVietnamese ? 'Lịch ôn: 1 ngày sau khi sai, sau đó 3, 7 và 14 ngày kể từ các lần ôn đúng.' : 'Review schedule: 1 day after a mistake, then 3, 7 and 14 days after correct reviews.'}</small><button type="button" className="coach-secondary" disabled={!ready || busy || !due || Boolean(lesson && !lesson.completed)} onClick={onReview}>{isVietnamese ? 'Bắt đầu ôn' : 'Start review'}</button></div>
    <div id="coach-progress-panel" className="coach-panel" hidden={panel !== 'progress'}><div className="coach-panel-title"><h3>{isVietnamese ? 'Tổng kết luyện tập tuần này' : 'Your week in practice'}</h3><span>{difficultyLabel}</span></div><div className="coach-metrics"><div><strong>{report.accuracy === null ? '—' : `${report.accuracy}%`}</strong><small>{isVietnamese ? 'Độ chính xác' : 'Accuracy'}</small></div><div><strong>{report.count}</strong><small>{isVietnamese ? 'Lần thử' : 'Attempts'}</small></div><div><strong>{report.mastered}</strong><small>{isVietnamese ? 'Câu thành thạo' : 'Sentences mastered'}</small></div></div><p>{report.change === null ? report.count ? (isVietnamese ? 'So sánh theo tuần sẽ xuất hiện khi bạn đã luyện tập trong cả hai tuần.' : 'Your weekly comparison will appear once you have practice in both weeks.') : (isVietnamese ? 'Hoàn thành một câu để bắt đầu theo dõi tiến độ.' : 'Finish a sentence to start your progress story.') : (isVietnamese ? `${report.change > 0 ? '+' : ''}${report.change} điểm phần trăm · ${report.errorChange! >= 0 ? `ít hơn ${report.errorChange}` : `nhiều hơn ${Math.abs(report.errorChange!)}`} lỗi từ mỗi lần thử` : `${report.change > 0 ? '+' : ''}${report.change} percentage points · ${report.errorChange! >= 0 ? `${report.errorChange} fewer` : `${Math.abs(report.errorChange!)} more`} word errors per attempt`)}</p><small>{isVietnamese ? '7 ngày gần nhất so với 7 ngày trước · cùng mục tiêu và trình độ.' : 'Last 7 days versus the previous 7 · same goal and difficulty.'}</small></div>
    <div id="coach-goal-panel" className="coach-panel" hidden={panel !== 'goal'}><div className="coach-panel-title"><h3>{isVietnamese ? 'Chọn hướng học tập' : 'Find your direction'}</h3><span>{difficultyLabel}</span></div><div className="coach-paths">{LEARNING_PATHS.map(item => <button type="button" key={item.focus} aria-pressed={focus === item.focus} disabled={busy || Boolean(lesson && !lesson.completed)} onClick={() => onPath(item.focus)}><span className="coach-path-heading"><strong>{pathText[item.focus].name}</strong>{!premium && ['business', 'ielts'].includes(item.focus) && <span className="coach-premium">Premium</span>}{item.focus === focus && <span aria-hidden="true">✓</span>}</span><small>{pathText[item.focus].description}</small></button>)}</div><div className="coach-milestone"><span>{completed >= 30 ? (isVietnamese ? 'Đã hoàn thành tất cả giai đoạn' : 'All stages complete') : `${isVietnamese ? 'Giai đoạn' : 'Stage'} ${milestones.indexOf(milestone) + 1}`} · {Math.min(completed, milestone)}/{milestone} {isVietnamese ? 'câu thành thạo' : 'mastered'}</span><progress aria-label={isVietnamese ? 'Tiến độ mục tiêu học tập' : 'Learning goal progress'} max={milestone} value={Math.min(completed, milestone)} /></div><small>{isVietnamese ? 'Các mốc: 5, 15 và 30 câu khác nhau không mắc lỗi.' : 'Milestones: 5, 15 and 30 different sentences without errors.'}</small></div>
  </section>;
}
