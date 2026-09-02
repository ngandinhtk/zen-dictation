import { useState } from 'react';
import { activatePremiumLicense } from '../../services/premiumAccess';
import type { PracticeSession } from '../../services/premiumService';
import type { Achievement, DailyTarget } from '../../services/pointsService';
import './PremiumDashboard.css';

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
      setError(activationError instanceof Error ? activationError.message : 'Unable to activate this key');
    } finally {
      setIsLoading(false);
    }
  };
  return <form className="license-form" onSubmit={handleSubmit}><label>Premium license key<input value={licenseKey} onChange={event => setLicenseKey(event.target.value)} placeholder="ZEN-XXXX-XXXX" autoComplete="off" required /></label>{error && <p className="license-error" role="alert">{error}</p>}<button type="submit" className="dashboard-cta" disabled={isLoading}>{isLoading ? 'Checking key…' : 'Unlock Premium'}</button></form>;
};

const FocusLauncher = ({ isPremium, onStartFocus }: { isPremium: boolean; onStartFocus: (durationMinutes: number) => void }) => {
  const [duration, setDuration] = useState(20);
  return <section className="dashboard-card focus-launcher">
    <div><span className="premium-kicker">Focus mode</span><h2>Make space for better listening.</h2><p>Hide distractions and practice in one calm, timed session.</p></div>
    <div className="focus-launcher-actions"><select value={duration} onChange={event => setDuration(Number(event.target.value))} aria-label="Focus session duration"><option value="10">10 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option></select><button type="button" className="dashboard-cta" onClick={() => onStartFocus(duration)}>{isPremium ? 'Start focus session' : 'Unlock focus mode'}</button></div>
  </section>;
};

const RewardsPanel = ({ totalPoints, dailyTarget }: { totalPoints: number; dailyTarget: DailyTarget }) => {
  const progressPercent = Math.min((dailyTarget.progress / Math.max(dailyTarget.target, 1)) * 100, 100);
  return (
    <section className="dashboard-card rewards-card" aria-label="Rewards summary">
      <div className="section-title" > <span className="premium-kicker">Rewards</span> <span>{dailyTarget.completed ? 'Target complete' : 'Daily challenge'}</span></div>
      <div className="rewards-grid">
        <div>
          <span>Total points</span>
          <strong>{totalPoints}</strong>
          <em>Wallet balance</em>
        </div>
        <div>
          <span>Daily target</span>
          <strong>{Math.min(dailyTarget.progress, dailyTarget.target)}/{dailyTarget.target}</strong>
          <em>{dailyTarget.completed ? `Reward claimed +${dailyTarget.rewardPoints}` : `Reward +${dailyTarget.rewardPoints}`}</em>
        </div>
      </div>
      <div className="goal-progress" role="progressbar" aria-label="Daily reward progress" aria-valuemin={0} aria-valuemax={dailyTarget.target} aria-valuenow={Math.min(dailyTarget.progress, dailyTarget.target)}>
        <span style={{ width: `${progressPercent}%` }} />
      </div>
      <small className="goal-progress-label">{dailyTarget.completed ? 'Daily target finished. Come back tomorrow for a fresh reward.' : `${dailyTarget.target - dailyTarget.progress} left to unlock today’s reward.`}</small>
    </section>
  );
};

const AchievementPanel = ({ achievements }: { achievements: Array<Achievement & { unlocked: boolean }> }) => (
  <section className="dashboard-card achievements-card" aria-label="Achievement list">
    <div className="section-title"><h2>Achievements</h2><span>{achievements.filter(achievement => achievement.unlocked).length}/{achievements.length} unlocked</span></div>
    <div className="achievements-grid">
      {achievements.map(achievement => (
        <div key={achievement.id} className={`achievement-item ${achievement.unlocked ? 'unlocked' : 'locked'}`}>
          <span className="achievement-badge" aria-hidden="true">{achievement.icon}</span>
          <div>
            <strong>{achievement.title}</strong>
            <small>{achievement.description}</small>
          </div>
        </div>
      ))}
    </div>
  </section>
);

