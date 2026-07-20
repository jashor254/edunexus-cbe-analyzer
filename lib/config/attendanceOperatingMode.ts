// lib/config/attendanceOperatingMode.ts
//
// PRP-2 (ADR-0019 §5/§6, Phase 5) — pure, presentation-only recency
// heuristic for the Attendance page's operating-mode badge. Takes dates
// Attendance already returned (no new query, no new schema); computes
// nothing about attendance itself, only how recently it was last used.

export type AttendanceOperatingMode = { label: string; tone: 'digital' | 'hybrid' | 'paper' }

export function operatingModeLabel(sessionDates: string[], now: Date = new Date()): AttendanceOperatingMode {
  if (sessionDates.length === 0) return { label: 'No sessions recorded yet', tone: 'paper' }

  const mostRecent = sessionDates.slice().sort().reverse()[0]
  const daysSince = Math.floor((now.getTime() - new Date(mostRecent).getTime()) / (1000 * 60 * 60 * 24))

  if (daysSince <= 0) return { label: 'Digital — marked live today', tone: 'digital' }
  if (daysSince <= 3) return { label: `Hybrid — last entry ${daysSince} day${daysSince === 1 ? '' : 's'} ago`, tone: 'hybrid' }
  return { label: `Catching up — last entry ${daysSince} days ago`, tone: 'paper' }
}
