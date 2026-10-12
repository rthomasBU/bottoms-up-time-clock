// Crop reference data. Figures are typical home-garden values drawn from
// university extension planting guides (spacing, days to maturity, yield per
// plant, frost tolerance) and the USDA Dietary Guidelines vegetable subgroups.
// They are averages - real yields swing with variety, soil and care - so the
// planner rounds up and adds a buffer rather than trusting them to the plant.

/** USDA Dietary Guidelines vegetable subgroups. */
export type DietGroup = 'darkGreen' | 'redOrange' | 'legumes' | 'starchy' | 'other'

/** Plant family - drives crop rotation grouping and layout colors. */
export type Family =
  | 'nightshade'
  | 'brassica'
  | 'legume'
  | 'cucurbit'
  | 'allium'
  | 'root'
  | 'greens'
  | 'grass'

export interface Crop {
  id: string
  name: string
  /** Two-letter label used on layout drawings. */
  abbr: string
  family: Family
  group: DietGroup
  /** Relative weight of this crop within its diet subgroup. */
  share: number
  /** Harvested pounds that make one USDA cup-equivalent (includes trim loss). */
  lbPerCup: number
  /** Pounds harvested per plant over one planting. */
  yieldLbPerPlant: number
  /** In-row / intensive spacing between plants, inches. */
  spacingIn: number
  /** Traditional between-row spacing for in-ground rows, inches. */
  rowSpacingIn: number
  /** Plants per square foot in square-foot gardening. */
  sfgPerSqFt: number
  /** Minimum container size per plant, gallons. */
  containerGal: number
  /** Grows up a trellis when given one. */
  vining: boolean
  height: 'tall' | 'medium' | 'short'
  /** Days to maturity from transplant (or from sowing if direct sown). */
  dtm: number
  method: 'transplant' | 'direct'
  /** Weeks to start seed indoors before transplanting. */
  weeksIndoors: number
  /** Air temperature (°F) that kills or badly damages the plant. */
  killTempF: number
  /** Growing-degree base temperature (°F); growth stops below it. */
  baseTempF: number
  /** Cool-season crop (DTM quoted for ~60°F weather) vs warm-season (~72°F). */
  cool: boolean
  /** Minimum soil temperature (°F) for sowing / transplanting. */
  minSoilF: number
  /** Average daytime high (°F) above which the crop bolts or drops flowers. */
  heatMaxF: number
  /** Number of days the planting keeps producing once mature. */
  harvestDays: number
  /** Days between succession sowings; undefined = one main planting. */
  successionDays?: number
  /** Max plantings in a year (for crops without a succession interval). */
  maxPlantings: number
  /** Months the harvest keeps in storage (0 = eat fresh). */
  storageMonths: number
  /** Fraction of the harvest put into storage / preserved. */
  storeFraction: number
  /** Special scheduling rule. */
  special?: 'garlic'
  note?: string
}

