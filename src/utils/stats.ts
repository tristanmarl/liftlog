import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  subDays,
  format,
  parseISO,
  isWithinInterval,
  differenceInMinutes,
  differenceInDays,
} from './date'
import type { Workout, WorkoutSet } from '../types/workout'
import { getMuscleGroupsForExercise } from './muscles'

export interface WeeklyStats {
  weekLabel: string
  workoutCount: number
  totalVolumeKg: number
  totalSets: number
  totalReps: number
  durationMinutes: number
  muscleGroups: string[]
}

export interface ExerciseDataPoint {
  date: string
  maxWeightKg: number
  totalVolumeKg: number
  totalSets: number
  totalReps: number
}

export function computeSetVolume(set: WorkoutSet): number {
  if (set.weight_kg != null && set.reps != null) {
    return set.weight_kg * set.reps
  }
  return 0
}

export function computeWorkoutVolume(workout: Workout): number {
  return workout.exercises.reduce((total, exercise) => {
    return (
      total +
      exercise.sets
        .filter((s) => s.type !== 'warmup')
        .reduce((sum, set) => sum + computeSetVolume(set), 0)
    )
  }, 0)
}

export function computeWorkoutDuration(workout: Workout): number {
  return differenceInMinutes(parseISO(workout.end_time), parseISO(workout.start_time))
}

