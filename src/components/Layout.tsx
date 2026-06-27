import { useState, useEffect, useCallback } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { DATA_SOURCE_LABELS, fetchAllWorkouts, getLastFetchTime, type DataSource } from '../api/dataSource'
import type { Workout } from '../types/workout'
import GlobalSearch from './GlobalSearch'
import { useDataVersion } from '../context/DataVersion'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

function BarChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  )
}

function DumbbellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5h11M6.5 17.5h11M3 9.5v5M21 9.5v5M6 6.5v11M18 6.5v11" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function BodyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="2" />
      <path d="M12 6v6l-3 4M12 12l3 4M9 10H6M18 10h-3" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: <BarChartIcon /> },
  { to: '/workouts', label: 'Workouts', icon: <DumbbellIcon /> },
  { to: '/exercises', label: 'Exercises', icon: <ListIcon /> },
  { to: '/body-heatmap', label: 'Muscle Map', icon: <BodyIcon /> },
  { to: '/bodyweight', label: 'Bodyweight', icon: <UserIcon /> },
]

function formatMinutesAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins === 1) return '1 min ago'
  return `${mins} min ago`
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export default function Layout() {
  const { source, setSource, version, refresh } = useDataVersion()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [lastFetchLabel, setLastFetchLabel] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadWorkouts = useCallback(async () => {
    try {
      const data = await fetchAllWorkouts(source)
      setWorkouts(data)
    } catch {
      // silently ignore
    }
  }, [source])

  async function handleRefresh() {
    setRefreshing(true)
    refresh()
    // brief visual feedback before the page re-fetches
    setTimeout(() => setRefreshing(false), 800)
  }

  useEffect(() => {
    loadWorkouts()
  }, [loadWorkouts, version])

  // Refresh the "Updated X min ago" label every 60s
  useEffect(() => {
    function updateLabel() {
      const t = getLastFetchTime(source)
      setLastFetchLabel(t ? formatMinutesAgo(t) : null)
    }
    updateLabel()
    const id = setInterval(updateLabel, 60000)
    return () => clearInterval(id)
  }, [source])

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#0f0f0f' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Global Search modal */}
      {searchOpen && (
        <GlobalSearch workouts={workouts} onClose={() => setSearchOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cx(
          'fixed left-0 top-0 z-30 h-full w-60 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ backgroundColor: '#111111', borderRight: '1px solid #222' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5">
          <span className="text-xl font-bold tracking-tight" style={{ color: '#e86a2e' }}>
            LiftLog
          </span>
          <button
            className="lg:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'text-white border-l-2 pl-[10px]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent pl-[10px]',
                )
              }
              style={({ isActive }) =>
                isActive
                  ? { borderLeftColor: '#e86a2e', backgroundColor: 'rgba(232,106,46,0.1)' }
                  : {}
              }
            >
              <span className="shrink-0">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Search button */}
        <div className="px-3 pb-3">
          <div
            className="grid grid-cols-2 gap-1 rounded-lg p-1"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            {(['hevy', 'liftosaur'] as DataSource[]).map((item) => (
              <button
                key={item}
                onClick={() => setSource(item)}
                className="rounded-md px-2 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: source === item ? '#e86a2e' : 'transparent',
                  color: source === item ? '#fff' : '#888',
                }}
              >
                {DATA_SOURCE_LABELS[item]}
              </button>
            ))}
          </div>
        </div>

        {/* Search button */}
        <div className="px-3 pb-3">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: '#666' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#aaa' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#666' }}
          >
            <SearchIcon />
            <span>Search</span>
            <span className="ml-auto text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#252525', color: '#555', border: '1px solid #333' }}>⌘K</span>
          </button>
        </div>

        {/* Refresh button */}
        <div className="px-3 pb-4 pt-3" style={{ borderTop: '1px solid #222' }}>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: refreshing ? '#555' : '#888' }}
            onMouseEnter={(e) => { if (!refreshing) { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#ccc' } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = refreshing ? '#555' : '#888' }}
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className={cx('shrink-0', refreshing && 'animate-spin')}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{refreshing ? 'Refreshing…' : 'Refresh data'}</span>
            {lastFetchLabel && !refreshing && (
              <span className="ml-auto text-xs" style={{ color: '#555' }}>{lastFetchLabel}</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header
          className="lg:hidden sticky top-0 z-10"
          style={{ backgroundColor: '#111111', borderBottom: '1px solid #222' }}
        >
          <div className="flex items-center px-4 py-3">
            <button
              className="text-gray-400 hover:text-white mr-4"
              onClick={() => setSidebarOpen(true)}
            >
              <MenuIcon />
            </button>
            <span className="text-lg font-bold flex-1" style={{ color: '#e86a2e' }}>
              LiftLog
            </span>
            <button
              className="text-gray-400 hover:text-white"
              onClick={() => setSearchOpen(true)}
            >
              <SearchIcon />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1 px-4 pb-3">
            {(['hevy', 'liftosaur'] as DataSource[]).map((item) => (
              <button
                key={item}
                onClick={() => setSource(item)}
                className="rounded-md px-2 py-2 text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: source === item ? '#e86a2e' : '#1a1a1a',
                  color: source === item ? '#fff' : '#888',
                  border: '1px solid #2a2a2a',
                }}
              >
                {DATA_SOURCE_LABELS[item]}
              </button>
            ))}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