export const CROPS: Crop[] = [
  // ---- Dark green -------------------------------------------------------
  {
    id: 'kale', name: 'Kale', abbr: 'Ka', family: 'brassica', group: 'darkGreen', share: 3,
    lbPerCup: 0.15, yieldLbPerPlant: 2, spacingIn: 15, rowSpacingIn: 24, sfgPerSqFt: 1, containerGal: 3,
    vining: false, height: 'medium', dtm: 55, method: 'transplant', weeksIndoors: 5,
    killTempF: 15, baseTempF: 40, cool: true, minSoilF: 45, heatMaxF: 88, harvestDays: 75,
    successionDays: 60, maxPlantings: 4, storageMonths: 0, storeFraction: 0,
    note: 'Cut outer leaves; frost sweetens flavor.',
  },
  {
    id: 'spinach', name: 'Spinach', abbr: 'Sp', family: 'greens', group: 'darkGreen', share: 3,
    lbPerCup: 0.14, yieldLbPerPlant: 0.25, spacingIn: 4, rowSpacingIn: 12, sfgPerSqFt: 9, containerGal: 1,
    vining: false, height: 'short', dtm: 42, method: 'direct', weeksIndoors: 0,
    killTempF: 15, baseTempF: 35, cool: true, minSoilF: 40, heatMaxF: 78, harvestDays: 28,
    successionDays: 14, maxPlantings: 12, storageMonths: 3, storeFraction: 0.2,
    note: 'Bolts in long, hot days - sow spring and fall.',
  },
  {
    id: 'collards', name: 'Collards', abbr: 'Co', family: 'brassica', group: 'darkGreen', share: 2,
    lbPerCup: 0.15, yieldLbPerPlant: 2.5, spacingIn: 18, rowSpacingIn: 30, sfgPerSqFt: 1, containerGal: 5,
    vining: false, height: 'medium', dtm: 60, method: 'transplant', weeksIndoors: 5,
    killTempF: 15, baseTempF: 40, cool: true, minSoilF: 45, heatMaxF: 92, harvestDays: 90,
    successionDays: 75, maxPlantings: 3, storageMonths: 3, storeFraction: 0.2,
  },
  {
    id: 'chard', name: 'Swiss chard', abbr: 'Ch', family: 'greens', group: 'darkGreen', share: 2,
    lbPerCup: 0.15, yieldLbPerPlant: 2, spacingIn: 9, rowSpacingIn: 18, sfgPerSqFt: 4, containerGal: 2,
    vining: false, height: 'medium', dtm: 55, method: 'direct', weeksIndoors: 0,
    killTempF: 25, baseTempF: 40, cool: true, minSoilF: 50, heatMaxF: 92, harvestDays: 100,
    successionDays: 90, maxPlantings: 3, storageMonths: 0, storeFraction: 0,
    note: 'Cut-and-come-again for months.',
  },
  {
    id: 'broccoli', name: 'Broccoli', abbr: 'Br', family: 'brassica', group: 'darkGreen', share: 3,
    lbPerCup: 0.25, yieldLbPerPlant: 1.25, spacingIn: 18, rowSpacingIn: 30, sfgPerSqFt: 1, containerGal: 5,
    vining: false, height: 'medium', dtm: 65, method: 'transplant', weeksIndoors: 6,
    killTempF: 26, baseTempF: 40, cool: true, minSoilF: 45, heatMaxF: 82, harvestDays: 28,
    successionDays: 21, maxPlantings: 6, storageMonths: 8, storeFraction: 0.35,
    note: 'Keep cutting side shoots after the main head.',
  },
  {
    id: 'lettuce', name: 'Lettuce (leaf/romaine)', abbr: 'Le', family: 'greens', group: 'darkGreen', share: 3,
    lbPerCup: 0.14, yieldLbPerPlant: 0.5, spacingIn: 8, rowSpacingIn: 12, sfgPerSqFt: 4, containerGal: 1,
    vining: false, height: 'short', dtm: 45, method: 'direct', weeksIndoors: 0,
    killTempF: 26, baseTempF: 40, cool: true, minSoilF: 40, heatMaxF: 80, harvestDays: 21,
    successionDays: 14, maxPlantings: 16, storageMonths: 0, storeFraction: 0,
    note: 'Use shade cloth to stretch into early summer.',
  },
  {
    id: 'bokchoy', name: 'Bok choy', abbr: 'Bc', family: 'brassica', group: 'darkGreen', share: 1,
    lbPerCup: 0.15, yieldLbPerPlant: 0.75, spacingIn: 8, rowSpacingIn: 18, sfgPerSqFt: 4, containerGal: 1,
    vining: false, height: 'short', dtm: 45, method: 'direct', weeksIndoors: 0,
    killTempF: 26, baseTempF: 40, cool: true, minSoilF: 45, heatMaxF: 80, harvestDays: 14,
    successionDays: 21, maxPlantings: 8, storageMonths: 0, storeFraction: 0,
  },

  // ---- Red & orange -----------------------------------------------------
  {
    id: 'tomato', name: 'Tomato', abbr: 'To', family: 'nightshade', group: 'redOrange', share: 5,
    lbPerCup: 0.4, yieldLbPerPlant: 10, spacingIn: 24, rowSpacingIn: 48, sfgPerSqFt: 1, containerGal: 15,
    vining: true, height: 'tall', dtm: 75, method: 'transplant', weeksIndoors: 7,
    killTempF: 33, baseTempF: 50, cool: false, minSoilF: 60, heatMaxF: 92, harvestDays: 70,
    maxPlantings: 2, storageMonths: 12, storeFraction: 0.4,
    note: 'Stake or cage. Can or freeze the surplus for winter.',
  },
  {
    id: 'pepper', name: 'Sweet pepper', abbr: 'Pe', family: 'nightshade', group: 'redOrange', share: 2,
    lbPerCup: 0.33, yieldLbPerPlant: 2.5, spacingIn: 18, rowSpacingIn: 30, sfgPerSqFt: 1, containerGal: 5,
    vining: false, height: 'medium', dtm: 75, method: 'transplant', weeksIndoors: 8,
    killTempF: 33, baseTempF: 50, cool: false, minSoilF: 65, heatMaxF: 94, harvestDays: 70,
    maxPlantings: 1, storageMonths: 9, storeFraction: 0.3,
    note: 'Leave on the plant to turn red for the most nutrition.',
  },
  {
    id: 'carrot', name: 'Carrot', abbr: 'Ca', family: 'root', group: 'redOrange', share: 4,
    lbPerCup: 0.3, yieldLbPerPlant: 0.15, spacingIn: 2, rowSpacingIn: 12, sfgPerSqFt: 16, containerGal: 0.5,
    vining: false, height: 'short', dtm: 70, method: 'direct', weeksIndoors: 0,
    killTempF: 20, baseTempF: 40, cool: true, minSoilF: 45, heatMaxF: 90, harvestDays: 35,
    successionDays: 30, maxPlantings: 6, storageMonths: 5, storeFraction: 0.6,
    note: 'Fall crops store in the ground under mulch.',
  },
  {
    id: 'wsquash', name: 'Winter squash', abbr: 'WS', family: 'cucurbit', group: 'redOrange', share: 3,
    lbPerCup: 0.33, yieldLbPerPlant: 12, spacingIn: 36, rowSpacingIn: 72, sfgPerSqFt: 0.5, containerGal: 20,
    vining: true, height: 'medium', dtm: 95, method: 'direct', weeksIndoors: 0,
    killTempF: 33, baseTempF: 50, cool: false, minSoilF: 65, heatMaxF: 95, harvestDays: 21,
    maxPlantings: 1, storageMonths: 6, storeFraction: 0.9,
    note: 'Cure 10 days in the sun, store cool and dry.',
  },
  {
    id: 'sweetpotato', name: 'Sweet potato', abbr: 'SP', family: 'root', group: 'redOrange', share: 2,
    lbPerCup: 0.33, yieldLbPerPlant: 2, spacingIn: 12, rowSpacingIn: 36, sfgPerSqFt: 1, containerGal: 10,
    vining: false, height: 'short', dtm: 100, method: 'transplant', weeksIndoors: 6,
    killTempF: 34, baseTempF: 55, cool: false, minSoilF: 65, heatMaxF: 100, harvestDays: 21,
    maxPlantings: 1, storageMonths: 6, storeFraction: 0.9,
    note: 'Planted from slips; needs a long, hot season.',
  },

  // ---- Beans, peas, lentils --------------------------------------------
  {
    id: 'drybean', name: 'Dry beans (black/pinto)', abbr: 'DB', family: 'legume', group: 'legumes', share: 3,
    lbPerCup: 0.17, yieldLbPerPlant: 0.12, spacingIn: 4, rowSpacingIn: 24, sfgPerSqFt: 9, containerGal: 1,
    vining: false, height: 'short', dtm: 95, method: 'direct', weeksIndoors: 0,
    killTempF: 33, baseTempF: 50, cool: false, minSoilF: 60, heatMaxF: 94, harvestDays: 14,
    maxPlantings: 1, storageMonths: 12, storeFraction: 1,
    note: 'Let pods dry on the plant; shell and store.',
  },
  {
    id: 'cowpea', name: 'Southern peas (cowpeas)', abbr: 'Cw', family: 'legume', group: 'legumes', share: 1,
    lbPerCup: 0.17, yieldLbPerPlant: 0.1, spacingIn: 4, rowSpacingIn: 30, sfgPerSqFt: 9, containerGal: 2,
    vining: false, height: 'short', dtm: 75, method: 'direct', weeksIndoors: 0,
    killTempF: 33, baseTempF: 55, cool: false, minSoilF: 65, heatMaxF: 105, harvestDays: 21,
    maxPlantings: 1, storageMonths: 12, storeFraction: 1,
    note: 'Thrives in heat that stops other beans.',
  },

  // ---- Starchy ----------------------------------------------------------
  {
    id: 'potato', name: 'Potato', abbr: 'Po', family: 'nightshade', group: 'starchy', share: 6,
    lbPerCup: 0.35, yieldLbPerPlant: 2, spacingIn: 12, rowSpacingIn: 30, sfgPerSqFt: 1, containerGal: 10,
    vining: false, height: 'medium', dtm: 90, method: 'direct', weeksIndoors: 0,
    killTempF: 29, baseTempF: 45, cool: true, minSoilF: 45, heatMaxF: 88, harvestDays: 14,
    maxPlantings: 2, storageMonths: 6, storeFraction: 0.85,
    note: 'Plant seed pieces; hill soil as they grow.',
  },
  {
    id: 'corn', name: 'Sweet corn', abbr: 'Cn', family: 'grass', group: 'starchy', share: 2,
    lbPerCup: 0.35, yieldLbPerPlant: 0.6, spacingIn: 10, rowSpacingIn: 30, sfgPerSqFt: 1, containerGal: 0,
    vining: false, height: 'tall', dtm: 80, method: 'direct', weeksIndoors: 0,
    killTempF: 32, baseTempF: 50, cool: false, minSoilF: 60, heatMaxF: 95, harvestDays: 10,
    successionDays: 21, maxPlantings: 4, storageMonths: 9, storeFraction: 0.5,
    note: 'Plant in blocks of 4+ rows for pollination.',
  },
  {
    id: 'peas', name: 'Green peas', abbr: 'GP', family: 'legume', group: 'starchy', share: 2,
    lbPerCup: 0.33, yieldLbPerPlant: 0.12, spacingIn: 2, rowSpacingIn: 24, sfgPerSqFt: 8, containerGal: 1,
    vining: true, height: 'tall', dtm: 60, method: 'direct', weeksIndoors: 0,
    killTempF: 26, baseTempF: 40, cool: true, minSoilF: 40, heatMaxF: 82, harvestDays: 21,
    successionDays: 14, maxPlantings: 4, storageMonths: 9, storeFraction: 0.5,
    note: 'Needs a 4-6 ft trellis.',
  },

  // ---- Other ------------------------------------------------------------
  {
    id: 'greenbean', name: 'Green beans (bush)', abbr: 'GB', family: 'legume', group: 'other', share: 4,
    lbPerCup: 0.25, yieldLbPerPlant: 0.5, spacingIn: 4, rowSpacingIn: 18, sfgPerSqFt: 9, containerGal: 1,
    vining: false, height: 'short', dtm: 55, method: 'direct', weeksIndoors: 0,
    killTempF: 33, baseTempF: 50, cool: false, minSoilF: 60, heatMaxF: 92, harvestDays: 21,
    successionDays: 21, maxPlantings: 6, storageMonths: 9, storeFraction: 0.4,
  },
  {
    id: 'cucumber', name: 'Cucumber', abbr: 'Cu', family: 'cucurbit', group: 'other', share: 3,
    lbPerCup: 0.3, yieldLbPerPlant: 4, spacingIn: 12, rowSpacingIn: 48, sfgPerSqFt: 2, containerGal: 5,
    vining: true, height: 'tall', dtm: 55, method: 'direct', weeksIndoors: 0,
    killTempF: 33, baseTempF: 55, cool: false, minSoilF: 65, heatMaxF: 95, harvestDays: 35,
    successionDays: 35, maxPlantings: 3, storageMonths: 9, storeFraction: 0.2,
    note: 'Trellis for straighter fruit and half the space.',
  },
  {
    id: 'zucchini', name: 'Zucchini / summer squash', abbr: 'Zu', family: 'cucurbit', group: 'other', share: 3,
    lbPerCup: 0.3, yieldLbPerPlant: 8, spacingIn: 24, rowSpacingIn: 48, sfgPerSqFt: 0.33, containerGal: 10,
    vining: false, height: 'medium', dtm: 50, method: 'direct', weeksIndoors: 0,
    killTempF: 33, baseTempF: 55, cool: false, minSoilF: 65, heatMaxF: 95, harvestDays: 45,
    successionDays: 45, maxPlantings: 3, storageMonths: 0, storeFraction: 0,
  },
  {
    id: 'onion', name: 'Onion', abbr: 'On', family: 'allium', group: 'other', share: 4,
    lbPerCup: 0.35, yieldLbPerPlant: 0.4, spacingIn: 4, rowSpacingIn: 12, sfgPerSqFt: 9, containerGal: 0.5,
    vining: false, height: 'short', dtm: 100, method: 'transplant', weeksIndoors: 10,
    killTempF: 20, baseTempF: 40, cool: true, minSoilF: 45, heatMaxF: 100, harvestDays: 14,
    maxPlantings: 1, storageMonths: 6, storeFraction: 0.9,
  },
  {
    id: 'garlic', name: 'Garlic', abbr: 'Ga', family: 'allium', group: 'other', share: 1,
    lbPerCup: 0.3, yieldLbPerPlant: 0.1, spacingIn: 6, rowSpacingIn: 12, sfgPerSqFt: 4, containerGal: 0.5,
    vining: false, height: 'short', dtm: 240, method: 'direct', weeksIndoors: 0,
    killTempF: -10, baseTempF: 32, cool: true, minSoilF: 0, heatMaxF: 110, harvestDays: 14,
    maxPlantings: 1, storageMonths: 8, storeFraction: 0.95, special: 'garlic',
    note: 'Plant cloves in fall; harvest when lower leaves brown.',
  },
  {
    id: 'cabbage', name: 'Cabbage', abbr: 'Cb', family: 'brassica', group: 'other', share: 3,
    lbPerCup: 0.2, yieldLbPerPlant: 3, spacingIn: 18, rowSpacingIn: 30, sfgPerSqFt: 1, containerGal: 5,
    vining: false, height: 'medium', dtm: 70, method: 'transplant', weeksIndoors: 6,
    killTempF: 20, baseTempF: 40, cool: true, minSoilF: 45, heatMaxF: 85, harvestDays: 21,
    successionDays: 45, maxPlantings: 3, storageMonths: 3, storeFraction: 0.5,
    note: 'Late cabbages keep for months; ferment the rest.',
  },
  {
    id: 'cauliflower', name: 'Cauliflower', abbr: 'Cf', family: 'brassica', group: 'other', share: 1,
    lbPerCup: 0.25, yieldLbPerPlant: 1.5, spacingIn: 18, rowSpacingIn: 30, sfgPerSqFt: 1, containerGal: 5,
    vining: false, height: 'medium', dtm: 70, method: 'transplant', weeksIndoors: 6,
    killTempF: 26, baseTempF: 40, cool: true, minSoilF: 45, heatMaxF: 80, harvestDays: 14,
    successionDays: 30, maxPlantings: 3, storageMonths: 8, storeFraction: 0.3,
  },
  {
    id: 'beet', name: 'Beets', abbr: 'Be', family: 'root', group: 'other', share: 2,
    lbPerCup: 0.3, yieldLbPerPlant: 0.3, spacingIn: 3, rowSpacingIn: 12, sfgPerSqFt: 9, containerGal: 0.5,
    vining: false, height: 'short', dtm: 55, method: 'direct', weeksIndoors: 0,
    killTempF: 24, baseTempF: 40, cool: true, minSoilF: 50, heatMaxF: 88, harvestDays: 30,
    successionDays: 30, maxPlantings: 6, storageMonths: 4, storeFraction: 0.5,
    note: 'Greens are edible too.',
  },
  {
    id: 'eggplant', name: 'Eggplant', abbr: 'Eg', family: 'nightshade', group: 'other', share: 1,
    lbPerCup: 0.3, yieldLbPerPlant: 3, spacingIn: 18, rowSpacingIn: 30, sfgPerSqFt: 1, containerGal: 5,
    vining: false, height: 'medium', dtm: 75, method: 'transplant', weeksIndoors: 8,
    killTempF: 34, baseTempF: 55, cool: false, minSoilF: 65, heatMaxF: 98, harvestDays: 60,
    maxPlantings: 1, storageMonths: 0, storeFraction: 0,
  },
  {
    id: 'radish', name: 'Radish', abbr: 'Ra', family: 'brassica', group: 'other', share: 1,
    lbPerCup: 0.25, yieldLbPerPlant: 0.06, spacingIn: 2, rowSpacingIn: 6, sfgPerSqFt: 16, containerGal: 0.25,
    vining: false, height: 'short', dtm: 28, method: 'direct', weeksIndoors: 0,
    killTempF: 22, baseTempF: 40, cool: true, minSoilF: 40, heatMaxF: 80, harvestDays: 10,
    successionDays: 14, maxPlantings: 12, storageMonths: 0, storeFraction: 0,
  },
  {
    id: 'okra', name: 'Okra', abbr: 'Ok', family: 'nightshade', group: 'other', share: 1,
    lbPerCup: 0.25, yieldLbPerPlant: 1.5, spacingIn: 12, rowSpacingIn: 36, sfgPerSqFt: 1, containerGal: 5,
    vining: false, height: 'tall', dtm: 60, method: 'direct', weeksIndoors: 0,
    killTempF: 35, baseTempF: 60, cool: false, minSoilF: 68, heatMaxF: 110, harvestDays: 70,
    maxPlantings: 1, storageMonths: 9, storeFraction: 0.3,
    note: 'Pick pods daily at 3-4 inches. (Mallow family; rotate with nightshades.)',
  },
]

