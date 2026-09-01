const POINTS_KEY = 'zen-dictation-points';
export const  PERFECT_SENTENCE_POINTS = 10;

export const getPoints = () => {
  const points = Number(localStorage.getItem(POINTS_KEY));
  return Number.isFinite(points) && points >= 0 ? points : 0;
};

export const addPoints = (points: number) => {
  const nextPoints = getPoints() + Math.max(0, Math.round(points));
  localStorage.setItem(POINTS_KEY, String(nextPoints));
  return nextPoints;
};
