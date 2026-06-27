import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDataVersion } from '../context/DataVersion'
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
} from '../utils/date'
import { fetchAllWorkouts } from '../api/dataSource'
import type { Workout } from '../types/workout'
import {
  computeWorkoutVolume,
  computeWorkoutDuration,
  formatDuration,
  formatVolume,
} from '../utils/stats'
import { getMuscleGroupsForExercise } from '../utils/muscles'
import MusclePill from '../components/MusclePill'
import { FullPageSpinner } from '../components/Spinner'
import ErrorBanner from '../components/ErrorBanner'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Workouts() {
  const navigate = useNavigate()
  const { source, version } = useDataVersion()
  const [allWorkouts, setAllWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAllWorkouts(source)
      setAllWorkouts(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workouts')
    } finally {
      setLoading(false)
    }
  }, [source])

  useEffect(() => { load() }, [load, version])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return
      if (e.key === 'ArrowLeft') {
        setCurrentMonth((m) => subMonths(m, 1))
      } else if (e.key === 'ArrowRight') {
        setCurrentMonth((m) => addMonths(m, 1))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (loading) return <FullPageSpinner />
  if (error) return <ErrorBanner message={error} onRetry={load} />

  // Build a map: date string → workouts
  const workoutsByDate = new Map<string, Workout[]>()
  for (const w of allWorkouts) {
    const key = format(parseISO(w.start_time), 'yyyy-MM-dd')
    const existing = workoutsByDate.get(key) ?? []
    workoutsByDate.set(key, [...existing, w])
  }

  // Calendar grid: Mon-Sun weeks
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const monthWorkoutCount = allWorkouts.filter((w) => {
    const d = parseISO(w.start_time)
    return d >= monthStart && d <= monthEnd
  }).length
  const monthWorkouts = allWorkouts
    .filter((w) => {
      const d = parseISO(w.start_time)
      return d >= monthStart && d <= monthEnd
    })
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Workouts</h1>
          <p className="text-sm mt-0.5" style={{ color: '#999' }}>
            {monthWorkoutCount} workout{monthWorkoutCount !== 1 ? 's' : ''} in {format(currentMonth, 'MMMM yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#aaa' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#aaa')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={() => setCurrentMonth(startOfMonth(new Date()))}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#aaa' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#aaa')}
          >
            Today
          </button>
          <span className="text-base font-semibold text-white w-36 text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#aaa' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#aaa')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile agenda */}
      <div className="lg:hidden space-y-2">
        {monthWorkouts.length === 0 ? (
          <div className="py-12 text-center rounded-lg" style={{ border: '1px solid #2a2a2a', backgroundColor: '#151515' }}>
            <p className="text-base" style={{ color: '#777' }}>No workouts in {format(currentMonth, 'MMMM yyyy')}</p>
            <p className="text-sm mt-1" style={{ color: '#555' }}>Use the month controls to review previous sessions.</p>
          </div>
        ) : (
          monthWorkouts.map((w) => {
            const duration = computeWorkoutDuration(w)
            const volume = computeWorkoutVolume(w)
            const muscles = Array.from(
              new Set(
                w.exercises.flatMap((e) =>
                  getMuscleGroupsForExercise(e.title, e.muscle_groups),
                ),
              ),
            ).filter((m) => m !== 'other').slice(0, 3)

            return (
              <button
                key={w.id}
                onClick={() => navigate(`/workouts/${w.id}`)}
                className="w-full text-left rounded-lg p-4 transition-colors"
                style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{w.title}</p>
                    <p className="text-xs mt-1" style={{ color: '#888' }}>
                      {format(parseISO(w.start_time), 'EEE, MMM d')} · {formatDuration(duration)} · {formatVolume(volume)}
                    </p>
                  </div>
                  <span className="text-xs shrink-0" style={{ color: '#666' }}>
                    {format(parseISO(w.start_time), 'HH:mm')}
                  </span>
                </div>
                {muscles.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {muscles.map((m) => <MusclePill key={m} muscle={m} small />)}
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Calendar */}
      <div className="hidden lg:block rounded-lg overflow-hidden" style={{ border: '1px solid #2a2a2a' }}>
        {/* Weekday headers */}
        <div className="grid grid-cols-7" style={{ backgroundColor: '#151515', borderBottom: '1px solid #2a2a2a' }}>
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium uppercase tracking-wider" style={{ color: '#555' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Empty month overlay */}
        {monthWorkoutCount === 0 && (
          <div className="py-16 text-center" style={{ borderTop: '1px solid #1e1e1e', backgroundColor: '#0f0f0f' }}>
            <p className="text-base" style={{ color: '#444' }}>No workouts in {format(currentMonth, 'MMMM yyyy')}</p>
            <p className="text-sm mt-1" style={{ color: '#333' }}>Navigate to a different month or log a workout in the Hevy app.</p>
          </div>
        )}

        {/* Day cells */}
        {monthWorkoutCount > 0 && <div className="grid grid-cols-7" style={{ backgroundColor: '#0f0f0f' }}>
          {days.map((day, i) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayWorkouts = workoutsByDate.get(key) ?? []
            const inMonth = isSameMonth(day, currentMonth)
            const today = isToday(day)

            return (
              <div
                key={key}
                className="min-h-[120px] p-2"
                style={{
                  borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid #1e1e1e',
                  borderBottom: i < days.length - 7 ? '1px solid #1e1e1e' : 'none',
                  backgroundColor: inMonth ? '#0f0f0f' : '#0b0b0b',
                }}
              >
                {/* Date number */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${today ? 'font-bold' : ''}`}
                    style={{
                      color: today ? '#fff' : inMonth ? '#666' : '#333',
                      backgroundColor: today ? '#e86a2e' : 'transparent',
                    }}
                  >
                    {format(day, 'd')}
                  </span>
                  {dayWorkouts.length > 1 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#252525', color: '#888' }}>
                      {dayWorkouts.length}
                    </span>
                  )}
                </div>

                {/* Workout cards */}
                <div className="space-y-1">
                  {dayWorkouts.slice(0, 2).map((w) => {
                    const duration = computeWorkoutDuration(w)
                    const volume = computeWorkoutVolume(w)
                    const muscles = Array.from(
                      new Set(
                        w.exercises.flatMap((e) =>
                          getMuscleGroupsForExercise(e.title, e.muscle_groups),
                        ),
                      ),
                    ).filter((m) => m !== 'other').slice(0, 2)

                    return (
                      <button
                        key={w.id}
                        onClick={() => navigate(`/workouts/${w.id}`)}
                        className="w-full text-left rounded p-1.5 transition-colors"
                        style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#252525'
                          e.currentTarget.style.borderColor = '#e86a2e'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#1a1a1a'
                          e.currentTarget.style.borderColor = '#2a2a2a'
                        }}
                      >
                        <p className="text-xs font-medium text-white truncate leading-tight">{w.title}</p>
                        <p className="text-xs mt-0.5 leading-tight" style={{ color: '#666' }}>
                          {formatDuration(duration)} · {formatVolume(volume)}
                        </p>
                        {muscles.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-1">
                            {muscles.map((m) => <MusclePill key={m} muscle={m} small />)}
                          </div>
                        )}
                      </button>
                    )
                  })}
                  {dayWorkouts.length > 2 && (
                    <p className="text-xs pl-1" style={{ color: '#555' }}>
                      +{dayWorkouts.length - 2} more
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>}
      </div>
    </div>
  )
}
