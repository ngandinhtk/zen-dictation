const POINTS_KEY = 'zen-dictation-points';
const DAILY_TARGET_KEY = 'zen-dictation-daily-target';
export const PERFECT_SENTENCE_POINTS = 10;
export const DAILY_TARGET_REWARD_POINTS = 50;
export const TIMEOUT_PENALTY_POINTS = 5;

export type DailyTargetDifficulty = 'easy' | 'medium' | 'hard';

export type Achievement = {
  id: string;
  title: string;
  points: number;
  description: string;
  icon: string;
};

export type DailyTarget = {
  date: string;
  target: number;
  progress: number;
  rewardPoints: number;
  completed: boolean;
  rewardClaimed: boolean;
};

export const POINT_ACHIEVEMENTS: Achievement[] = [
  { id: 'starter', title: 'Starter', points: 1000, description: 'Reach 1,000 points', icon: '○' },
  { id: 'committed', title: 'Committed', points: 5000, description: 'Reach 5,000 points', icon: '◆' },
  { id: 'focused-learner', title: 'Focused learner', points: 10000, description: 'Reach 10,000 points', icon: '✦' },
  { id: 'master-practice', title: 'Master practice', points: 50000, description: 'Reach 50,000 points', icon: '♛' },
];

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const buildDailyTarget = (): DailyTarget => ({
  date: getTodayKey(),
  target: 5,
  progress: 0,
  rewardPoints: DAILY_TARGET_REWARD_POINTS,
  completed: false,
  rewardClaimed: false,
});

export const getPoints = () => {
  const points = Number(localStorage.getItem(POINTS_KEY));
  return Number.isFinite(points) && points >= 0 ? points : 0;
};

export const addPoints = (points: number) => {
  const nextPoints = getPoints() + Math.max(0, Math.round(points));
  localStorage.setItem(POINTS_KEY, String(nextPoints));
  return nextPoints;
};

export const subtractPoints = (points: number) => {
  const nextPoints = Math.max(0, getPoints() - Math.max(0, Math.round(points)));
  localStorage.setItem(POINTS_KEY, String(nextPoints));
  return nextPoints;
};

export const getDailyTarget = (): DailyTarget => {
  const rawTarget = localStorage.getItem(DAILY_TARGET_KEY);
  if (!rawTarget) {
    const initialTarget = buildDailyTarget();
    localStorage.setItem(DAILY_TARGET_KEY, JSON.stringify(initialTarget));
    return initialTarget;
  }

  try {
    const parsedTarget = JSON.parse(rawTarget) as Partial<DailyTarget>;
    const todayKey = getTodayKey();
    const nextTarget = {
      ...buildDailyTarget(),
      ...parsedTarget,
      date: parsedTarget.date || todayKey,
    };

    if (nextTarget.date !== todayKey) {
      const resetTarget = buildDailyTarget();
      localStorage.setItem(DAILY_TARGET_KEY, JSON.stringify(resetTarget));
      return resetTarget;
    }

    return nextTarget;
  } catch {
    const initialTarget = buildDailyTarget();
    localStorage.setItem(DAILY_TARGET_KEY, JSON.stringify(initialTarget));
    return initialTarget;
  }
};

export const updateDailyTargetProgress = (difficulty: DailyTargetDifficulty) => {
  const activeTarget = getDailyTarget();
  if (activeTarget.completed && activeTarget.rewardClaimed) {
    return activeTarget;
  }

  const difficultyWeight = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
  const nextProgress = Math.min(activeTarget.target, activeTarget.progress + difficultyWeight);
  const nextTarget: DailyTarget = {
    ...activeTarget,
    progress: nextProgress,
    completed: nextProgress >= activeTarget.target,
    rewardClaimed: activeTarget.rewardClaimed,
  };

  localStorage.setItem(DAILY_TARGET_KEY, JSON.stringify(nextTarget));
  return nextTarget;
};

export const claimDailyTargetReward = () => {
  const activeTarget = getDailyTarget();
  if (!activeTarget.completed || activeTarget.rewardClaimed) {
    return {
      points: getPoints(),
      target: activeTarget,
    };
  }

  const nextPoints = addPoints(activeTarget.rewardPoints);
  const nextTarget: DailyTarget = {
    ...activeTarget,
    rewardClaimed: true,
  };

  localStorage.setItem(DAILY_TARGET_KEY, JSON.stringify(nextTarget));
  return {
    points: nextPoints,
    target: nextTarget,
  };
};

export const getUnlockedAchievements = (points = getPoints()) => {
  const unlockedIds = new Set(POINT_ACHIEVEMENTS.filter(achievement => points >= achievement.points).map(achievement => achievement.id));
  return POINT_ACHIEVEMENTS.map(achievement => ({
    ...achievement,
    unlocked: unlockedIds.has(achievement.id),
  }));
};
