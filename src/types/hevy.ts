import type { BodyweightEntry, Workout } from './workout'

export type {
  BodyweightEntry,
  MuscleGroupStats,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from './workout'

export interface WorkoutsResponse {
  workouts: Workout[]
  page: number
  page_count: number
}

export interface BodyweightResponse {
  body_measurements: BodyweightEntry[]
  page: number
  page_count: number
}
