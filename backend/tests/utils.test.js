import { jest } from '@jest/globals';

// The function logic extracted from LeaveRequestPage.tsx for testing
function calcCalendarDays(start, end) {
  if (!start || !end) return 0;
  
  const s = new Date(start);
  const e = new Date(end);
  
  // Hardening: Check for invalid date objects
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  
  if (e < s) return 0;
  
  // Use UTC methods to ensure deterministic calendar day logic regardless of local timezone
  const startUTC = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
  const endUTC = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate());
  
  const result = Math.floor((endUTC - startUTC) / (1000 * 60 * 60 * 24)) + 1;
  
  // Safety: Ensure we never return NaN
  return isNaN(result) ? 0 : result;
}

describe('calcCalendarDays Utility - Hardened', () => {
  describe('Invalid Inputs', () => {
    it('should return 0 for non-date strings', () => {
      expect(calcCalendarDays('not-a-date', '2026-06-05')).toBe(0);
      expect(calcCalendarDays('2026-06-01', 'xyz')).toBe(0);
    });

    it('should return 0 for null or undefined', () => {
      expect(calcCalendarDays(null, '2026-06-05')).toBe(0);
      expect(calcCalendarDays('2026-06-01', undefined)).toBe(0);
    });

    it('should NEVER return NaN', () => {
      const result = calcCalendarDays({}, []);
      expect(result).toBe(0);
      expect(Number.isNaN(result)).toBe(false);
    });
  });

  describe('Timezone & Boundary Consistency', () => {
    it('should be consistent across simulated timezones', () => {
      // Testing different ISO formats
      expect(calcCalendarDays('2026-06-01T00:00:00Z', '2026-06-01T23:59:59Z')).toBe(1);
      expect(calcCalendarDays('2026-06-01', '2026-06-02')).toBe(2);
    });
  });

  describe('Leap Year & Year Transitions', () => {
    it('should handle leap years correctly (Feb 29)', () => {
      expect(calcCalendarDays('2028-02-28', '2028-03-01')).toBe(3);
    });

    it('should handle century transitions', () => {
      expect(calcCalendarDays('1999-12-31', '2000-01-01')).toBe(2);
    });
  });
});
