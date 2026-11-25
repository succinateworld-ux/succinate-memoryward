/**
 * Succinate MemoryWard — Room State
 *
 * Derives visual brightness from the trailing consecutive Remembered streak:
 *   streak 0        → 'dim'
 *   streak 1 or 2   → 'lit'
 *   streak ≥ 3      → 'bright'
 *
 * Any Again or Hard assessment resets the streak to 0.
 * Pure function; no side effects.
 */

/**
 * @param {Array<{value: string, timestamp: number}>} assessments
 *   Sorted non-decreasing by timestamp.
 * @returns {'dim' | 'lit' | 'bright'}
 */
export function computeRoomState(assessments) {
  if (!Array.isArray(assessments) || assessments.length === 0) return 'dim';

  let streak = 0;
  for (let i = assessments.length - 1; i >= 0; i--) {
    const v = assessments[i]?.value;
    if (v === 'Remembered') {
      streak++;
    } else {
      break;
    }
  }

  if (streak === 0) return 'dim';
  if (streak <= 2)  return 'lit';
  return 'bright';
}

/**
 * Returns the trailing consecutive Remembered count (the streak length).
 * Exposed for testing and display purposes.
 * @param {Array<{value: string}>} assessments
 * @returns {number}
 */
export function trailingStreak(assessments) {
  if (!Array.isArray(assessments)) return 0;
  let streak = 0;
  for (let i = assessments.length - 1; i >= 0; i--) {
    if (assessments[i]?.value === 'Remembered') streak++;
    else break;
  }
  return streak;
}
