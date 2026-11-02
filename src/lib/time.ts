import type { TimetableSession } from './types'

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
export const fromMinutes = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
export const addMinutes = (time: string, minutes: number) => fromMinutes(toMinutes(time) + minutes)

/**
 * A parking window covers the student's class-attendance block, not just gaps
 * between classes. Sessions separated by <= maxGapMinutes are merged so a
 * student can leave their vehicle parked during intervening free periods.
 * Days without classes do not produce an automatic reservation window.
 */
export function eligibleWindows(sessions: TimetableSession[], day: string, maxGapMinutes = 180) {
  const daySessions = sessions
    .filter(s => s.day.toLowerCase() === day.toLowerCase())
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
  if (!daySessions.length) return []
  const windows: { start: string; end: string; label: string }[] = []
  let start = toMinutes(daySessions[0].start)
  let end = toMinutes(daySessions[0].end)
  for (const session of daySessions.slice(1)) {
    const nextStart = toMinutes(session.start)
    const nextEnd = toMinutes(session.end)
    if (nextStart - end <= maxGapMinutes) {
      end = Math.max(end, nextEnd)
    } else {
      windows.push({ start: fromMinutes(start), end: fromMinutes(end), label: 'Class-linked parking window' })
      start = nextStart
      end = nextEnd
    }
  }
  windows.push({ start: fromMinutes(start), end: fromMinutes(end), label: 'Class-linked parking window' })
  return windows
}

export function validateSessions(rows: TimetableSession[]) {
  const errors: string[] = []
  rows.forEach((s, i) => {
    if (!DAYS.some(d => d.toLowerCase() === s.day.toLowerCase())) errors.push(`Row ${i + 1}: unsupported day "${s.day}"`)
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end)) errors.push(`Row ${i + 1}: time must use HH:MM`)
    else if (toMinutes(s.end) <= toMinutes(s.start)) errors.push(`Row ${i + 1}: end must be after start`)
    if (!s.course.trim()) errors.push(`Row ${i + 1}: course is required`)
  })
  return errors
}
