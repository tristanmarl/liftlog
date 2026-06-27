import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from '../utils/date'
import type { Workout } from '../types/workout'
import { getMuscleGroupsForExercise } from '../utils/muscles'
import MusclePill from './MusclePill'

interface WorkoutResult {
  type: 'workout'
  id: string
  title: string
  date: string
}

interface ExerciseResult {
  type: 'exercise'
  title: string
  muscles: string[]
}

type SearchResult = WorkoutResult | ExerciseResult

interface Props {
  workouts: Workout[]
  onClose: () => void
}

export default function GlobalSearch({ workouts, onClose }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const q = query.trim().toLowerCase()
  const { workoutResults, exerciseResults, allResults } = useMemo(() => {
    const exerciseMap = new Map<string, string[]>()
    for (const w of workouts) {
      for (const e of w.exercises) {
        if (!exerciseMap.has(e.title)) {
          exerciseMap.set(e.title, getMuscleGroupsForExercise(e.title, e.muscle_groups).filter((m) => m !== 'other'))
        }
      }
    }

    const workoutResults: WorkoutResult[] = q
      ? workouts
          .filter((w) => {
            const dateStr = format(parseISO(w.start_time), 'MMM d yyyy').toLowerCase()
            return w.title.toLowerCase().includes(q) || dateStr.includes(q)
          })
          .slice(0, 5)
          .map((w) => ({
            type: 'workout',
            id: w.id,
            title: w.title,
            date: format(parseISO(w.start_time), 'MMM d yyyy'),
          }))
      : []

    const exerciseResults: ExerciseResult[] = q
      ? Array.from(exerciseMap.entries())
          .filter(([title]) => title.toLowerCase().includes(q))
          .slice(0, 5)
          .map(([title, muscles]) => ({ type: 'exercise', title, muscles }))
      : []

    return {
      workoutResults,
      exerciseResults,
      allResults: [...workoutResults, ...exerciseResults] as SearchResult[],
    }
  }, [q, workouts])

  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (result.type === 'workout') {
        navigate(`/workouts/${result.id}`)
      } else {
        navigate(`/exercises?exercise=${encodeURIComponent(result.title)}`)
      }
      onClose()
    },
    [navigate, onClose],
  )

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, allResults.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        if (allResults[activeIndex]) {
          handleSelect(allResults[activeIndex])
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [allResults, activeIndex, handleSelect, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-xl overflow-hidden"
        style={{
          maxWidth: 560,
          backgroundColor: '#1a1a1a',
          border: '1px solid #2a2a2a',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center px-4 py-3" style={{ borderBottom: '1px solid #2a2a2a' }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 mr-3"
            style={{ color: '#555' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workouts, exercises..."
            className="flex-1 text-base text-white outline-none"
            style={{ backgroundColor: 'transparent', border: 'none' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ color: '#555' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Results */}
        {q && (
          <div className="max-h-96 overflow-y-auto">
            {workoutResults.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs uppercase tracking-wider font-medium" style={{ color: '#555' }}>
                  Workouts
                </div>
                {workoutResults.map((r, i) => (
                  <button
                    key={r.id}
                    className="w-full text-left px-4 py-3 flex items-center justify-between gap-4 transition-colors"
                    style={{
                      backgroundColor: activeIndex === i ? '#252525' : 'transparent',
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => handleSelect(r)}
                  >
                    <span className="text-sm font-medium text-white truncate">{r.title}</span>
                    <span className="text-xs shrink-0" style={{ color: '#666' }}>{r.date}</span>
                  </button>
                ))}
              </div>
            )}

            {exerciseResults.length > 0 && (
              <div>
                <div
                  className="px-4 py-2 text-xs uppercase tracking-wider font-medium"
                  style={{ color: '#555', borderTop: workoutResults.length > 0 ? '1px solid #252525' : 'none' }}
                >
                  Exercises
                </div>
                {exerciseResults.map((r, i) => {
                  const idx = workoutResults.length + i
                  return (
                    <button
                      key={r.title}
                      className="w-full text-left px-4 py-3 flex items-center justify-between gap-4 transition-colors"
                      style={{
                        backgroundColor: activeIndex === idx ? '#252525' : 'transparent',
                      }}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => handleSelect(r)}
                    >
                      <span className="text-sm font-medium text-white truncate">{r.title}</span>
                      <div className="flex gap-1 shrink-0">
                        {r.muscles.slice(0, 2).map((m) => (
                          <MusclePill key={m} muscle={m} small />
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {workoutResults.length === 0 && exerciseResults.length === 0 && (
              <div className="px-4 py-8 text-center text-sm" style={{ color: '#555' }}>
                No results for "{query}"
              </div>
            )}
          </div>
        )}

        {!q && (
          <div className="px-4 py-6 text-center text-sm" style={{ color: '#555' }}>
            Type to search workouts and exercises
          </div>
        )}

        {/* Footer hint */}
        <div
          className="px-4 py-2 flex items-center gap-4 text-xs"
          style={{ color: '#444', borderTop: '1px solid #1e1e1e' }}
        >
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
