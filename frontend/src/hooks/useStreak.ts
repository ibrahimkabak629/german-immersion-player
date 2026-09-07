import { useLocalStorage } from './useLocalStorage';
import type { StreakState } from '../types/learning';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isYesterday(dateKey: string): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return dateKey === yesterday.toISOString().slice(0, 10);
}

export function useStreak() {
  const [streak, setStreak] = useLocalStorage<StreakState>('gip-streak', { count: 0, lastCompletedDate: null });

  const completedToday = streak.lastCompletedDate === todayKey();

  function completeToday() {
    setStreak((prev) => {
      const today = todayKey();
      if (prev.lastCompletedDate === today) return prev;
      const count = prev.lastCompletedDate && isYesterday(prev.lastCompletedDate) ? prev.count + 1 : 1;
      return { count, lastCompletedDate: today };
    });
  }

  return { streak: streak.count, completedToday, completeToday };
}
