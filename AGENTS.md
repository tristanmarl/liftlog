# Agent Guide

LiftLog is a local-first fitness dashboard for Hevy and Liftosaur workout history. Keep it easy to run, easy to inspect, and safe to publish without personal workout data.

## Commands

- `npm run dev`: start Vite at `http://localhost:5173`.
- `npm run build`: type-check and build.
- `npm run lint`: run ESLint.
- `npm run preview`: preview the production build.
- `npm run sync:liftosaur`: write `public/liftosaur-history.json` from the Liftosaur API.

## Data Safety

- Never commit `.env`, `public/liftosaur-history.json`, raw workout exports, `dist/`, screenshots with personal data, or other user-specific workout data.
- Use `.env.example` for public configuration examples.
- Run `git status --short --ignored` before publishing.

## Architecture Notes

- `src/api/dataSource.ts` is the data-source switchboard.
- `src/api/hevy.ts` handles Hevy API calls and cache.
- `src/api/liftosaur.ts` handles Liftosaur live/history parsing and is read-only.
- `src/utils/stats.ts` owns workout analytics.
- `src/utils/muscles.ts` owns muscle inference.
- `src/utils/date.ts` replaces a date library with only the formats this app needs.
- `src/components/SimpleChart.tsx` replaces a chart library with small SVG charts.

## Dependency Rules

- Keep runtime dependencies small. Current runtime dependencies are React, React DOM, and React Router.
- Do not re-add chart, date, or class-name helper libraries unless the local helpers clearly fail.
- Prefer native browser features, local helpers, and small focused code over new packages.

## Validation

Before finishing code changes:

1. Run `npm run build`.
2. Run `npm run lint`.
3. Inspect `git status --short --ignored`.
4. Mention any residual limitation.