export function getWeeklyStats(workouts: Workout[], weeksBack = 0): WeeklyStats {
  const referenceDate = subWeeks(new Date(), weeksBack)
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 })

  const weekWorkouts = workouts.filter((w) =>
    isWithinInterval(parseISO(w.start_time), { start: weekStart, end: weekEnd }),
  )

  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`
  const muscleGroupSet = new Set<string>()

  let totalVolumeKg = 0
  let totalSets = 0
  let totalReps = 0
  let durationMinutes = 0

  for (const workout of weekWorkouts) {
    durationMinutes += computeWorkoutDuration(workout)

    for (const exercise of workout.exercises) {
      const muscles = getMuscleGroupsForExercise(exercise.title, exercise.muscle_groups)
      muscles.forEach((m) => muscleGroupSet.add(m))

      for (const set of exercise.sets) {
        if (set.type === 'warmup') continue
        totalSets++
        totalVolumeKg += computeSetVolume(set)
        if (set.reps != null) totalReps += set.reps
      }
    }
  }

  return {
    weekLabel,
    workoutCount: weekWorkouts.length,
    totalVolumeKg,
    totalSets,
    totalReps,
    durationMinutes,
    muscleGroups: Array.from(muscleGroupSet),
  }
}

export function getExerciseHistory(
  workouts: Workout[],
  exerciseTitle: string,
): ExerciseDataPoint[] {
  const points: ExerciseDataPoint[] = []

  const sorted = [...workouts].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  )

  for (const workout of sorted) {
    const exercise = workout.exercises.find(
      (e) => e.title.toLowerCase() === exerciseTitle.toLowerCase(),
    )
    if (!exercise) continue

    const normalSets = exercise.sets.filter((s) => s.type !== 'warmup')
    if (normalSets.length === 0) continue

    let maxWeightKg = 0
    let totalVolumeKg = 0
    let totalReps = 0

    for (const set of normalSets) {
      if (set.weight_kg != null && set.weight_kg > maxWeightKg) {
        maxWeightKg = set.weight_kg
      }
      totalVolumeKg += computeSetVolume(set)
      if (set.reps != null) totalReps += set.reps
    }

    points.push({
      date: format(parseISO(workout.start_time), 'yyyy-MM-dd'),
      maxWeightKg,
      totalVolumeKg,
      totalSets: normalSets.length,
      totalReps,
    })
  }

  return points
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatVolume(kg: number): string {
  return `${Math.round(kg).toLocaleString()} kg`
}

// Epley formula — unreliable above 10 reps, returns 0 in that case
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0
  if (reps === 1) return weightKg
  if (reps > 10) return 0
  return Math.round(weightKg * (1 + reps / 30))
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export interface PeriodStats {
  label: string
  workoutCount: number
  totalVolumeKg: number
  totalSets: number
  totalReps: number
  durationMinutes: number
  muscleGroups: string[]
}

export function getPeriodStats(workouts: Workout[], days: number, periodsBack = 0): PeriodStats {
  const now = new Date()
  const end = new Date(now.getTime() - periodsBack * days * 24 * 60 * 60 * 1000)
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)

  const periodWorkouts = workouts.filter((w) => {
    const t = parseISO(w.start_time).getTime()
    return t >= start.getTime() && t < end.getTime()
  })

  const muscleGroupSet = new Set<string>()
  let totalVolumeKg = 0
  let totalSets = 0
  let totalReps = 0
  let durationMinutes = 0

  for (const workout of periodWorkouts) {
    durationMinutes += computeWorkoutDuration(workout)
    for (const exercise of workout.exercises) {
      const muscles = getMuscleGroupsForExercise(exercise.title, exercise.muscle_groups)
      muscles.forEach((m) => muscleGroupSet.add(m))
      for (const set of exercise.sets) {
        if (set.type === 'warmup') continue
        totalSets++
        totalVolumeKg += computeSetVolume(set)
        if (set.reps != null) totalReps += set.reps
      }
    }
  }

  const label = `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`

  return {
    label,
    workoutCount: periodWorkouts.length,
    totalVolumeKg,
    totalSets,
    totalReps,
    durationMinutes,
    muscleGroups: Array.from(muscleGroupSet),
  }
}

// Returns true if max weight has not improved in the last `threshold` sessions
export function detectPlateau(history: ExerciseDataPoint[], threshold = 5): boolean {
  if (history.length < threshold) return false
  const recent = history.slice(-threshold)
  const first = recent[0].maxWeightKg
  return recent.every((p) => p.maxWeightKg <= first)
}

export interface MuscleFrequency {
  muscle: string
  totalSets: number
  sessionsCount: number
  avgSetsPerWeek: number
  sessionsPerWeek: number
}

export function getWeeklyMuscleFrequency(workouts: Workout[], weeks: number): MuscleFrequency[] {
  const cutoff = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000)
  const recent = workouts.filter((w) => parseISO(w.start_time) >= cutoff)

  const muscleData = new Map<string, { sets: number; sessions: Set<string> }>()

  for (const workout of recent) {
    for (const exercise of workout.exercises) {
      const muscles = getMuscleGroupsForExercise(exercise.title, exercise.muscle_groups)
      const normalSets = exercise.sets.filter((s) => s.type !== 'warmup')
      for (const muscle of muscles) {
        if (muscle === 'other') continue
        const entry = muscleData.get(muscle) ?? { sets: 0, sessions: new Set() }
        entry.sets += normalSets.length
        entry.sessions.add(workout.id)
        muscleData.set(muscle, entry)
      }
    }
  }

  return Array.from(muscleData.entries())
    .map(([muscle, data]) => ({
      muscle,
      totalSets: data.sets,
      sessionsCount: data.sessions.size,
      avgSetsPerWeek: Math.round((data.sets / weeks) * 10) / 10,
      sessionsPerWeek: Math.round((data.sessions.size / weeks) * 10) / 10,
    }))
    .sort((a, b) => b.totalSets - a.totalSets)
}

export interface PREntry {
  exerciseTitle: string
  weightKg: number
  reps: number
  previousBestKg: number
  date: string
}

export function getPRsInPeriod(workouts: Workout[], days: number): PREntry[] {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const sorted = [...workouts].sort((a, b) => parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime())
  const prs: PREntry[] = []
  const allTimeBest = new Map<string, number>()

  for (const workout of sorted) {
    const workoutDate = parseISO(workout.start_time)
    for (const exercise of workout.exercises) {
      const normalSets = exercise.sets.filter((s) => s.type !== 'warmup' && s.weight_kg != null && s.reps != null)
      const maxWeight = Math.max(0, ...normalSets.map((s) => s.weight_kg as number))
      if (maxWeight === 0) continue

      const prevBest = allTimeBest.get(exercise.title) ?? 0

      if (workoutDate >= cutoff && maxWeight > prevBest) {
        const maxWeightSet = normalSets.reduce(
          (best, s) => ((s.weight_kg as number) > (best.weight_kg as number) ? s : best),
          normalSets[0],
        )
        prs.push({
          exerciseTitle: exercise.title,
          weightKg: maxWeight,
          reps: maxWeightSet?.reps ?? 1,
          previousBestKg: prevBest,
          date: format(workoutDate, 'yyyy-MM-dd'),
        })
      }

      if (maxWeight > prevBest) allTimeBest.set(exercise.title, maxWeight)
    }
  }

  return prs.reverse()
}

// Consecutive weeks with ≥1 workout (most recent streak)
export function getConsistencyStreak(workouts: Workout[]): number {
  if (workouts.length === 0) return 0
  let streak = 0
  let weekOffset = 0
  while (true) {
    const refDate = subWeeks(new Date(), weekOffset)
    const wStart = startOfWeek(refDate, { weekStartsOn: 1 })
    const wEnd = endOfWeek(refDate, { weekStartsOn: 1 })
    const hasWorkout = workouts.some((w) =>
      isWithinInterval(parseISO(w.start_time), { start: wStart, end: wEnd })
    )
    if (!hasWorkout) break
    streak++
    weekOffset++
    if (weekOffset > 104) break // cap at 2 years
  }
  return streak
}

// Progress toward weekly workout goal
export function getWeeklyGoalProgress(workouts: Workout[], goal: number): { done: number; goal: number; pct: number } {
  const wStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const wEnd = endOfWeek(new Date(), { weekStartsOn: 1 })
  const done = workouts.filter((w) =>
    isWithinInterval(parseISO(w.start_time), { start: wStart, end: wEnd })
  ).length
  return { done, goal, pct: Math.min(1, done / goal) }
}

export interface MuscleNeglect {
  muscle: string
  daysSince: number
  lastDate: string
}

// Muscles not trained in > thresholdDays that have been trained at least once in last 60 days
export function getMuscleNeglectAlerts(workouts: Workout[], thresholdDays = 7): MuscleNeglect[] {
  const lastWorked = new Map<string, string>()
  const cutoff60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

  for (const workout of workouts) {
    const date = format(parseISO(workout.start_time), 'yyyy-MM-dd')
    for (const exercise of workout.exercises) {
      const muscles = getMuscleGroupsForExercise(exercise.title, exercise.muscle_groups)
      for (const m of muscles) {
        if (m === 'other' || m === 'cardio') continue
        const existing = lastWorked.get(m)
        if (!existing || date > existing) lastWorked.set(m, date)
      }
    }
  }

  const alerts: MuscleNeglect[] = []
  for (const [muscle, lastDate] of lastWorked.entries()) {
    if (parseISO(lastDate) < cutoff60) continue // skip muscles abandoned long ago
    const days = differenceInDays(new Date(), parseISO(lastDate))
    if (days >= thresholdDays) {
      alerts.push({ muscle, daysSince: days, lastDate })
    }
  }

  return alerts.sort((a, b) => b.daysSince - a.daysSince)
}

export interface MuscleBalance {
  pushSets: number
  pullSets: number
  upperSets: number
  lowerSets: number
  pushPullRatio: number // push/pull, ideal ~1.0
  upperLowerRatio: number // upper/lower, ideal ~1.0–1.5
  warning: string | null
}

export function getMuscleBalance(workouts: Workout[], weeks = 4): MuscleBalance {
  const cutoff = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000)
  const recent = workouts.filter((w) => parseISO(w.start_time) >= cutoff)

  let pushSets = 0, pullSets = 0, upperSets = 0, lowerSets = 0

  for (const workout of recent) {
    for (const exercise of workout.exercises) {
      const muscles = getMuscleGroupsForExercise(exercise.title, exercise.muscle_groups)
      const normalSets = exercise.sets.filter((s) => s.type !== 'warmup').length
      for (const m of muscles) {
        if (m === 'chest' || m === 'shoulders' || m === 'triceps') pushSets += normalSets
        if (m === 'back' || m === 'biceps') pullSets += normalSets
        if (m === 'chest' || m === 'shoulders' || m === 'triceps' || m === 'back' || m === 'biceps') upperSets += normalSets
        if (m === 'legs') lowerSets += normalSets
      }
    }
  }

  const pushPullRatio = pullSets === 0 ? (pushSets > 0 ? 99 : 1) : Math.round((pushSets / pullSets) * 10) / 10
  const upperLowerRatio = lowerSets === 0 ? (upperSets > 0 ? 99 : 1) : Math.round((upperSets / lowerSets) * 10) / 10

  let warning: string | null = null
  if (pushPullRatio > 2) warning = `You're doing ${pushPullRatio}× more push than pull sets. This causes shoulder imbalances over time. Add more rows and pull-downs.`
  else if (pullSets > pushSets * 2) warning = `You're doing ${Math.round(pullSets/pushSets)}× more pull than push sets. Consider adding more chest and shoulder work.`
  else if (upperLowerRatio > 3) warning = `${Math.round(upperSets/(upperSets+lowerSets)*100)}% of your training is upper body. Add leg days to avoid imbalance.`
  else if (lowerSets > upperSets * 2) warning = `Most of your training is lower body. Consider adding upper body work.`

  return { pushSets, pullSets, upperSets, lowerSets, pushPullRatio, upperLowerRatio, warning }
}

