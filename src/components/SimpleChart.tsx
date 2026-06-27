interface ChartPoint {
  label: string
  value: number
}

interface SimpleChartProps {
  data: ChartPoint[]
  kind?: 'line' | 'bar'
  height?: number
  yMin?: number
  yMax?: number
  color?: string
  average?: number | null
  formatLabel?: (label: string) => string
  formatValue?: (value: number) => string
}

export default function SimpleChart({
  data,
  kind = 'line',
  height = 180,
  yMin,
  yMax,
  color = '#e86a2e',
  average = null,
  formatLabel = (label) => label,
  formatValue = (value) => String(Math.round(value)),
}: SimpleChartProps) {
  const width = 720
  const pad = { top: 12, right: 16, bottom: 30, left: 42 }
  const chartWidth = width - pad.left - pad.right
  const chartHeight = height - pad.top - pad.bottom
  const values = data.map((point) => point.value)
  const min = yMin ?? Math.min(...values, average ?? Infinity)
  const max = yMax ?? Math.max(...values, average ?? -Infinity)
  const span = Math.max(1, max - min)
  const x = (index: number) =>
    data.length === 1 ? pad.left + chartWidth / 2 : pad.left + (index / (data.length - 1)) * chartWidth
  const y = (value: number) => pad.top + chartHeight - ((value - min) / span) * chartHeight
  const points = data.map((point, index) => `${x(index)},${y(point.value)}`).join(' ')
  const ticks = [0, 0.5, 1].map((share) => min + span * share)
  const labelStep = Math.max(1, Math.ceil(data.length / 5))

  if (!data.length) return null

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="block w-full" role="img">
      {ticks.map((tick) => {
        const tickY = y(tick)
        return (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={tickY} y2={tickY} stroke="#2a2a2a" strokeDasharray="3 3" />
            <text x={pad.left - 8} y={tickY + 4} textAnchor="end" fontSize="10" fill="#666">
              {formatValue(tick)}
            </text>
          </g>
        )
      })}

      {average !== null && (
        <>
          <line x1={pad.left} x2={width - pad.right} y1={y(average)} y2={y(average)} stroke="#444" strokeDasharray="4 4" />
          <text x={width - pad.right} y={Math.max(12, y(average) - 5)} textAnchor="end" fontSize="10" fill="#666">
            avg {formatValue(average)}
          </text>
        </>
      )}

      {kind === 'bar' ? (
        data.map((point, index) => {
          const step = chartWidth / Math.max(1, data.length)
          const barWidth = Math.max(3, step * 0.58)
          const barX = pad.left + index * step + (step - barWidth) / 2
          const barY = y(point.value)
          return (
            <rect key={point.label} x={barX} y={barY} width={barWidth} height={height - pad.bottom - barY} rx="3" fill={color}>
              <title>{`${formatLabel(point.label)}: ${formatValue(point.value)}`}</title>
            </rect>
          )
        })
      ) : (
        <>
          <polyline fill="none" stroke={color} strokeWidth="2.5" points={points} />
          {data.length <= 80 &&
            data.map((point, index) => (
              <circle key={point.label} cx={x(index)} cy={y(point.value)} r="3" fill={color}>
                <title>{`${formatLabel(point.label)}: ${formatValue(point.value)}`}</title>
              </circle>
            ))}
        </>
      )}

      {data.map((point, index) => {
        if (index !== 0 && index !== data.length - 1 && index % labelStep !== 0) return null
        return (
          <text key={point.label} x={x(index)} y={height - 8} textAnchor="middle" fontSize="10" fill="#666">
            {formatLabel(point.label)}
          </text>
        )
      })}
    </svg>
  )
}
