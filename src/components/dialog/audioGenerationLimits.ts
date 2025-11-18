/**
 * Daily audio generation limits
 * Uses localStorage to track daily generation count
 */

const STORAGE_KEY = "audio_generation_daily_count";
const STORAGE_DATE_KEY = "audio_generation_date";
const DAILY_LIMIT = 3;

/**
 * Get today's date string (YYYY-MM-DD) for comparison
 */
function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

/**
 * Check if we can generate audio (within daily limit)
 * @returns { canGenerate: boolean; remaining: number; count: number }
 */
export function checkAudioGenerationLimit(): {
  canGenerate: boolean;
  remaining: number;
  count: number;
} {
  if (typeof window === "undefined") {
    // Server-side: allow generation
    return { canGenerate: true, remaining: DAILY_LIMIT, count: 0 };
  }

  const today = getTodayDateString();
  const storedDate = localStorage.getItem(STORAGE_DATE_KEY);
  const storedCount = localStorage.getItem(STORAGE_KEY);

  // If it's a new day, reset the count
  if (storedDate !== today || !storedCount) {
    return { canGenerate: true, remaining: DAILY_LIMIT, count: 0 };
  }

  const count = parseInt(storedCount, 10) || 0;
  const remaining = Math.max(0, DAILY_LIMIT - count);
  const canGenerate = count < DAILY_LIMIT;

  return { canGenerate, remaining, count };
}

/**
 * Increment the daily generation count
 * @returns { success: boolean; remaining: number; count: number }
 */
export function incrementAudioGenerationCount(): {
  success: boolean;
  remaining: number;
  count: number;
} {
  if (typeof window === "undefined") {
    return { success: true, remaining: DAILY_LIMIT - 1, count: 1 };
  }

  const today = getTodayDateString();
  const storedDate = localStorage.getItem(STORAGE_DATE_KEY);
  const storedCount = localStorage.getItem(STORAGE_KEY);

  // If it's a new day, reset and start from 1
  if (storedDate !== today || !storedCount) {
    localStorage.setItem(STORAGE_DATE_KEY, today);
    localStorage.setItem(STORAGE_KEY, "1");
    return { success: true, remaining: DAILY_LIMIT - 1, count: 1 };
  }

  const count = (parseInt(storedCount, 10) || 0) + 1;
  localStorage.setItem(STORAGE_KEY, count.toString());
  const remaining = Math.max(0, DAILY_LIMIT - count);

  return { success: true, remaining, count };
}

/**
 * Get current limit status (for display purposes)
 * @returns { remaining: number; count: number; limit: number }
 */
export function getAudioGenerationStatus(): {
  remaining: number;
  count: number;
  limit: number;
} {
  const { count, remaining } = checkAudioGenerationLimit();
  return { remaining, count, limit: DAILY_LIMIT };
}
