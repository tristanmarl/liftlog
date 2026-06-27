const DAY = 86_400_000

const monthShort = new Intl.DateTimeFormat('en', { month: 'short' })
const monthLong = new Intl.DateTimeFormat('en', { month: 'long' })
const weekdayShort = new Intl.DateTimeFormat('en', { weekday: 'short' })
const weekdayLong = new Intl.DateTimeFormat('en', { weekday: 'long' })

export function parseISO(value: string): Date {
  return new Date(value)
}

export function format(dateLike: Date | string, pattern: string): string {
  const date = typeof dateLike === 'string' ? parseISO(dateLike) : dateLike
  const yyyy = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate())
  const dd = day.padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const mmm = monthShort.format(date)
  const mmmm = monthLong.format(date)
  const eee = weekdayShort.format(date)
  const eeee = weekdayLong.format(date)

  switch (pattern) {
    case 'd': return day
    case 'HH:mm': return `${hours}:${minutes}`
    case 'yyyy-MM-dd': return `${yyyy}-${month}-${dd}`
    case "yyyy-MM-dd'T'HH:mm": return `${yyyy}-${month}-${dd}T${hours}:${minutes}`
    case 'MMM d': return `${mmm} ${day}`
    case 'MMM d yyyy': return `${mmm} ${day} ${yyyy}`
    case 'MMM d, yyyy': return `${mmm} ${day}, ${yyyy}`
    case 'MMMM yyyy': return `${mmmm} ${yyyy}`
    case 'MMMM d, yyyy': return `${mmmm} ${day}, ${yyyy}`
    case 'EEE, MMM d': return `${eee}, ${mmm} ${day}`
    case 'EEE, MMM d yyyy': return `${eee}, ${mmm} ${day} ${yyyy}`
    case 'EEEE, MMMM d yyyy': return `${eeee}, ${mmmm} ${day} ${yyyy}`
    default: return date.toLocaleDateString()
  }
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, date.getDate())
}

export function subMonths(date: Date, amount: number): Date {
  return addMonths(date, -amount)
}

export function subDays(date: Date, amount: number): Date {
  return new Date(date.getTime() - amount * DAY)
}

export function subWeeks(date: Date, amount: number): Date {
  return subDays(date, amount * 7)
}

export function startOfWeek(date: Date, options?: { weekStartsOn?: 1 }): Date {
  void options
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = start.getDay() || 7
  start.setDate(start.getDate() - day + 1)
  return start
}

export function endOfWeek(date: Date, options?: { weekStartsOn?: 1 }): Date {
  void options
  const end = startOfWeek(date)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

export function eachDayOfInterval({ start, end }: { start: Date; end: Date }): Date[] {
  const days: Date[] = []
  for (let day = startOfDay(start); day <= end; day = subDays(day, -1)) days.push(day)
  return days
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

export function isToday(date: Date): boolean {
  return format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
}

export function isWithinInterval(date: Date, { start, end }: { start: Date; end: Date }): boolean {
  return date >= start && date <= end
}

export function differenceInMinutes(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 60_000)
}

export function differenceInDays(a: Date, b: Date): number {
  return Math.floor((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY)
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
