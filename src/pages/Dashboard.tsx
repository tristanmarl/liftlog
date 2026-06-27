import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDataVersion } from '../context/DataVersion'
import { format, parseISO } from '../utils/date'
import { DATA_SOURCE_LABELS, fetchAllWorkouts } from '../api/dataSource'
import type { Workout } from '../types/workout'
import {
  getWeeklyStats,
  getPeriodStats,
  formatVolume,
  percentChange,
  getPRsInPeriod,
  getWeeklyGoalProgress,
  getConsecutiveTrainingDays,
  getNextRoutineWorkout,
  getProgressionSuggestionsForRoutineWorkout,
  estimateOneRepMax,
} from '../utils/stats'
import StatCard from '../components/StatCard'
import Tooltip from '../components/Tooltip'
import { FullPageSpinner } from '../components/Spinner'
import ErrorBanner from '../components/ErrorBanner'

type Period = 'week' | '30d' | '90d' | '365d'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'This Week' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
  { key: '365d', label: '365 Days' },
]

const VOLUME_REFS = [
  { icon: '🚗', singular: 'car', plural: 'cars', kg: 1_500 },
  { icon: '🐘', singular: 'elephant', plural: 'elephants', kg: 5_000 },
  { icon: '🚌', singular: 'bus', plural: 'buses', kg: 12_000 },
  { icon: '✈️', singular: 'plane', plural: 'planes', kg: 70_000 },
  { icon: '🐋', singular: 'blue whale', plural: 'blue whales', kg: 150_000 },
]

