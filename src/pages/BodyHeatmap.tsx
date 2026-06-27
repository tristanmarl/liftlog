import { useEffect, useState, useCallback } from 'react'
import { useDataVersion } from '../context/DataVersion'
import { format, parseISO, differenceInDays } from '../utils/date'
import { fetchAllWorkouts } from '../api/dataSource'
import type { MuscleGroupStats, Workout } from '../types/workout'
import { computeMuscleHeatmapForPeriod } from '../utils/muscles'
import { getMuscleBalance, getMuscleNeglectAlerts, getWeeklyMuscleFrequency } from '../utils/stats'
import { FullPageSpinner } from '../components/Spinner'
import ErrorBanner from '../components/ErrorBanner'
import AppTooltip from '../components/Tooltip'

// MEV = minimum effective volume (sets/week). MAV = maximum adaptive volume.
// Secondary muscles (biceps, triceps, shoulders, core) need less direct work
// because compound lifts already stimulate them heavily.
const MUSCLE_ORDER = ['back', 'chest', 'legs', 'shoulders', 'biceps', 'triceps', 'core', 'cardio']

const MUSCLE_TARGETS: Record<string, { mev: number; mav: number }> = {
  back:      { mev: 10, mav: 22 },
  chest:     { mev: 8,  mav: 20 },
  legs:      { mev: 8,  mav: 20 },
  shoulders: { mev: 6,  mav: 20 },
  biceps:    { mev: 6,  mav: 18 },
  triceps:   { mev: 6,  mav: 14 },
  core:      { mev: 4,  mav: 16 },
  cardio:    { mev: 3,  mav: 6  },
}

const MUSCLE_CATEGORY: Record<string, string> = {
  chest: 'push', shoulders: 'push', triceps: 'push',
  back: 'pull', biceps: 'pull',
  legs: 'lower', core: 'core',
}

const MUSCLE_TARGET_NOTE: Record<string, string> = {
  biceps: 'Rows and pull-ups already train biceps. Direct curls add extra work.',
  triceps: 'Pressing already trains triceps. Direct work supplements compounds.',
  shoulders: 'Shoulders get indirect work from chest and back exercises.',
  core: 'Compound lifts already train core. Direct work is optional.',
}

function daysAgoColor(lastWorked: string): string {
  const days = differenceInDays(new Date(), parseISO(lastWorked))
  if (days <= 7) return '#4ade80'
  if (days <= 14) return '#facc15'
  return '#f87171'
}