export const ROUTINE_ORDER = ['Upper #1', 'Lower #1', 'Upper #2', 'Lower #2'] as const

export interface NextRoutineWorkout {
  title: string
  routineId: string | null
  lastTitle: string | null
  lastRoutineId: string | null
  lastDate: string | null
  reason: string
  trainedToday: boolean
}

function normalizeRoutineTitle(title: string): string {
  return title.toLowerCase().replace(/\s*#/g, '#')
}

function routineIndex(title: string): number {
  const normalized = normalizeRoutineTitle(title)
  return ROUTINE_ORDER.findIndex((routineTitle) => normalized.includes(normalizeRoutineTitle(routineTitle)))
}

function buildRoutineCycle(workouts: Workout[]): { id: string | null; title: string }[] {
  const chronological = [...workouts].sort(
    (a, b) => parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime(),
  )

  const byTitle: Array<{ id: string | null; title: string } | null> = ROUTINE_ORDER.map(() => null)
  for (const workout of chronological) {
    const idx = routineIndex(workout.title)
    if (idx !== -1) {
      byTitle[idx] = {
        id: workout.routine_id ?? null,
        title: ROUTINE_ORDER[idx],
      }
    }
  }

  if (byTitle.some(Boolean)) {
    return byTitle.map((slot, idx) => slot ?? { id: null, title: ROUTINE_ORDER[idx] })
  }

  const observed: { id: string; title: string }[] = []
  for (const workout of chronological) {
    if (!workout.routine_id) continue
    if (observed.some((slot) => slot.id === workout.routine_id && slot.title === workout.title)) continue
    observed.push({ id: workout.routine_id, title: workout.title })
  }

  if (observed.length > 0) return observed

  return ROUTINE_ORDER.map((title) => ({ id: null, title }))
}

function matchesRoutineSlot(workout: Workout, slot: { id: string | null; title: string }): boolean {
  if (slot.id && workout.routine_id) {
    if (workout.routine_id !== slot.id) return false
    return workout.title === slot.title || routineIndex(workout.title) === routineIndex(slot.title)
  }
  return routineIndex(workout.title) === routineIndex(slot.title)
}

export function getNextRoutineWorkout(workouts: Workout[]): NextRoutineWorkout {
  const sorted = [...workouts].sort(
    (a, b) => parseISO(b.start_time).getTime() - parseISO(a.start_time).getTime(),
  )
  const routineCycle = buildRoutineCycle(workouts)
  const lastRoutineWorkout = sorted.find((workout) =>
    routineCycle.some((slot) => matchesRoutineSlot(workout, slot)),
  )

  if (!lastRoutineWorkout) {
    const firstSlot = routineCycle[0]
    return {
      title: firstSlot.title,
      routineId: firstSlot.id,
      lastTitle: null,
      lastRoutineId: null,
      lastDate: null,
      reason: `Start with ${firstSlot.title}.`,
      trainedToday: false,
    }
  }

  const lastIndex = routineCycle.findIndex((slot) => matchesRoutineSlot(lastRoutineWorkout, slot))
  const lastSlot = routineCycle[lastIndex]
  const nextSlot = routineCycle[(lastIndex + 1) % routineCycle.length]
  const lastDate = format(parseISO(lastRoutineWorkout.start_time), 'yyyy-MM-dd')
  const today = format(new Date(), 'yyyy-MM-dd')
  const trainedToday = lastDate === today

  return {
    title: nextSlot.title,
    routineId: nextSlot.id,
    lastTitle: lastSlot.title,
    lastRoutineId: lastRoutineWorkout.routine_id ?? lastSlot.id,
    lastDate,
    reason: trainedToday
      ? `You already did ${lastSlot.title} today. Next up is ${nextSlot.title} when you are recovered.`
      : `Last routine workout was ${lastSlot.title}. Next up is ${nextSlot.title}.`,
    trainedToday,
  }
}

// Returns number of consecutive training days ending today/yesterday (overtraining check)
export function getConsecutiveTrainingDays(workouts: Workout[]): number {
  if (workouts.length === 0) return 0
  const trainedDates = new Set(workouts.map((w) => format(parseISO(w.start_time), 'yyyy-MM-dd')))
  let count = 0
  let checkDate = new Date()
  // start from today or yesterday
  if (!trainedDates.has(format(checkDate, 'yyyy-MM-dd'))) {
    checkDate = subDays(checkDate, 1)
  }
  while (trainedDates.has(format(checkDate, 'yyyy-MM-dd'))) {
    count++
    checkDate = subDays(checkDate, 1)
    if (count > 30) break
  }
  return count
}

export interface ProgressionSuggestion {
  exerciseTitle: string
  lastWeightKg: number
  suggestedWeightKg: number
  isPlateaued: boolean
  lastDate: string
}

export function getProgressionSuggestionsForRoutineWorkout(
  workouts: Workout[],
  routine: string | { title: string; routineId?: string | null },
  maxCount = 5,
): ProgressionSuggestion[] {
  const routineTitle = typeof routine === 'string' ? routine : routine.title
  const routineId = typeof routine === 'string' ? null : routine.routineId ?? null
  const templateWorkout = workouts.find((workout) =>
    routineId && workout.routine_id
      ? workout.routine_id === routineId &&
        (workout.title === routineTitle || routineIndex(workout.title) === routineIndex(routineTitle))
      : routineIndex(workout.title) === routineIndex(routineTitle),
  )
  if (!templateWorkout) return []

  const suggestions: ProgressionSuggestion[] = []
  const seen = new Set<string>()

  for (const exercise of templateWorkout.exercises) {
    if (seen.has(exercise.title)) continue
    seen.add(exercise.title)

    const history = getExerciseHistory(workouts, exercise.title)
    if (history.length === 0) continue

    const lastSession = history[history.length - 1]
    if (lastSession.maxWeightKg <= 0) continue

    const plateaued = detectPlateau(history, 3)
    const increment = lastSession.maxWeightKg >= 60 ? 2.5 : 1.25
    const suggestedWeightKg = plateaued
      ? lastSession.maxWeightKg
      : Math.round((lastSession.maxWeightKg + increment) * 4) / 4

    suggestions.push({
      exerciseTitle: exercise.title,
      lastWeightKg: lastSession.maxWeightKg,
      suggestedWeightKg,
      isPlateaued: plateaued,
      lastDate: lastSession.date,
    })

    if (suggestions.length >= maxCount) break
  }

  return suggestions
}
