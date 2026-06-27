import { useEffect, useState, useCallback } from 'react'
import { useDataVersion } from '../context/DataVersion'
import { format, parseISO, subDays, differenceInDays } from '../utils/date'
import { DATA_SOURCE_LABELS, fetchBodyweightEntries } from '../api/dataSource'
import type { BodyweightEntry } from '../types/workout'
import StatCard from '../components/StatCard'
import { FullPageSpinner } from '../components/Spinner'
import ErrorBanner from '../components/ErrorBanner'
import SimpleChart from '../components/SimpleChart'

type Unit = 'kg' | 'lbs'

function toDisplay(kg: number, unit: Unit): number {
  if (unit === 'lbs') return Math.round(kg * 2.20462 * 10) / 10
  return Math.round(kg * 10) / 10
}

function unitLabel(unit: Unit): string {
  return unit
}

export default function Bodyweight() {
  const { source, version } = useDataVersion()
  const [entries, setEntries] = useState<BodyweightEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unit, setUnit] = useState<Unit>('kg')
  const [range, setRange] = useState<30 | 90 | 180 | 365 | 'all'>(90)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchBodyweightEntries(source)
      setEntries(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bodyweight data')
    } finally {
      setLoading(false)
    }
  }, [source])

  useEffect(() => {
    load()
  }, [load, version])

  if (loading) return <FullPageSpinner />
  if (error) return <ErrorBanner message={error} onRetry={load} />

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" style={{ color: '#555' }}>
        <div className="text-center">
          <p className="text-lg">No bodyweight data found</p>
          <p className="text-sm mt-1">
            {source === 'hevy'
              ? 'Log your weight in the Hevy app to see it here.'
              : `${DATA_SOURCE_LABELS[source]} bodyweight entries are not included in the workout history sync yet.`}
          </p>
        </div>
      </div>
    )
  }

  // Filter by range
  const filteredEntries: BodyweightEntry[] =
    range === 'all'
      ? entries
      : entries.filter((e) => {
          const daysAgo = differenceInDays(new Date(), parseISO(e.date))
          return daysAgo <= range
        })

  const chartData = filteredEntries.map((e) => ({
    date: e.date,
    weight: toDisplay(e.weight_kg, unit),
  }))

  const current = entries[entries.length - 1]
  const starting = entries[0]
  const totalChange = current.weight_kg - starting.weight_kg

  // 30-day trend
  const cutoff30 = subDays(new Date(), 30)
  const last30 = entries.filter((e) => parseISO(e.date) >= cutoff30)
  let trend30: number | null = null
  if (last30.length >= 2) {
    trend30 = last30[last30.length - 1].weight_kg - last30[0].weight_kg
  }

  const minWeight = Math.min(...chartData.map((d) => d.weight))
  const maxWeight = Math.max(...chartData.map((d) => d.weight))
  const padding = (maxWeight - minWeight) * 0.1 || 1
  const yMin = Math.floor(minWeight - padding)
  const yMax = Math.ceil(maxWeight + padding)

  const avgWeight =
    filteredEntries.length > 0
      ? toDisplay(
          filteredEntries.reduce((s, e) => s + e.weight_kg, 0) / filteredEntries.length,
          unit,
        )
      : null

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Bodyweight</h1>
          <p className="text-sm mt-0.5" style={{ color: '#999' }}>
            {entries.length} measurements logged
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Unit toggle */}
          <div
            className="flex items-center rounded-lg overflow-hidden"
            style={{ border: '1px solid #333', backgroundColor: '#1a1a1a' }}
          >
            {(['kg', 'lbs'] as Unit[]).map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className="px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: unit === u ? '#e86a2e' : 'transparent',
                  color: unit === u ? '#fff' : '#888',
                }}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Current Weight"
          value={`${toDisplay(current.weight_kg, unit)} ${unitLabel(unit)}`}
          subtitle={format(parseISO(current.date), 'MMM d, yyyy')}
        />
        <StatCard
          title="Starting Weight"
          value={`${toDisplay(starting.weight_kg, unit)} ${unitLabel(unit)}`}
          subtitle={format(parseISO(starting.date), 'MMM d, yyyy')}
        />
        <StatCard
          title="Total Change"
          value={`${totalChange >= 0 ? '+' : ''}${toDisplay(totalChange, unit)} ${unitLabel(unit)}`}
          subtitle="all time"
        />
        <StatCard
          title="30-day Trend"
          value={
            trend30 !== null
              ? `${trend30 >= 0 ? '+' : ''}${toDisplay(trend30, unit)} ${unitLabel(unit)}`
              : '—'
          }
          subtitle="last 30 days"
        />
      </div>

      {/* Chart */}
      <div
        className="rounded-lg p-5"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-base font-semibold text-white">
            Weight over time ({unitLabel(unit)})
          </h2>
          <div className="flex items-center gap-1">
            {([30, 90, 180, 365, 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                style={{
                  backgroundColor: range === r ? '#e86a2e' : '#252525',
                  color: range === r ? '#fff' : '#888',
                  border: `1px solid ${range === r ? '#e86a2e' : '#333'}`,
                }}
              >
                {r === 'all' ? 'All' : `${r}d`}
              </button>
            ))}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-48" style={{ color: '#555' }}>
            No data in this range
          </div>
        ) : (
          <SimpleChart
            data={chartData.map((point) => ({ label: point.date, value: point.weight }))}
            height={280}
            yMin={yMin}
            yMax={yMax}
            average={avgWeight}
            formatLabel={(date) => format(parseISO(date), 'MMM d')}
            formatValue={(value) => `${Math.round(value * 10) / 10} ${unit}`}
          />
        )}
      </div>

      {/* Recent entries table */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
      >
        <div
          className="px-5 py-3 text-sm font-semibold text-white"
          style={{ borderBottom: '1px solid #252525' }}
        >
          Recent measurements
        </div>
        <div>
          {[...entries]
            .reverse()
            .slice(0, 20)
            .map((entry) => (
              <div
                key={entry.date}
                className="flex items-center justify-between px-5 py-3 text-sm"
                style={{ borderBottom: '1px solid #1e1e1e' }}
              >
                <span style={{ color: '#aaa' }}>
                  {format(parseISO(entry.date), 'EEE, MMM d yyyy')}
                </span>
                <span className="font-medium text-white">
                  {toDisplay(entry.weight_kg, unit)} {unitLabel(unit)}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
