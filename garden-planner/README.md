# Year-Round Garden Planner

A standalone web app (React + TypeScript + Vite) that plans a year of vegetable
growing for a household. It is independent of the time clock app in the repo
root; it has its own `package.json` and is not part of the time clock build or deploy.

## What it does

**Inputs:** people to feed, ZIP code, planting area (length × width), growing
style (in-ground rows, raised beds, square-foot, raised beds + trellises,
containers), season extension (none, row covers, cold frames, hoop house), share
of vegetables to grow, and which vegetables to include.

**Outputs:**

- **What to plant:** plant counts for 28 vegetables, sized to the USDA Dietary
  Guidelines vegetable subgroups (dark green, red & orange, beans/peas/lentils,
  starchy, other: 17.5 cups per person per week) plus a 15% buffer. Each row
  shows the plantings, spacing for the chosen style, space per planting and
  expected yield. If the garden is too small, every crop is scaled down and the
  app shows how much space the full plan needs. A chart shows the supply over
  the year, fresh and from storage, against the daily target.
- **Calendar:** a 12-month timeline (seed-starting indoors, growing, harvest)
  and a month-by-month task list.
- **Layout:** scale drawings of beds, rows or containers for the busiest day
  and for each season, with plants drawn at their spacing. Choose
  *rotation blocks* (grouped by plant family) or *companion mix* (good
  neighbors together, bad pairings apart). For beds you can also pick the bed size.
- **Weather:** current conditions, a 16-day forecast with soil temperature,
  "plant now / wait / heads-up" advice, and a climate summary (approximate
  hardiness zone, frost dates with odds, frost-free days, monthly normals).

## How planting dates are chosen

For every crop and every day in the next 12 months, the planner checks:

1. **Frost risk.** It uses 15 years of daily lows (Open-Meteo ERA5 archive) to
   count the years in which a killing frost for that crop fell between planting
   and early harvest. If that happens in more than 15% of years, the day is rejected.
2. **Growth speed.** Growing degree days, slowed by short winter days, so fall
   and winter crops take realistically longer.
3. **Soil temperature** for germination or transplanting.
4. **Heat.** Cool-season crops that would mature into bolting heat, and
   warm-season crops in summers that are too cool, are rejected.

Succession crops (lettuce, beans, carrots, …) repeat at their interval inside
the open windows. Storage crops are planted once. The live forecast then
adjusts the next two weeks: hold off if frost or cold soil is forecast, protect
crops from a cold snap, and skip sowing before heavy rain.

## Data sources (free, no API keys)

- [Zippopotam.us](https://zippopotam.us): ZIP code to coordinates (falls back to Open-Meteo geocoding)
- [Open-Meteo](https://open-meteo.com): historical archive, forecast and soil temperature

Climate summaries are cached in `localStorage` per location.

## Run it

```bash
cd garden-planner
npm install
npm run dev      # http://localhost:5173
npm test         # planner unit tests
npm run build    # typecheck + production build into dist/
```

## Caveats

Yields, spacing and days to maturity are typical extension-guide figures;
real results vary with variety, soil and care. Reanalysis weather is gridded
(~10 km), so frost pockets and urban heat islands aren't captured. The app
tells users in low spots to plant tender crops a week later.