function daysAgoLabel(lastWorked: string): string {
  const days = differenceInDays(new Date(), parseISO(lastWorked))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

function getHeatColor(sets: number): string {
  if (sets === 0) return '#2a2a2a'
  if (sets <= 5) return '#4a3020'
  if (sets <= 10) return '#7a4a20'
  if (sets <= 20) return '#c86020'
  return '#e86a2e'
}

interface MuscleRegion {
  id: string
  label: string
  side: 'front' | 'back'
  path: string
}

const FRONT_REGIONS: MuscleRegion[] = [
  {
    id: 'chest',
    label: 'Chest',
    side: 'front',
    path: 'M 72 55 C 68 50 60 50 55 56 C 52 60 52 68 55 72 C 60 77 68 78 72 75 C 76 78 84 77 89 72 C 92 68 92 60 89 56 C 84 50 76 50 72 55 Z',
  },
  {
    id: 'shoulders',
    label: 'Shoulders',
    side: 'front',
    path: 'M 45 50 C 40 45 34 46 31 50 C 28 55 30 62 36 64 C 42 65 48 62 50 57 C 52 53 50 50 45 50 Z M 99 50 C 104 45 110 46 113 50 C 116 55 114 62 108 64 C 102 65 96 62 94 57 C 92 53 94 50 99 50 Z',
  },
  {
    id: 'biceps',
    label: 'Biceps',
    side: 'front',
    path: 'M 36 65 C 30 67 27 74 29 82 C 31 88 37 90 42 88 C 47 85 49 78 47 72 C 45 66 41 63 36 65 Z M 108 65 C 114 67 117 74 115 82 C 113 88 107 90 102 88 C 97 85 95 78 97 72 C 99 66 103 63 108 65 Z',
  },
  {
    id: 'core',
    label: 'Core / Abs',
    side: 'front',
    path: 'M 62 78 L 82 78 L 84 108 L 60 108 Z',
  },
  {
    id: 'quads_left',
    label: 'Quads (Left)',
    side: 'front',
    path: 'M 60 110 C 56 113 54 122 55 132 C 56 142 60 150 65 152 C 69 153 72 150 73 145 L 73 112 C 70 110 65 109 60 110 Z',
  },
  {
    id: 'quads_right',
    label: 'Quads (Right)',
    side: 'front',
    path: 'M 84 110 C 88 113 90 122 89 132 C 88 142 84 150 79 152 C 75 153 72 150 71 145 L 71 112 C 74 110 79 109 84 110 Z',
  },
  {
    id: 'calves_front_left',
    label: 'Calves (Left)',
    side: 'front',
    path: 'M 59 158 C 55 162 54 172 56 180 C 58 186 63 188 67 186 C 70 184 71 178 71 172 L 70 158 C 66 157 62 157 59 158 Z',
  },
  {
    id: 'calves_front_right',
    label: 'Calves (Right)',
    side: 'front',
    path: 'M 85 158 C 89 162 90 172 88 180 C 86 186 81 188 77 186 C 74 184 73 178 73 172 L 74 158 C 78 157 82 157 85 158 Z',
  },
]

const BACK_REGIONS: MuscleRegion[] = [
  {
    id: 'traps',
    label: 'Upper Back / Traps',
    side: 'back',
    path: 'M 72 50 C 65 50 57 53 53 58 C 55 63 60 65 66 64 L 72 62 L 78 64 C 84 65 89 63 91 58 C 87 53 79 50 72 50 Z',
  },
  {
    id: 'lats_left',
    label: 'Lats (Left)',
    side: 'back',
    path: 'M 52 60 C 46 64 44 72 46 82 C 48 88 53 90 58 88 C 62 86 63 80 62 74 L 60 65 C 57 62 55 60 52 60 Z',
  },
  {
    id: 'lats_right',
    label: 'Lats (Right)',
    side: 'back',
    path: 'M 92 60 C 98 64 100 72 98 82 C 96 88 91 90 86 88 C 82 86 81 80 82 74 L 84 65 C 87 62 89 60 92 60 Z',
  },
  {
    id: 'triceps_left',
    label: 'Triceps (Left)',
    side: 'back',
    path: 'M 38 65 C 33 68 30 76 32 84 C 34 90 40 92 45 90 C 50 87 51 80 49 74 C 47 67 43 63 38 65 Z',
  },
  {
    id: 'triceps_right',
    label: 'Triceps (Right)',
    side: 'back',
    path: 'M 106 65 C 111 68 114 76 112 84 C 110 90 104 92 99 90 C 94 87 93 80 95 74 C 97 67 101 63 106 65 Z',
  },
  {
    id: 'glutes',
    label: 'Glutes',
    side: 'back',
    path: 'M 58 108 C 54 112 53 120 56 128 C 58 133 63 136 70 135 L 74 134 L 78 135 C 85 136 90 133 88 128 C 91 120 90 112 86 108 Z',
  },
  {
    id: 'hamstrings_left',
    label: 'Hamstrings (Left)',
    side: 'back',
    path: 'M 58 138 C 53 142 52 152 54 162 C 56 170 61 174 67 173 C 72 171 74 165 73 158 L 72 140 C 68 138 63 137 58 138 Z',
  },
  {
    id: 'hamstrings_right',
    label: 'Hamstrings (Right)',
    side: 'back',
    path: 'M 86 138 C 91 142 92 152 90 162 C 88 170 83 174 77 173 C 72 171 70 165 71 158 L 72 140 C 76 138 81 137 86 138 Z',
  },
  {
    id: 'calves_back_left',
    label: 'Calves (Left)',
    side: 'back',
    path: 'M 61 176 C 57 180 56 190 58 198 C 60 204 65 206 69 204 C 72 202 73 196 73 190 L 72 176 C 68 175 64 175 61 176 Z',
  },
  {
    id: 'calves_back_right',
    label: 'Calves (Right)',
    side: 'back',
    path: 'M 83 176 C 87 180 88 190 86 198 C 84 204 79 206 75 204 C 72 202 71 196 71 190 L 72 176 C 76 175 80 175 83 176 Z',
  },
]

// Mapping from SVG region IDs to muscle stat keys
const REGION_TO_MUSCLE: Record<string, string> = {
  chest: 'chest',
  shoulders: 'shoulders',
  biceps: 'biceps',
  core: 'core',
  quads_left: 'legs',
  quads_right: 'legs',
  calves_front_left: 'legs',
  calves_front_right: 'legs',
  traps: 'back',
  lats_left: 'back',
  lats_right: 'back',
  triceps_left: 'triceps',
  triceps_right: 'triceps',
  glutes: 'legs',
  hamstrings_left: 'legs',
  hamstrings_right: 'legs',
  calves_back_left: 'legs',
  calves_back_right: 'legs',
}

function BodySVG({
  regions,
  stats,
  hovered,
  onHover,
  onClick,
}: {
  regions: MuscleRegion[]
  stats: Record<string, MuscleGroupStats>
  hovered: string | null
  onHover: (id: string | null) => void
  onClick: (id: string) => void
}) {
  return (
    <svg viewBox="0 0 144 210" className="w-full" style={{ maxHeight: 380 }}>
      {/* Body silhouette */}
      {/* Head */}
      <ellipse cx="72" cy="22" rx="14" ry="16" fill="#1e1e1e" stroke="#333" strokeWidth="1" />
      {/* Neck */}
      <rect x="68" y="35" width="8" height="10" fill="#1e1e1e" />
      {/* Torso */}
      <path d="M 52 45 L 36 65 L 30 95 L 33 108 L 60 112 L 84 112 L 111 108 L 114 95 L 108 65 L 92 45 Z" fill="#1e1e1e" stroke="#333" strokeWidth="1" />
      {/* Left arm */}
      <path d="M 36 65 L 28 95 L 26 110 L 33 112 L 38 95 L 50 67" fill="#1e1e1e" stroke="#333" strokeWidth="1" />
      {/* Right arm */}
      <path d="M 108 65 L 116 95 L 118 110 L 111 112 L 106 95 L 94 67" fill="#1e1e1e" stroke="#333" strokeWidth="1" />
      {/* Left forearm */}
      <path d="M 26 110 L 20 130 L 28 132 L 33 112" fill="#1e1e1e" stroke="#333" strokeWidth="1" />
      {/* Right forearm */}
      <path d="M 118 110 L 124 130 L 116 132 L 111 112" fill="#1e1e1e" stroke="#333" strokeWidth="1" />
      {/* Left leg */}
      <path d="M 60 112 L 55 155 L 58 188 L 70 188 L 72 155 L 72 112" fill="#1e1e1e" stroke="#333" strokeWidth="1" />
      {/* Right leg */}
      <path d="M 84 112 L 89 155 L 86 188 L 74 188 L 72 155 L 72 112" fill="#1e1e1e" stroke="#333" strokeWidth="1" />
      {/* Left foot */}
      <ellipse cx="62" cy="192" rx="9" ry="5" fill="#1e1e1e" stroke="#333" strokeWidth="1" />
      {/* Right foot */}
      <ellipse cx="82" cy="192" rx="9" ry="5" fill="#1e1e1e" stroke="#333" strokeWidth="1" />

      {/* Muscle regions */}
      {regions.map((region) => {
        const muscleKey = REGION_TO_MUSCLE[region.id]
        const muscleStats = muscleKey ? stats[muscleKey] : undefined
        const sets = muscleStats?.sets ?? 0
        const color = getHeatColor(sets)
        const isHovered = hovered === region.id

        return (
          <path
            key={region.id}
            d={region.path}
            fill={color}
            stroke={isHovered ? '#ffffff' : 'transparent'}
            strokeWidth={isHovered ? 1.5 : 0}
            style={{ cursor: 'pointer', transition: 'fill 0.2s, stroke 0.2s' }}
            onMouseEnter={() => onHover(region.id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onClick(region.id)}
          />
        )
      })}
    </svg>
  )
}

export default function BodyHeatmap() {
  const { source, version } = useDataVersion()
  const [allWorkouts, setAllWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [weeks, setWeeks] = useState(4)

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

  useEffect(() => {
    load()
  }, [load, version])

  if (loading) return <FullPageSpinner />
  if (error) return <ErrorBanner message={error} onRetry={load} />

  const muscleStats = computeMuscleHeatmapForPeriod(allWorkouts, weeks)
  const muscleFrequency = getWeeklyMuscleFrequency(allWorkouts, weeks)
  const muscleBalance = getMuscleBalance(allWorkouts, weeks)
  const neglectAlerts = getMuscleNeglectAlerts(allWorkouts, 7)
  const hasMuscleHealth =
    muscleFrequency.length > 0 ||
    neglectAlerts.length > 0 ||
    muscleBalance.pushSets + muscleBalance.pullSets + muscleBalance.lowerSets > 0

  const hoveredRegion = [...FRONT_REGIONS, ...BACK_REGIONS].find((r) => r.id === hovered)
  const hoveredMuscleKey = hovered ? REGION_TO_MUSCLE[hovered] : null
  const hoveredStats = hoveredMuscleKey ? muscleStats[hoveredMuscleKey] : undefined

  const selectedRegion = [...FRONT_REGIONS, ...BACK_REGIONS].find((r) => r.id === selected)
  const selectedMuscleKey = selected ? REGION_TO_MUSCLE[selected] : null
  const selectedStats = selectedMuscleKey ? muscleStats[selectedMuscleKey] : undefined

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Muscle Map</h1>
          <p className="text-sm mt-0.5" style={{ color: '#999' }}>
            Muscle activation based on training volume
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm" style={{ color: '#888' }}>Period:</span>
          {[1, 2, 4, 8, 12].map((w) => (
            <button
              key={w}
              onClick={() => setWeeks(w)}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors"
              style={{
                backgroundColor: weeks === w ? '#e86a2e' : '#252525',
                color: weeks === w ? '#fff' : '#888',
                border: `1px solid ${weeks === w ? '#e86a2e' : '#333'}`,
              }}
            >
              {w}w
            </button>
          ))}
        </div>
      </div>

      {/* Color scale legend */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs" style={{ color: '#666' }}>Sets:</span>
        {[
          { label: '0 sets', color: '#2a2a2a' },
          { label: '1–5 sets', color: '#4a3020' },
          { label: '6–10 sets', color: '#7a4a20' },
          { label: '11–20 sets', color: '#c86020' },
          { label: '21+ sets', color: '#e86a2e' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: color, border: '1px solid #333' }} />
            <span className="text-xs" style={{ color: '#777' }}>{label}</span>
          </div>
        ))}
      </div>

      {hasMuscleHealth && (
        <div
          className="rounded-lg p-5"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <h2 className="text-base font-semibold text-white mb-4">Muscle Health</h2>

          {muscleBalance.pushSets + muscleBalance.pullSets + muscleBalance.lowerSets > 0 &&
            (() => {
              const total = muscleBalance.pushSets + muscleBalance.pullSets + muscleBalance.lowerSets
              const pushPct = Math.round((muscleBalance.pushSets / total) * 100)
              const pullPct = Math.round((muscleBalance.pullSets / total) * 100)
              const lowerPct = 100 - pushPct - pullPct
              return (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-medium" style={{ color: '#888' }}>
                      Push / Pull / Lower balance ({weeks}w)
                    </p>
                    <AppTooltip text="Healthy ratio: roughly even push and pull work, with enough lower-body sets. This helps beginners avoid obvious gaps.">
                      <span className="text-xs cursor-default" style={{ color: '#555' }}>ⓘ</span>
                    </AppTooltip>
                  </div>
                  <div className="flex rounded-full overflow-hidden h-4" style={{ backgroundColor: '#252525' }}>
                    {pushPct > 0 && (
                      <div className="h-full flex items-center justify-center text-xs font-medium" style={{ width: `${pushPct}%`, backgroundColor: '#e86a2e' }}>
                        {pushPct > 15 ? `Push ${muscleBalance.pushSets}` : ''}
                      </div>
                    )}
                    {pullPct > 0 && (
                      <div className="h-full flex items-center justify-center text-xs font-medium" style={{ width: `${pullPct}%`, backgroundColor: '#60a5fa' }}>
                        {pullPct > 15 ? `Pull ${muscleBalance.pullSets}` : ''}
                      </div>
                    )}
                    {lowerPct > 0 && (
                      <div className="h-full flex items-center justify-center text-xs font-medium" style={{ width: `${lowerPct}%`, backgroundColor: '#4ade80' }}>
                        {lowerPct > 15 ? `Lower ${muscleBalance.lowerSets}` : ''}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 mt-1.5 flex-wrap">
                    <span className="text-xs" style={{ color: '#e86a2e' }}>Push {muscleBalance.pushSets} sets</span>
                    <span className="text-xs" style={{ color: '#60a5fa' }}>Pull {muscleBalance.pullSets} sets</span>
                    <span className="text-xs" style={{ color: '#4ade80' }}>Lower {muscleBalance.lowerSets} sets</span>
                  </div>
                  {muscleBalance.warning && (
                    <p className="text-xs mt-2" style={{ color: '#e86a2e' }}>{muscleBalance.warning}</p>
                  )}
                </div>
              )
            })()}

          {neglectAlerts.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-medium mb-2" style={{ color: '#888' }}>Overdue</p>
              <div className="space-y-1.5">
                {neglectAlerts.slice(0, 3).map((alert) => (
                  <div key={alert.muscle} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-white font-medium">{alert.muscle}</span>
                    <span style={{ color: alert.daysSince > 14 ? '#f87171' : '#facc15' }}>
                      {alert.daysSince}d since last trained
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {muscleFrequency.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-medium" style={{ color: '#888' }}>
                  Frequency by muscle
                </p>
                <AppTooltip text="Average sets per week in the selected period. The bar fills toward each muscle's upper target.">
                  <span className="text-xs cursor-default" style={{ color: '#555' }}>ⓘ</span>
                </AppTooltip>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {[...muscleFrequency].sort((a, b) => {
                  const ai = MUSCLE_ORDER.indexOf(a.muscle)
                  const bi = MUSCLE_ORDER.indexOf(b.muscle)
                  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
                }).map((mf) => {
                  const target = MUSCLE_TARGETS[mf.muscle] ?? { mev: 6, mav: 16 }
                  const category = MUSCLE_CATEGORY[mf.muscle] ?? ''
                  const note = MUSCLE_TARGET_NOTE[mf.muscle]
                  const fillPct = Math.min(100, Math.round((mf.avgSetsPerWeek / target.mav) * 100))
                  const color =
                    mf.avgSetsPerWeek >= target.mev
                      ? '#4ade80'
                      : mf.avgSetsPerWeek >= target.mev * 0.5
                      ? '#facc15'
                      : '#f87171'
                  const card = (
                    <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: '#252525', border: '1px solid #333' }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-medium text-white capitalize">{mf.muscle}</p>
                        {category && <span className="text-xs capitalize" style={{ color: '#555' }}>{category}</span>}
                      </div>
                      <p className="text-xs font-medium" style={{ color }}>
                        {mf.avgSetsPerWeek} sets/wk
                        <span style={{ color: '#555', fontWeight: 400 }}> / {target.mev}-{target.mav}</span>
                      </p>
                      <div className="mt-1.5 rounded-full h-1" style={{ backgroundColor: '#444' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${fillPct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  )
                  return note ? (
                    <AppTooltip key={mf.muscle} text={note}>
                      {card}
                    </AppTooltip>
                  ) : card
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {neglectAlerts.length > 0 && (
        <div
          className="rounded-lg p-4"
          style={{ backgroundColor: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.25)' }}
        >
          <p className="text-xs uppercase tracking-wider" style={{ color: '#facc15' }}>Train soon</p>
          <p className="text-sm mt-1" style={{ color: '#ddd' }}>
            {neglectAlerts.slice(0, 3).map((a) => a.muscle).join(', ')} {neglectAlerts.length === 1 ? 'has' : 'have'} had the longest break.
          </p>
        </div>
      )}

      {/* Body diagrams */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Front */}
        <div
          className="rounded-lg p-4"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <p className="text-xs uppercase tracking-wider text-center mb-3" style={{ color: '#555' }}>
            Front
          </p>
          <BodySVG
            regions={FRONT_REGIONS}
            stats={muscleStats}
            hovered={hovered}
            onHover={setHovered}
            onClick={setSelected}
          />
        </div>

        {/* Back */}
        <div
          className="rounded-lg p-4"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <p className="text-xs uppercase tracking-wider text-center mb-3" style={{ color: '#555' }}>
            Back
          </p>
          <BodySVG
            regions={BACK_REGIONS}
            stats={muscleStats}
            hovered={hovered}
            onHover={setHovered}
            onClick={setSelected}
          />
        </div>
      </div>

      {/* Hover info panel — always rendered, no layout reflow */}
      <div
        className="rounded-lg p-4 transition-opacity"
        style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #2a2a2a',
          opacity: 1,
          pointerEvents: 'auto',
          minHeight: 80,
        }}
      >
        {hoveredRegion && hoveredStats ? (
          <div className="flex gap-8 flex-wrap">
            <div>
              <h3 className="font-semibold text-white mb-1">{hoveredRegion.label}</h3>
              <div className="flex gap-6 mt-2 text-sm">
                <div>
                  <span style={{ color: '#888' }}>Sets ({weeks}w) </span>
                  <span className="font-semibold" style={{ color: '#e86a2e' }}>{hoveredStats.sets}</span>
                </div>
                <div>
                  <span style={{ color: '#888' }}>Last worked </span>
                  <span className="font-medium" style={{ color: daysAgoColor(hoveredStats.lastWorked) }}>
                    {daysAgoLabel(hoveredStats.lastWorked)}
                  </span>
                  <span className="ml-1 text-xs" style={{ color: '#666' }}>
                    ({format(parseISO(hoveredStats.lastWorked), 'MMM d')})
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#555' }}>Exercises</p>
              <div className="flex flex-wrap gap-1.5">
                {hoveredStats.exercises.slice(0, 8).map((ex) => (
                  <span key={ex} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#252525', color: '#bbb', border: '1px solid #333' }}>
                    {ex}
                  </span>
                ))}
                {hoveredStats.exercises.length > 8 && (
                  <span className="text-xs px-2 py-0.5" style={{ color: '#555' }}>
                    +{hoveredStats.exercises.length - 8} more
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: '#666' }}>Tap or hover over a muscle group to see what trained it.</p>
        )}
      </div>

      {/* Selected muscle panel */}
      {selectedRegion && (
        <div
          className="rounded-lg p-5"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">
              {selectedRegion.label}
              {selectedStats && (
                <span className="ml-2 text-sm font-normal" style={{ color: '#888' }}>
                  — {selectedStats.sets} sets in last {weeks} weeks
                </span>
              )}
            </h2>
            <button
              onClick={() => setSelected(null)}
              className="text-gray-500 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {!selectedStats ? (
            <p className="text-sm" style={{ color: '#666' }}>
              No training data for this muscle in the selected period.
            </p>
          ) : (
            <div>
              <div className="flex gap-6 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-wider" style={{ color: '#555' }}>Sets</p>
                  <p className="text-xl font-bold" style={{ color: '#e86a2e' }}>{selectedStats.sets}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider" style={{ color: '#555' }}>Last worked</p>
                  <p className="text-xl font-bold" style={{ color: daysAgoColor(selectedStats.lastWorked) }}>
                    {daysAgoLabel(selectedStats.lastWorked)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#666' }}>
                    {format(parseISO(selectedStats.lastWorked), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#555' }}>
                  Exercises ({selectedStats.exercises.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedStats.exercises.map((ex) => (
                    <span
                      key={ex}
                      className="text-xs px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: '#252525',
                        color: '#ccc',
                        border: '1px solid #333',
                      }}
                    >
                      {ex}
                    </span>
                  ))}
                </div>
              </div>

              {selectedMuscleKey && MUSCLE_TARGETS[selectedMuscleKey] && (() => {
                const target = MUSCLE_TARGETS[selectedMuscleKey]
                const freqEntry = muscleFrequency.find((f) => f.muscle === selectedMuscleKey)
                const setsPerWeek = freqEntry ? freqEntry.avgSetsPerWeek : Math.round(selectedStats.sets / weeks)
                const fillPct = Math.min(100, Math.round((setsPerWeek / target.mav) * 100))
                return (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid #252525' }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs uppercase tracking-wider" style={{ color: '#555' }}>
                        Volume vs target
                      </p>
                      <p className="text-xs" style={{ color: '#888' }}>
                        {setsPerWeek} sets/wk
                        {freqEntry && <span className="ml-2" style={{ color: '#666' }}>{freqEntry.sessionsPerWeek}x/wk</span>}
                      </p>
                    </div>
                    <p className="text-xs mb-2" style={{ color: '#666' }}>
                      <AppTooltip text="MEV = Minimum Effective Volume: the least sets needed to maintain muscle. MAV = Maximum Adaptive Volume: the most sets you can recover from and still grow. Train somewhere in between for best results.">
                        <span style={{ borderBottom: '1px dashed #555', cursor: 'help' }}>Recommended range</span>
                      </AppTooltip>
                      : {target.mev}–{target.mav} sets/week
                    </p>
                    <div className="rounded-full overflow-hidden h-2" style={{ backgroundColor: '#2a2a2a' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${fillPct}%`, backgroundColor: '#e86a2e' }}
                      />
                    </div>
                    <p className="text-xs mt-1 text-right" style={{ color: '#666' }}>{fillPct}% of max target</p>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
