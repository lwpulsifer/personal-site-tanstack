import dayjs from '#/lib/dayjs'

/**
 * Returns the YYYY-MM-DD of the Monday that is `offset` weeks from today (UTC).
 * Using UTC keeps server and client in agreement regardless of the user's timezone.
 */
export function getMondayOfWeek(offset = 0): string {
  const today = dayjs.utc()
  // day() → 0=Sun … 6=Sat; shift so Monday is the origin
  const daysToMonday = today.day() === 0 ? 6 : today.day() - 1
  return today.subtract(daysToMonday, 'day').add(offset, 'week').format('YYYY-MM-DD')
}

/** Returns the YYYY-MM-DD that is `days` after the given date string. */
export function addDays(dateStr: string, days: number): string {
  return dayjs.utc(dateStr).add(days, 'day').format('YYYY-MM-DD')
}