const PremiumDashboard = ({ isPremium, goalWpm, bestWpm, averageAccuracy, practiceStreak, practiceHistory, totalPoints, dailyTarget, achievements, onGoalChange, onLicenseActivated, onStartFocus, onBack }: PremiumDashboardProps) => (
  <div className="premium-page">
    <header className="premium-page-header">
      <button type="button" className="back-button" onClick={onBack} aria-label="Back to practice" title="Back to practice">←</button>
      <span className="logo premium-page-mark">Zen Dictation</span>
    </header>
    {isPremium ? (
      <main className="premium-dashboard">
        <div className="dashboard-intro"><span className="premium-kicker">Premium dashboard</span><h1>Your progress, in focus.</h1><p>Every session is a small step forward. Keep going and let the numbers show your growth.</p></div>
        <div className="dashboard-status"><span>✦ Premium member</span><small>Progress saved on this device</small></div>
<FocusLauncher isPremium={isPremium} onStartFocus={onStartFocus} />       
        <section className="dashboard-metrics" aria-label="Your progress">
          <div><span>Best speed</span><strong>{bestWpm || '—'} <small>WPM</small></strong><em>Personal record</em></div>
          <div><span>Average accuracy</span><strong>{averageAccuracy || '—'}<small>%</small></strong><em>Across completed sessions</em></div>
          <div><span>Completed sessions</span><strong>{practiceHistory.length}</strong><em>Saved on this device</em></div>
          <div><span>Current streak</span><strong>{practiceStreak}<small> days</small></strong><em>Keep the habit going</em></div>
        </section>
        <RewardsPanel totalPoints={totalPoints} dailyTarget={dailyTarget} />
        <AchievementPanel achievements={achievements} />
        <section className="dashboard-card goal-card"><div><span className="premium-kicker">Your next milestone</span><h2>Build your speed steadily</h2><p>Choose a target that feels challenging but achievable.</p><div className="goal-progress" role="progressbar" aria-label="Progress toward WPM goal" aria-valuemin={0} aria-valuemax={goalWpm} aria-valuenow={Math.min(bestWpm, goalWpm)}><span style={{ width: String(Math.min((bestWpm / Math.max(goalWpm, 1)) * 100, 100)) + '%' }} /></div><small className="goal-progress-label">{bestWpm ? String(bestWpm) + ' of ' + String(goalWpm) + ' WPM' : 'Set your first record · Goal ' + String(goalWpm) + ' WPM'}</small></div><label>Target WPM <input type="number" min="10" max="200" value={goalWpm} onChange={onGoalChange} /></label></section>
        
        <RecentSessions practiceHistory={practiceHistory} />
      </main>
    ) : (
      <main className="premium-dashboard premium-landing">
        <div className="dashboard-intro"><span className="premium-kicker">Zen Dictation Premium</span><h1>Practice with a clearer sense of progress.</h1><p>Unlock a personal dashboard designed to help you turn short sessions into lasting improvement.</p></div>
        <section className="benefits-grid">
          <div><span>↗</span><h2>See your real progress</h2><p>Track your best speed and average accuracy over time.</p></div>
          <div><span>▤</span><h2>Keep every result</h2><p>Review your latest 30 practice sessions in one place.</p></div>
          <div><span>◎</span><h2>Set personal goals</h2><p>Choose a WPM target that keeps your daily practice moving.</p></div>
          <div><span>✦</span><h2>Unlock Hard level</h2><p>Challenge yourself with longer and more complex sentences.</p></div>
        </section>
        <FocusLauncher isPremium={isPremium} onStartFocus={onStartFocus} />
        <LicenseActivation onActivated={onLicenseActivated} />
        <small className="dashboard-note">One-time unlock · No account required</small>
      </main>
    )}
  </div>
);

const RecentSessions = ({ practiceHistory }: { practiceHistory: PracticeSession[] }) => {
  const [visibleCount, setVisibleCount] = useState(10);
  const visibleSessions = practiceHistory.slice(0, visibleCount);

  return <section className="dashboard-card"><div className="section-title"><h2>Recent sessions</h2><span>Last 30 results</span></div>{practiceHistory.length === 0 ? <p className="dashboard-empty">Complete a practice sentence to see your progress here.</p> : <><div className="dashboard-history">{visibleSessions.map(session => <div className="dashboard-history-row" key={session.id}><span>{new Date(session.date).toLocaleDateString()} · {session.difficulty}</span><strong>{session.wpm} WPM</strong><span>{session.accuracy}% accuracy</span></div>)}</div>{visibleCount < practiceHistory.length && <button type="button" className="load-more-sessions" onClick={() => setVisibleCount(count => count + 10)}>Load more sessions</button>}</>}</section>;
};

export default PremiumDashboard;
