# LiftLog

Personal fitness dashboard that visualises your [Hevy](https://hevy.com) or [Liftosaur](https://www.liftosaur.com) workout history. Built with React, TypeScript, Vite, Tailwind, and small native SVG charts.

## Features

- **Dashboard** — weekly/monthly/yearly stats, progressive overload suggestions, PRs with estimated 1RM, muscle health, consistency, and weekly goal progress
- **Workouts** — calendar view with per-day workout cards
- **Exercises** — searchable list with per-exercise weight progression charts and plateau detection
- **Body Heatmap** — visual muscle group breakdown over configurable time windows
- **Bodyweight** — weight tracking chart
- **Data sources** — switch between Hevy API data and Liftosaur history in the sidebar

## Setup

```bash
npm install
```

Create `.env` from the example:

```bash
cp .env.example .env
```

Add your keys to `.env`:

```
VITE_HEVY_API_KEY=your-api-key-here
VITE_LIFTOSAUR_API_TOKEN=your-liftosaur-token-here
```

Get your API key from [app.hevyapp.com/settings/api](https://app.hevyapp.com/settings/api).

For Liftosaur, set `VITE_LIFTOSAUR_API_TOKEN` — the app fetches history live via a Vite proxy. Alternatively, sync to a local file:

```bash
npm run sync:liftosaur   # writes public/liftosaur-history.json (git-ignored)
```

The source switcher in the sidebar lets you toggle between Hevy and Liftosaur at any time.

```bash
npm run dev
```

Open `http://localhost:5173`.

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Import this repo on Vercel.
2. Add `VITE_HEVY_API_KEY` as an environment variable.
3. Optional: add `VITE_LIFTOSAUR_API_TOKEN` for live Liftosaur history.
4. Framework preset: **Vite** — no other config needed.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint |

## Architecture

- `src/api/dataSource.ts` dispatches between Hevy and Liftosaur.
- `src/api/hevy.ts` talks to the Hevy REST API and caches workouts/bodyweight in `sessionStorage`.
- `src/api/liftosaur.ts` parses Liftosaur history from the live proxy or `public/liftosaur-history.json`.
- `src/utils/stats.ts` holds pure workout analytics helpers.
- `src/utils/muscles.ts` infers muscle groups from exercise names and API metadata.
- `src/utils/date.ts` is the tiny local date helper used instead of a date library.
- `src/components/SimpleChart.tsx` renders the app's SVG line/bar charts without a chart dependency.

## Privacy

Do not commit `.env`, `public/liftosaur-history.json`, exported workout data, `dist/`, or screenshots with personal data. These are ignored locally, but check `git status --ignored` before publishing.