export const CROPS_BY_ID: Record<string, Crop> = Object.fromEntries(CROPS.map((c) => [c.id, c]))

export const DIET_GROUPS: Record<DietGroup, { label: string; cupsPerWeek: number }> = {
  // Weekly cup-equivalents per person at a 2,000-calorie pattern (USDA DGA 2020-2025).
  darkGreen: { label: 'Dark green', cupsPerWeek: 1.5 },
  redOrange: { label: 'Red & orange', cupsPerWeek: 5.5 },
  legumes: { label: 'Beans, peas & lentils', cupsPerWeek: 1.5 },
  starchy: { label: 'Starchy', cupsPerWeek: 5 },
  other: { label: 'Other', cupsPerWeek: 4 },
}

export const FAMILY_LABELS: Record<Family, string> = {
  nightshade: 'Nightshades',
  brassica: 'Brassicas',
  legume: 'Legumes',
  cucurbit: 'Squash & cucumbers',
  allium: 'Onions & garlic',
  root: 'Roots',
  greens: 'Leafy greens',
  grass: 'Corn',
}

// Companion pairs (good neighbors) and antagonists, by crop id.
export const COMPANIONS: [string, string][] = [
  ['corn', 'drybean'], ['corn', 'wsquash'], ['drybean', 'wsquash'], ['corn', 'cucumber'],
  ['tomato', 'carrot'], ['tomato', 'lettuce'], ['tomato', 'onion'], ['pepper', 'onion'],
  ['carrot', 'onion'], ['carrot', 'radish'], ['carrot', 'peas'], ['lettuce', 'radish'],
  ['spinach', 'peas'], ['beet', 'onion'], ['beet', 'lettuce'], ['cabbage', 'onion'],
  ['broccoli', 'onion'], ['kale', 'beet'], ['cucumber', 'peas'], ['cucumber', 'radish'],
  ['greenbean', 'carrot'], ['greenbean', 'cucumber'], ['eggplant', 'greenbean'],
  ['potato', 'greenbean'], ['potato', 'cabbage'], ['chard', 'onion'], ['okra', 'pepper'],
  ['garlic', 'tomato'], ['garlic', 'beet'], ['zucchini', 'corn'], ['bokchoy', 'onion'],
]

export const ANTAGONISTS: [string, string][] = [
  ['greenbean', 'onion'], ['greenbean', 'garlic'], ['drybean', 'onion'], ['drybean', 'garlic'],
  ['peas', 'onion'], ['peas', 'garlic'], ['tomato', 'potato'], ['tomato', 'corn'],
  ['tomato', 'cabbage'], ['tomato', 'broccoli'], ['potato', 'wsquash'], ['potato', 'cucumber'],
  ['cucumber', 'potato'], ['corn', 'tomato'],
]
