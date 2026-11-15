import { useState } from 'react';
import { activatePremiumLicense } from '../../services/premiumAccess';
import type { PracticeSession } from '../../services/premiumService';
import type { Achievement, DailyTarget } from '../../services/pointsService';
import './PremiumDashboard.css';
import { useAppLanguage } from '../../context/useAppLanguage';

const achievementTranslations: Record<string, [string, string]> = {
  starter: ['Người bắt đầu', 'Đạt 1.000 điểm'],
  committed: ['Kiên trì', 'Đạt 5.000 điểm'],
  'focused-learner': ['Người học tập trung', 'Đạt 10.000 điểm'],
  'master-practice': ['Bậc thầy luyện tập', 'Đạt 50.000 điểm'],
};

interface PremiumDashboardProps {
  isPremium: boolean;
  goalWpm: number;
  bestWpm: number;
  averageAccuracy: number;
  practiceStreak: number;
  practiceHistory: PracticeSession[];
  totalPoints: number;
  dailyTarget: DailyTarget;
  achievements: Array<Achievement & { unlocked: boolean }>;
  onGoalChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onLicenseActivated: () => void;
  onStartFocus: (durationMinutes: number) => void;
  onBack: () => void;
}

const LicenseActivation = ({ onActivated }: { onActivated: () => void }) => {
  const isVietnamese = useAppLanguage().language === 'vi';
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await activatePremiumLicense(licenseKey);
      onActivated();
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : isVietnamese ? 'Không thể kích hoạt mã này.' : 'Unable to activate this key');
    } finally {
      setIsLoading(false);
    }
  };
  return <form className="license-form" onSubmit={handleSubmit}><label>{isVietnamese ? 'Mã code  Premium' : 'Premium license key'}<input value={licenseKey} onChange={event => setLicenseKey(event.target.value)} placeholder="ZEN-XXXX-XXXX" autoComplete="off" required /></label>{error && <p className="license-error" role="alert">{error}</p>}<button type="submit" className="dashboard-cta" disabled={isLoading}>{isLoading ? (isVietnamese ? 'Đang kiểm tra mã…' : 'Checking key…') : (isVietnamese ? 'Mở khóa Premium' : 'Unlock Premium')}</button></form>;
};

const FocusLauncher = ({ isPremium, onStartFocus }: { isPremium: boolean; onStartFocus: (durationMinutes: number) => void }) => {
  const isVietnamese = useAppLanguage().language === 'vi';
  const [duration, setDuration] = useState(20);
  return <section className="dashboard-card focus-launcher">
    <div><span className="premium-kicker">{isVietnamese ? 'Chế độ tập trung' : 'Focus mode'}</span><h2>{isVietnamese ? 'Tạo không gian để nghe tốt hơn.' : 'Make space for better listening.'}</h2><p>{isVietnamese ? 'Ẩn yếu tố gây xao nhãng và luyện tập trong một phiên có giới hạn thời gian.' : 'Hide distractions and practice in one calm, timed session.'}</p></div>
    <div className="focus-launcher-actions"><select value={duration} onChange={event => setDuration(Number(event.target.value))} aria-label={isVietnamese ? 'Thời lượng phiên tập trung' : 'Focus session duration'}><option value="10">10 {isVietnamese ? 'phút' : 'minutes'}</option><option value="20">20 {isVietnamese ? 'phút' : 'minutes'}</option><option value="30">30 {isVietnamese ? 'phút' : 'minutes'}</option></select><button type="button" className="dashboard-cta" onClick={() => onStartFocus(duration)}>{isPremium ? (isVietnamese ? 'Bắt đầu phiên tập trung' : 'Start focus session') : (isVietnamese ? 'Mở khóa chế độ tập trung' : 'Unlock focus mode')}</button></div>
  </section>;
};

