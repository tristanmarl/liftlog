import type {
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutsResponse,
  BodyweightEntry,
  BodyweightResponse,
} from '../types/hevy'

const BASE_URL = 'https://api.hevyapp.com'
const PAGE_SIZE = 10

// Keys persisted to sessionStorage so data survives page reloads within the same tab.
const SESSION_KEYS = new Set(['__all_workouts__', '__all_bodyweights__'])
const SESSION_PREFIX = 'hevylog:'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<unknown>>()

interface WorkoutRequestSet {
  type: string
  weight_kg: number | null
  reps: number | null
  distance_meters: number | null
  duration_seconds: number | null
  rpe: number | null
}

interface WorkoutRequestExercise {
  exercise_template_id: string
  superset_id: string | number | null
  notes: string | null
  sets: WorkoutRequestSet[]
}

interface WorkoutRequestBody {
  workout: {
    title: string
    description: string | null
    start_time: string
    end_time: string
    exercises: WorkoutRequestExercise[]
  }
}

// Warm in-memory cache from sessionStorage on module load.
;(function warmCache() {
  for (const key of SESSION_KEYS) {
    try {
      const raw = sessionStorage.getItem(SESSION_PREFIX + key)
      if (raw) cache.set(key, { data: JSON.parse(raw) as unknown, timestamp: Date.now() })
    } catch { /* ignore parse / quota errors */ }
  }
})()

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined
  return entry ? entry.data : null
}

function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
  if (SESSION_KEYS.has(key)) {
    try { sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify(data)) } catch { /* storage full */ }
  }
}

async function apiFetch<T>(path: string): Promise<T> {
  const apiKey = import.meta.env.VITE_HEVY_API_KEY as string
  if (!apiKey) {
    throw new Error('VITE_HEVY_API_KEY is not set. Create a .env file with your Hevy API key.')
  }

  const cached = getCached<T>(path)
  if (cached !== null) return cached

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Hevy API error: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as T
  setCached(path, data)
  return data
}

async function apiMutation<T>(path: string, method: 'PUT' | 'POST', body: unknown): Promise<T> {
  const apiKey = import.meta.env.VITE_HEVY_API_KEY as string
  if (!apiKey) {
    throw new Error('VITE_HEVY_API_KEY is not set. Create a .env file with your Hevy API key.')
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const data = (await response.json()) as { error?: string }
      if (data.error) detail = `${detail}: ${data.error}`
    } catch { /* ignore invalid error JSON */ }
    throw new Error(`Hevy API error: ${detail}`)
  }

  return (await response.json()) as T
}

function toWorkoutRequest(workout: Workout): WorkoutRequestBody {
  return {
    workout: {
      title: workout.title,
      description: workout.description || null,
      start_time: workout.start_time,
      end_time: workout.end_time,
      exercises: workout.exercises.map((exercise: WorkoutExercise) => ({
        exercise_template_id: exercise.exercise_template_id,
        superset_id: exercise.superset_id ?? null,
        notes: exercise.notes || null,
        sets: exercise.sets.map((set: WorkoutSet) => ({
          type: set.type,
          weight_kg: set.weight_kg,
          reps: set.reps,
          distance_meters: set.distance_meters,
          duration_seconds: set.duration_seconds,
          rpe: set.rpe,
        })),
      })),
    },
  }
}

async function fetchAllPages<TItem>(
  basePath: string,
  extractItems: (data: unknown) => TItem[],
  getPageCount: (data: unknown) => number,
): Promise<TItem[]> {
  const firstPage = await apiFetch<unknown>(`${basePath}?page=1&pageSize=${PAGE_SIZE}`)
  const pageCount = getPageCount(firstPage)
  const allItems: TItem[] = [...extractItems(firstPage)]

  const remainingPages = Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) => i + 2)
  await Promise.all(
    remainingPages.map(async (page) => {
      const data = await apiFetch<unknown>(`${basePath}?page=${page}&pageSize=${PAGE_SIZE}`)
      allItems.push(...extractItems(data))
    }),
  )

  return allItems
}

export async function fetchAllWorkouts(): Promise<Workout[]> {
  const cacheKey = '__all_workouts__'
  const cached = getCached<Workout[]>(cacheKey)
  if (cached !== null) return cached

  const workouts = await fetchAllPages<Workout>(
    '/v1/workouts',
    (data) => (data as WorkoutsResponse).workouts ?? [],
    (data) => (data as WorkoutsResponse).page_count ?? 1,
  )

  workouts.sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
  )

  setCached(cacheKey, workouts)
  return workouts
}

export async function fetchWorkout(id: string): Promise<Workout> {
  return apiFetch<Workout>(`/v1/workouts/${id}`)
}

export async function updateWorkout(workout: Workout): Promise<Workout> {
  const updated = await apiMutation<Workout>(
    `/v1/workouts/${workout.id}`,
    'PUT',
    toWorkoutRequest(workout),
  )
  cache.delete('__all_workouts__')
  sessionStorage.removeItem(SESSION_PREFIX + '__all_workouts__')
  setCached(`/v1/workouts/${updated.id}`, updated)
  return updated
}

export async function fetchBodyweightEntries(): Promise<BodyweightEntry[]> {
  const cacheKey = '__all_bodyweights__'
  const cached = getCached<BodyweightEntry[]>(cacheKey)
  if (cached !== null) return cached

  const entries = await fetchAllPages<BodyweightEntry>(
    '/v1/body_measurements',
    (data) => (data as BodyweightResponse).body_measurements ?? [],
    (data) => (data as BodyweightResponse).page_count ?? 1,
  )

  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  setCached(cacheKey, entries)
  return entries
}

export function clearCache(): void {
  cache.clear()
  SESSION_KEYS.forEach((key) => sessionStorage.removeItem(SESSION_PREFIX + key))
}

export function getLastFetchTime(): Date | null {
  if (cache.size === 0) return null
  const timestamps = Array.from(cache.values()).map((e) => e.timestamp)
  return new Date(Math.max(...timestamps))
}