function volumeContext(kg: number): string | null {
  if (kg < 200) return null
  for (const ref of VOLUME_REFS) {
    const ratio = kg / ref.kg
    if (ratio < 8) {
      const n = Math.round(ratio * 10) / 10
      return `about ${n} ${ref.icon} ${n === 1 ? ref.singular : ref.plural}`
    }
  }
  const last = VOLUME_REFS[VOLUME_REFS.length - 1]
  const n = Math.round((kg / last.kg) * 10) / 10
  return `about ${n} ${last.icon} ${last.plural}`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { source, version } = useDataVersion()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>(
    () => (localStorage.getItem('dashboard-period') as Period) ?? 'week',
  )
  const [weeklyGoal, setWeeklyGoal] = useState<number>(
    () => Number(localStorage.getItem('weekly-goal') ?? 3),
  )
  const [overtainingDismissed, setOvertainingDismissed] = useState(false)

  const handlePeriodChange = (p: Period) => {
    setPeriod(p)
    localStorage.setItem('dashboard-period', p)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAllWorkouts(source)
      setWorkouts(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workouts')
    } finally {
      setLoading(false)
    }
  }, [source])

  useEffect(() => { load() }, [load, version])

  if (loading) return <FullPageSpinner />
  if (error) return <ErrorBanner message={error} onRetry={load} />

  const isWeek = period === 'week'
  const periodDays = period === 'week' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365

  const current = isWeek ? getWeeklyStats(workouts, 0) : getPeriodStats(workouts, periodDays, 0)
  const previous = isWeek ? getWeeklyStats(workouts, 1) : getPeriodStats(workouts, periodDays, 1)

  const volumeChange = percentChange(current.totalVolumeKg, previous.totalVolumeKg)
  const countChange = percentChange(current.workoutCount, previous.workoutCount)

  function trendDir(val: number | null): 'up' | 'down' | 'neutral' {
    if (val === null) return 'neutral'
    return val > 0 ? 'up' : val < 0 ? 'down' : 'neutral'
  }

  function trendLabel(val: number | null): string | undefined {
    if (val === null) return undefined
    return `${val > 0 ? '+' : ''}${val}%`
  }

  const periodLabel = isWeek ? 'this week' : `last ${period}`
  const compLabel = isWeek ? 'vs last week' : `vs prev ${period}`

  const prs = getPRsInPeriod(workouts, periodDays)
  const weeklyGoalProgress = getWeeklyGoalProgress(workouts, weeklyGoal)
  const consecutiveDays = getConsecutiveTrainingDays(workouts)
  const nextRoutineWorkout = getNextRoutineWorkout(workouts)
  const progressionSuggestions = getProgressionSuggestionsForRoutineWorkout(
    workouts,
    { title: nextRoutineWorkout.title, routineId: nextRoutineWorkout.routineId },
    5,
  )

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-sm mt-1" style={{ color: '#999' }}>
            A simple read on what to do next from {DATA_SOURCE_LABELS[source]}
          </p>
        </div>
      </div>

      {/* Overtraining alert */}
      {consecutiveDays >= 6 && !overtainingDismissed && (
        <div
          className="rounded-lg p-4 flex items-start justify-between gap-4"
          style={{ backgroundColor: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.3)' }}
        >
          <div className="flex items-start gap-3">
            <span style={{ fontSize: 18 }}>⚠️</span>
            <p className="text-sm" style={{ color: '#facc15' }}>
              You've trained {consecutiveDays} days in a row. Consider a rest day — muscles grow during
              recovery, not during training.
            </p>
          </div>
          <button
            onClick={() => setOvertainingDismissed(true)}
            className="text-xs shrink-0"
            style={{ color: '#666' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Next workout */}
      <div
        className="rounded-lg p-5"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
      >
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider" style={{ color: '#777' }}>Next Workout</p>
            <h2 className="text-xl font-semibold text-white mt-1">{nextRoutineWorkout.title}</h2>
          </div>
          {nextRoutineWorkout.trainedToday && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                backgroundColor: 'rgba(250,204,21,0.15)',
                color: '#facc15',
                border: '1px solid rgba(250,204,21,0.3)',
              }}
            >
              Rest first
            </span>
          )}
        </div>
        <p className="text-sm mb-4" style={{ color: '#888' }}>{nextRoutineWorkout.reason}</p>

        {progressionSuggestions.length > 0 ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-white">Simple targets</h3>
              <Tooltip text="Use these as suggestions, not rules. If form is not steady, repeat the previous weight.">
                <span className="text-xs cursor-default" style={{ color: '#555' }}>ⓘ</span>
              </Tooltip>
            </div>
            <div className="space-y-2.5">
              {progressionSuggestions.map((s) => (
                <div key={s.exerciseTitle} className="flex items-center justify-between text-sm">
                  <span className="text-white font-medium truncate flex-1 min-w-0 mr-4">
                    {s.exerciseTitle}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span style={{ color: '#555' }}>{s.lastWeightKg} kg</span>
                    {s.isPlateaued ? (
                      <Tooltip text="Same weight for 3+ sessions. Repeat it with cleaner reps, use a smaller increase, or take a lighter week.">
                        <span
                          className="text-xs px-2 py-0.5 rounded cursor-default"
                          style={{
                            backgroundColor: 'rgba(250,204,21,0.1)',
                            color: '#facc15',
                            border: '1px solid rgba(250,204,21,0.2)',
                          }}
                        >
                          needs attention
                        </span>
                      </Tooltip>
                    ) : (
                      <>
                        <span style={{ color: '#444' }}>→</span>
                        <span className="font-semibold" style={{ color: '#4ade80' }}>
                          try {s.suggestedWeightKg} kg
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm" style={{ color: '#666' }}>
            No previous {nextRoutineWorkout.title} found yet. Start conservative, write down what felt easy or hard, and let the next session set the target.
          </p>
        )}
      </div>

      <div>
        {/* Weekly Goal */}
        <div
          className="rounded-lg p-5"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white">Weekly Goal</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const next = Math.max(1, weeklyGoal - 1)
                  setWeeklyGoal(next)
                  localStorage.setItem('weekly-goal', String(next))
                }}
                className="w-7 h-7 flex items-center justify-center rounded text-sm font-bold"
                style={{ backgroundColor: '#252525', color: '#888', border: '1px solid #333' }}
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-semibold text-white">{weeklyGoal}</span>
              <button
                onClick={() => {
                  const next = Math.min(7, weeklyGoal + 1)
                  setWeeklyGoal(next)
                  localStorage.setItem('weekly-goal', String(next))
                }}
                className="w-7 h-7 flex items-center justify-center rounded text-sm font-bold"
                style={{ backgroundColor: '#252525', color: '#888', border: '1px solid #333' }}
              >
                +
              </button>
            </div>
          </div>
          <div className="rounded-full overflow-hidden h-2.5 mb-2" style={{ backgroundColor: '#252525' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${weeklyGoalProgress.pct * 100}%`, backgroundColor: '#e86a2e' }}
            />
          </div>
          {weeklyGoalProgress.done >= weeklyGoal ? (
            <p className="text-sm font-medium" style={{ color: '#4ade80' }}>Goal reached! 🎯</p>
          ) : (
            <p className="text-sm" style={{ color: '#888' }}>
              {weeklyGoalProgress.done} of {weeklyGoalProgress.goal} workouts this week
            </p>
          )}
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-white">Progress</h2>
            <p className="text-xs mt-0.5" style={{ color: '#666' }}>
              {isWeek
                ? (current as ReturnType<typeof getWeeklyStats>).weekLabel
                : (current as ReturnType<typeof getPeriodStats>).label}
            </p>
          </div>
          <div
            className="flex items-center rounded-lg overflow-hidden"
            style={{ border: '1px solid #333', backgroundColor: '#1a1a1a' }}
          >
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handlePeriodChange(key)}
                className="px-3 py-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: period === key ? '#e86a2e' : 'transparent',
                  color: period === key ? '#fff' : '#888',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              title: 'Workouts',
              value: current.workoutCount,
              trend: trendDir(countChange),
              trendValue: trendLabel(countChange),
            },
            {
              title: 'Total work',
              hint: 'Total work is sets x reps x weight across your exercises. It should trend up slowly, but not every single week.',
              value: formatVolume(current.totalVolumeKg),
              note: volumeContext(current.totalVolumeKg) ?? undefined,
              trend: trendDir(volumeChange),
              trendValue: trendLabel(volumeChange),
            },
          ].map((card) => (
            <div
              key={card.title}
              className="cursor-pointer rounded-lg transition-all"
              onClick={() => navigate('/workouts')}
              onMouseEnter={(e) => {
                ;(e.currentTarget.firstChild as HTMLElement | null)?.setAttribute(
                  'style',
                  'background-color: #1a1a1a; border-color: #e86a2e',
                )
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget.firstChild as HTMLElement | null)?.setAttribute(
                  'style',
                  'background-color: #1a1a1a; border-color: #2a2a2a',
                )
              }}
            >
              <StatCard
                title={card.title}
                hint={card.hint}
                value={card.value}
                note={card.note}
                subtitle={periodLabel}
                trend={card.trend}
                trendValue={card.trendValue}
                secondaryLabel={compLabel}
              />
            </div>
          ))}
        </div>
      </div>

      {/* PRs with 1RM estimate */}
      {prs.length > 0 && (
        <div
          className="rounded-lg p-5"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold text-white">Strength wins this period</h2>
            <Tooltip text="Personal records are your best recent lifts. They are useful signals, but good form matters more than chasing a number.">
              <span className="text-xs cursor-default" style={{ color: '#555' }}>ⓘ</span>
            </Tooltip>
          </div>
          <div className="space-y-3">
            {prs.slice(0, 5).map((pr) => {
              const orm = estimateOneRepMax(pr.weightKg, pr.reps)
              return (
                <div
                  key={`${pr.exerciseTitle}-${pr.date}`}
                  className="flex items-start justify-between text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-white font-medium truncate block">{pr.exerciseTitle}</span>
                    <span className="text-xs" style={{ color: '#666' }}>
                      {format(parseISO(pr.date), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <span className="font-semibold" style={{ color: '#e86a2e' }}>
                      {pr.weightKg} kg × {pr.reps}
                    </span>
                    {orm > 0 && (
                      <Tooltip text="Estimated 1-rep max (Epley formula) — the heaviest single rep you could theoretically do right now.">
                        <span className="ml-2 text-xs cursor-default" style={{ color: '#666' }}>
                          ~{orm} kg max estimate
                        </span>
                      </Tooltip>
                    )}
                    {pr.previousBestKg > 0 && (
                      <span className="block text-xs mt-0.5" style={{ color: '#555' }}>
                        ↑ prev {pr.previousBestKg} kg
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {prs.length > 5 && (
              <p className="text-xs pt-1" style={{ color: '#555' }}>+{prs.length - 5} more</p>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