const RewardsPanel = ({ totalPoints, dailyTarget }: { totalPoints: number; dailyTarget: DailyTarget }) => {
  const isVietnamese = useAppLanguage().language === 'vi';
  const progressPercent = Math.min((dailyTarget.progress / Math.max(dailyTarget.target, 1)) * 100, 100);
  return (
    <section className="dashboard-card rewards-card" aria-label={isVietnamese ? 'Tổng quan phần thưởng' : 'Rewards summary'}>
      <div className="section-title" > <span className="premium-kicker">{isVietnamese ? 'Phần thưởng' : 'Rewards'}</span> <span>{dailyTarget.completed ? (isVietnamese ? 'Đã đạt mục tiêu' : 'Target complete') : (isVietnamese ? 'Thử thách hằng ngày' : 'Daily challenge')}</span></div>
      <div className="rewards-grid">
        <div>
          <span>{isVietnamese ? 'Tổng điểm' : 'Total points'}</span>
          <strong>{totalPoints}</strong>
          <em>{isVietnamese ? 'Số dư điểm' : 'Wallet balance'}</em>
        </div>
        <div>
          <span>{isVietnamese ? 'Mục tiêu hằng ngày' : 'Daily target'}</span>
          <strong>{Math.min(dailyTarget.progress, dailyTarget.target)}/{dailyTarget.target}</strong>
          <em>{dailyTarget.completed ? `${isVietnamese ? 'Đã nhận thưởng' : 'Reward claimed'} +${dailyTarget.rewardPoints}` : `${isVietnamese ? 'Phần thưởng' : 'Reward'} +${dailyTarget.rewardPoints}`}</em>
        </div>
      </div>
      <div className="goal-progress" role="progressbar" aria-label={isVietnamese ? 'Tiến độ phần thưởng hằng ngày' : 'Daily reward progress'} aria-valuemin={0} aria-valuemax={dailyTarget.target} aria-valuenow={Math.min(dailyTarget.progress, dailyTarget.target)}>
        <span style={{ width: `${progressPercent}%` }} />
      </div>
      <small className="goal-progress-label">{dailyTarget.completed ? (isVietnamese ? 'Đã hoàn thành mục tiêu hôm nay. Quay lại vào ngày mai để nhận phần thưởng mới.' : 'Daily target finished. Come back tomorrow for a fresh reward.') : (isVietnamese ? `Còn ${dailyTarget.target - dailyTarget.progress} để mở khóa phần thưởng hôm nay.` : `${dailyTarget.target - dailyTarget.progress} left to unlock today’s reward.`)}</small>
    </section>
  );
};

const AchievementPanel = ({ achievements }: { achievements: Array<Achievement & { unlocked: boolean }> }) => {
  const isVietnamese = useAppLanguage().language === 'vi';
  return <section className="dashboard-card achievements-card" aria-label={isVietnamese ? 'Danh sách thành tựu' : 'Achievement list'}>
    <div className="section-title"><h2>{isVietnamese ? 'Thành tựu' : 'Achievements'}</h2><span>{isVietnamese ? `${achievements.filter(achievement => achievement.unlocked).length}/${achievements.length} đã mở khóa` : `${achievements.filter(achievement => achievement.unlocked).length}/${achievements.length} unlocked`}</span></div>
    <div className="achievements-grid">
      {achievements.map(achievement => (
        <div key={achievement.id} className={`achievement-item ${achievement.unlocked ? 'unlocked' : 'locked'}`}>
          <span className="achievement-badge" aria-hidden="true">{achievement.icon}</span>
          <div>
            <strong>{isVietnamese ? achievementTranslations[achievement.id]?.[0] || achievement.title : achievement.title}</strong>
            <small>{isVietnamese ? achievementTranslations[achievement.id]?.[1] || achievement.description : achievement.description}</small>
          </div>
        </div>
      ))}
    </div>
  </section>;
};

