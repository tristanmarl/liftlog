import Tooltip from './Tooltip'

type TrendDirection = 'up' | 'down' | 'neutral'

interface StatCardProps {
  title: string
  hint?: string
  value: string | number
  note?: string
  subtitle?: string
  trend?: TrendDirection
  trendValue?: string
  secondaryLabel?: string
  className?: string
}

function TrendArrow({ direction, value }: { direction: TrendDirection; value?: string }) {
  if (direction === 'up') {
    return (
      <span className="flex items-center gap-1 text-sm font-medium" style={{ color: '#4ade80' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
        {value}
      </span>
    )
  }
  if (direction === 'down') {
    return (
      <span className="flex items-center gap-1 text-sm font-medium" style={{ color: '#f87171' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {value}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-sm font-medium" style={{ color: '#999' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      {value}
    </span>
  )
}

export default function StatCard({
  title,
  hint,
  value,
  note,
  subtitle,
  trend,
  trendValue,
  secondaryLabel,
  className,
}: StatCardProps) {
  return (
    <div
      className={['rounded-lg p-5 flex flex-col gap-1 h-full', className].filter(Boolean).join(' ')}
      style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
    >
      <p className="text-sm font-medium uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#999' }}>
        {title}
        {hint && (
          <Tooltip text={hint}>
            <span className="text-xs cursor-default" style={{ color: '#555' }}>ⓘ</span>
          </Tooltip>
        )}
      </p>
      <p className="text-3xl font-bold tracking-tight text-white mt-1">
        {value}
      </p>
      {note && (
        <p className="text-xs font-medium" style={{ color: '#e86a2e' }}>{note}</p>
      )}
      <div className="flex items-center justify-between mt-1">
        {subtitle && (
          <p className="text-sm" style={{ color: '#666' }}>
            {subtitle}
          </p>
        )}
        {trend && (
          <div className="flex flex-col items-end">
            <TrendArrow direction={trend} value={trendValue} />
            {secondaryLabel && (
              <span className="text-xs mt-0.5" style={{ color: '#555' }}>{secondaryLabel}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