const ProgressAnalytics = ({ practiceHistory }: { practiceHistory: PracticeSession[] }) => {
  const isVietnamese = useAppLanguage().language === 'vi';
  const sessions = [...practiceHistory].slice(0, 12).reverse();
  if (sessions.length < 2) {
    return <section className="dashboard-card analytics-card"><div className="section-title"><h2>{isVietnamese ? 'Phân tích tiến độ' : 'Progress analytics'}</h2><span>{isVietnamese ? 'Thông tin Premium' : 'Premium insight'}</span></div><p className="dashboard-empty">{isVietnamese ? 'Hoàn thành ít nhất hai phiên để xem xu hướng WPM và độ chính xác.' : 'Complete at least two sessions to see your WPM and accuracy trends.'}</p></section>;
  }

  const wpmValues = sessions.filter(session => session.wpm > 0).map(session => session.wpm);
  const accuracyValues = sessions.map(session => session.accuracy);
  const maxWpm = Math.max(...wpmValues, 1);
  const chartPoints = (values: number[], maxValue: number) => values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${100 - (value / maxValue) * 82 - 9}`).join(' ');
  const midpoint = Math.max(Math.floor(sessions.length / 2), 1);
  const wpmMidpoint = Math.max(Math.floor(wpmValues.length / 2), 1);
  const average = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
  const wpmTrend = wpmValues.length >= 2 ? Math.round(average(wpmValues.slice(wpmMidpoint)) - average(wpmValues.slice(0, wpmMidpoint))) : null;
  const accuracyTrend = Math.round(average(accuracyValues.slice(midpoint)) - average(accuracyValues.slice(0, midpoint)));
  const trendLabel = (value: number, unit: string) => `${value > 0 ? '+' : ''}${value}${unit} ${isVietnamese ? 'so với các phiên trước' : 'vs earlier sessions'}`;

  return <section className="dashboard-card analytics-card" aria-label={isVietnamese ? 'Phân tích tiến độ' : 'Progress analytics'}>
    <div className="section-title"><h2>{isVietnamese ? 'Phân tích tiến độ' : 'Progress analytics'}</h2><span>{isVietnamese ? `${sessions.length} phiên gần nhất` : `Last ${sessions.length} sessions`}</span></div>
    <div className="analytics-grid">
      <div className="analytics-chart-block">
        <div className="analytics-chart-heading"><span>{isVietnamese ? 'Tốc độ gõ' : 'Typing speed'}</span><strong>{wpmTrend === null ? '—' : trendLabel(wpmTrend, ' WPM')}</strong></div>
        <svg className="analytics-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={isVietnamese ? 'Biểu đồ xu hướng tốc độ gõ' : 'Typing speed trend chart'}>
          <polyline points={chartPoints(wpmValues, maxWpm)} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="analytics-chart-labels"><span>{isVietnamese ? 'Cũ hơn' : 'Older'}</span><span>{isVietnamese ? 'Gần đây' : 'Recent'}</span></div>
      </div>
      <div className="analytics-chart-block accuracy-chart-block">
        <div className="analytics-chart-heading"><span>{isVietnamese ? 'Độ chính xác' : 'Accuracy'}</span><strong>{trendLabel(accuracyTrend, '%')}</strong></div>
        <svg className="analytics-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={isVietnamese ? 'Biểu đồ xu hướng độ chính xác' : 'Accuracy trend chart'}>
          <polyline points={chartPoints(accuracyValues, 100)} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="analytics-chart-labels"><span>{isVietnamese ? 'Cũ hơn' : 'Older'}</span><span>{isVietnamese ? 'Gần đây' : 'Recent'}</span></div>
      </div>
    </div>
  </section>;
};

const WeeklyLearningReport = ({ practiceHistory }: { practiceHistory: PracticeSession[] }) => {
  const isVietnamese = useAppLanguage().language === 'vi';
  const [reportNow] = useState(() => Date.now());
  const weekStart = reportNow - 7 * 24 * 60 * 60 * 1000;
  const weeklySessions = practiceHistory.filter(session => new Date(session.date).getTime() >= weekStart);
  const speedSessions = weeklySessions.filter(session => session.wpm > 0);
  const activeDays = new Set(weeklySessions.map(session => new Date(session.date).toLocaleDateString())).size;
  const averageAccuracy = weeklySessions.length ? Math.round(weeklySessions.reduce((total, session) => total + session.accuracy, 0) / weeklySessions.length) : 0;
  const bestWpm = speedSessions.length ? Math.max(...speedSessions.map(session => session.wpm)) : 0;
  const weakestSession = weeklySessions.length ? [...weeklySessions].sort((a, b) => a.accuracy - b.accuracy)[0] : undefined;
  const recommendation = !weeklySessions.length
    ? (isVietnamese ? 'Hoàn thành một phiên trong tuần này để xem báo cáo đầu tiên.' : 'Complete a session this week to unlock your first report.')
    : averageAccuracy < 85
      ? (isVietnamese ? 'Ưu tiên độ chính xác. Nghe lại mỗi câu một lần trước khi gõ.' : 'Focus on accuracy first. Replay each sentence once before typing.')
      : bestWpm > 0 && bestWpm < 35
        ? (isVietnamese ? 'Độ chính xác của bạn khá tốt. Thử tăng nhẹ tốc độ đọc để luyện phản xạ.' : 'Your accuracy is solid. Try a slightly faster speech speed to build fluency.')
        : (isVietnamese ? 'Bạn đang duy trì nhịp luyện tập tốt. Hãy thử chế độ luyện thích ứng để tăng thử thách.' : 'You are building a strong rhythm. Try Adaptive Practice for a new challenge.');

  return <section className="dashboard-card weekly-report" aria-label={isVietnamese ? 'Báo cáo học tập tuần' : 'Weekly learning report'}>
    <div className="section-title"><h2>{isVietnamese ? 'Báo cáo học tập tuần' : 'Weekly learning report'}</h2><span>{isVietnamese ? '7 ngày gần nhất' : 'Last 7 days'}</span></div>
    <div className="weekly-report-metrics">
      <div><strong>{weeklySessions.length}</strong><span>{isVietnamese ? 'Phiên' : 'Sessions'}</span></div>
      <div><strong>{activeDays}</strong><span>{isVietnamese ? 'Ngày hoạt động' : 'Active days'}</span></div>
      <div><strong>{averageAccuracy || '—'}<small>%</small></strong><span>{isVietnamese ? 'Độ chính xác TB' : 'Average accuracy'}</span></div>
      <div><strong>{bestWpm || '—'}<small> WPM</small></strong><span>{isVietnamese ? 'Tốc độ tốt nhất' : 'Best speed'}</span></div>
    </div>
    <div className="weekly-recommendation"><span>{isVietnamese ? 'Trọng tâm tiếp theo' : 'Next focus'}</span><p>{recommendation}</p>{weakestSession && <small>{isVietnamese ? `Độ chính xác thấp nhất tuần này: ${weakestSession.accuracy}% ở trình độ ${{ easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' }[weakestSession.difficulty]}.` : `Lowest accuracy this week: ${weakestSession.accuracy}% on ${weakestSession.difficulty} practice.`}</small>}</div>
  </section>;
};

const PremiumDashboard = ({ isPremium, goalWpm, bestWpm, averageAccuracy, practiceStreak, practiceHistory, totalPoints, dailyTarget, achievements, onGoalChange, onLicenseActivated, onStartFocus, onBack }: PremiumDashboardProps) => {
  const isVietnamese = useAppLanguage().language === 'vi';
  return <div className="premium-page">
    <header className="premium-page-header">
      <button type="button" className="back-button" onClick={onBack} aria-label={isVietnamese ? 'Quay lại luyện tập' : 'Back to practice'} title={isVietnamese ? 'Quay lại luyện tập' : 'Back to practice'}>←</button>
      <a className="logo premium-page-mark logo-link" href="#" onClick={event => { event.preventDefault(); onBack(); }}>Zen Dictation</a>
    </header>
    {isPremium ? (
      <main className="premium-dashboard">
        <div className="dashboard-intro"><span className="premium-kicker">{isVietnamese ? 'Bảng điều khiển Premium' : 'Premium dashboard'}</span><h1>{isVietnamese ? 'Tập trung theo dõi tiến độ.' : 'Your progress, in focus.'}</h1><p>{isVietnamese ? 'Mỗi phiên luyện tập là một bước tiến nhỏ. Hãy tiếp tục và theo dõi sự tiến bộ của bạn.' : 'Every session is a small step forward. Keep going and let the numbers show your growth.'}</p></div>
        <div className="dashboard-status"><span>✦ {isVietnamese ? 'Thành viên Premium' : 'Premium member'}</span><small>{isVietnamese ? 'Tiến độ được lưu trên thiết bị này' : 'Progress saved on this device'}</small></div>
<FocusLauncher isPremium={isPremium} onStartFocus={onStartFocus} />       
        <section className="dashboard-metrics" aria-label={isVietnamese ? 'Tiến độ của bạn' : 'Your progress'}>
          <div><span>{isVietnamese ? 'Tốc độ tốt nhất' : 'Best speed'}</span><strong>{bestWpm || '—'} <small>WPM</small></strong><em>{isVietnamese ? 'Kỷ lục cá nhân' : 'Personal record'}</em></div>
          <div><span>{isVietnamese ? 'Độ chính xác trung bình' : 'Average accuracy'}</span><strong>{averageAccuracy || '—'}<small>%</small></strong><em>{isVietnamese ? 'Qua các phiên đã hoàn thành' : 'Across completed sessions'}</em></div>
          <div><span>{isVietnamese ? 'Phiên đã hoàn thành' : 'Completed sessions'}</span><strong>{practiceHistory.length}</strong><em>{isVietnamese ? 'Đã lưu trên thiết bị này' : 'Saved on this device'}</em></div>
          <div><span>{isVietnamese ? 'Chuỗi ngày hiện tại' : 'Current streak'}</span><strong>{practiceStreak}<small> {isVietnamese ? 'ngày' : 'days'}</small></strong><em>{isVietnamese ? 'Duy trì thói quen nhé' : 'Keep the habit going'}</em></div>
        </section>
        <ProgressAnalytics practiceHistory={practiceHistory} />
        <WeeklyLearningReport practiceHistory={practiceHistory} />
        <RewardsPanel totalPoints={totalPoints} dailyTarget={dailyTarget} />
        <AchievementPanel achievements={achievements} />
        <section className="dashboard-card goal-card"><div><span className="premium-kicker">{isVietnamese ? 'Cột mốc tiếp theo' : 'Your next milestone'}</span><h2>{isVietnamese ? 'Tăng tốc độ từng bước' : 'Build your speed steadily'}</h2><p>{isVietnamese ? 'Chọn một mục tiêu đủ thử thách nhưng vẫn khả thi.' : 'Choose a target that feels challenging but achievable.'}</p><div className="goal-progress" role="progressbar" aria-label={isVietnamese ? 'Tiến độ đạt mục tiêu WPM' : 'Progress toward WPM goal'} aria-valuemin={0} aria-valuemax={goalWpm} aria-valuenow={Math.min(bestWpm, goalWpm)}><span style={{ width: String(Math.min((bestWpm / Math.max(goalWpm, 1)) * 100, 100)) + '%' }} /></div><small className="goal-progress-label">{bestWpm ? (isVietnamese ? `${bestWpm}/${goalWpm} WPM` : `${bestWpm} of ${goalWpm} WPM`) : (isVietnamese ? `Lập kỷ lục đầu tiên · Mục tiêu ${goalWpm} WPM` : `Set your first record · Goal ${goalWpm} WPM`)}</small></div><label>{isVietnamese ? 'Mục tiêu WPM' : 'Target WPM'} <input type="number" min="10" max="200" value={goalWpm} onChange={onGoalChange} /></label></section>
        
        <RecentSessions practiceHistory={practiceHistory} />
      </main>
    ) : (
      <main className="premium-dashboard premium-landing">
        <div className="dashboard-intro"><span className="premium-kicker">Zen Dictation Premium</span><h1>{isVietnamese ? 'Luyện tập và theo dõi tiến bộ rõ ràng hơn.' : 'Practice with a clearer sense of progress.'}</h1><p>{isVietnamese ? 'Mở khóa bảng điều khiển cá nhân giúp biến những phiên luyện tập ngắn thành tiến bộ lâu dài.' : 'Unlock a personal dashboard designed to help you turn short sessions into lasting improvement.'}</p></div>
        <section className="benefits-grid">
          <div><span>↗</span><h2>{isVietnamese ? 'Theo dõi tiến độ thực tế' : 'See your real progress'}</h2><p>{isVietnamese ? 'Theo dõi tốc độ tốt nhất và độ chính xác trung bình theo thời gian.' : 'Track your best speed and average accuracy over time.'}</p></div>
          <div><span>▤</span><h2>{isVietnamese ? 'Lưu mọi kết quả' : 'Keep every result'}</h2><p>{isVietnamese ? 'Xem lại 30 phiên luyện tập gần nhất ở cùng một nơi.' : 'Review your latest 30 practice sessions in one place.'}</p></div>
          <div><span>◎</span><h2>{isVietnamese ? 'Đặt mục tiêu cá nhân' : 'Set personal goals'}</h2><p>{isVietnamese ? 'Chọn mục tiêu WPM giúp bạn duy trì luyện tập hằng ngày.' : 'Choose a WPM target that keeps your daily practice moving.'}</p></div>
          <div><span>✦</span><h2>{isVietnamese ? 'Mở khóa trình độ Khó' : 'Unlock Hard level'}</h2><p>{isVietnamese ? 'Thử thách bản thân với câu dài và phức tạp hơn.' : 'Challenge yourself with longer and more complex sentences.'}</p></div>
        </section>
        <FocusLauncher isPremium={isPremium} onStartFocus={onStartFocus} />
        <LicenseActivation onActivated={onLicenseActivated} />
        <small className="dashboard-note">{isVietnamese ? '' : 'One-time unlock · No account required'}</small>
      </main>
    )}
  </div>;
};

const RecentSessions = ({ practiceHistory }: { practiceHistory: PracticeSession[] }) => {
  const isVietnamese = useAppLanguage().language === 'vi';
  const [visibleCount, setVisibleCount] = useState(10);
  const visibleSessions = practiceHistory.slice(0, visibleCount);

  return <section className="dashboard-card"><div className="section-title"><h2>{isVietnamese ? 'Phiên gần đây' : 'Recent sessions'}</h2><span>{isVietnamese ? '30 kết quả gần nhất' : 'Last 30 results'}</span></div>{practiceHistory.length === 0 ? <p className="dashboard-empty">{isVietnamese ? 'Hoàn thành một câu để xem tiến độ tại đây.' : 'Complete a practice sentence to see your progress here.'}</p> : <><div className="dashboard-history">{visibleSessions.map(session => <div className="dashboard-history-row" key={session.id}><span>{new Date(session.date).toLocaleDateString(isVietnamese ? 'vi-VN' : 'en-US')} · {isVietnamese ? ({ easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' } as const)[session.difficulty] : session.difficulty}</span><strong>{session.wpm > 0 ? `${session.wpm} WPM` : '— WPM'}</strong><span>{session.accuracy}% {isVietnamese ? 'độ chính xác' : 'accuracy'}</span></div>)}</div>{visibleCount < practiceHistory.length && <button type="button" className="load-more-sessions" onClick={() => setVisibleCount(count => count + 10)}>{isVietnamese ? 'Tải thêm phiên' : 'Load more sessions'}</button>}</>}</section>;
};

export default PremiumDashboard;
