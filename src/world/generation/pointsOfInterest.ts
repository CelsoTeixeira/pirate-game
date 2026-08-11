export type PoiSize = 'small' | 'medium' | 'big';

export type GeneratedPointOfInterest =
  | Readonly<{
    id: string;
    environment: 'land';
    kind: 'city' | 'trading-post' | 'fortress' | 'pirate-hub';
    size: PoiSize;
    x: number;
    y: number;
    islandId: number;
  }>
  | Readonly<{
    id: string;
    environment: 'water';
    kind: 'merchant-ship' | 'navy-patrol' | 'pirate-ship' | 'kraken' | 'ghost-ship' | 'siren-waters';
    size: PoiSize;
    x: number;
    y: number;
  }>;

type LandPointOfInterest = Extract<GeneratedPointOfInterest, { environment: 'land' }>;
type WaterPointOfInterest = Extract<GeneratedPointOfInterest, { environment: 'water' }>;
type LandPoiPlan = Readonly<Pick<LandPointOfInterest, 'kind' | 'size'>>;
type WaterPoiPlan = Readonly<Pick<WaterPointOfInterest, 'kind' | 'size'>>;
type IslandCells = Readonly<{
  id: number;
  cells: ReadonlyArray<number>;
}>;

const POI_SEED_SALT = 0xa53c_91e5;
const WATER_COAST_CLEARANCE = 3;
const WATER_ENCOUNTER_MINIMUM_SPACING = 16;

const LAND_KINDS: ReadonlyArray<LandPointOfInterest['kind']> = [
  'city',
  'trading-post',
  'fortress',
  'pirate-hub',
];

const WATER_POI_PLANS: ReadonlyArray<WaterPoiPlan> = [
  { kind: 'merchant-ship', size: 'small' },
  { kind: 'merchant-ship', size: 'small' },
  { kind: 'navy-patrol', size: 'medium' },
  { kind: 'navy-patrol', size: 'medium' },
  { kind: 'pirate-ship', size: 'small' },
  { kind: 'pirate-ship', size: 'medium' },
  { kind: 'kraken', size: 'big' },
  { kind: 'kraken', size: 'big' },
  { kind: 'ghost-ship', size: 'small' },
  { kind: 'ghost-ship', size: 'medium' },
  { kind: 'siren-waters', size: 'small' },
  { kind: 'siren-waters', size: 'small' },
];

/**
 * Generates deterministic settlements and open-water encounters without
 * consuming the terrain generator's random stream.
 */
export function generatePointsOfInterest(
  seed: number,
  width: number,
  height: number,
  islandIds: ArrayLike<number>,
): ReadonlyArray<GeneratedPointOfInterest> {
  if (islandIds.length !== width * height) {
    throw new Error(
      `Unable to generate points of interest: expected ${width * height} island cells, `
        + `received ${islandIds.length}.`,
    );
  }

  const random = createSeededRandom((seed ^ POI_SEED_SALT) >>> 0);
  const landPoints = generateLandPoints(width, islandIds, random);
  const waterPoints = generateWaterPoints(width, height, islandIds, random);
  return Object.freeze([...landPoints, ...waterPoints]);
}

function generateLandPoints(
  width: number,
  islandIds: ArrayLike<number>,
  random: () => number,
): ReadonlyArray<LandPointOfInterest> {
  const islands = collectIslandCells(islandIds);
  const usedIslandIds = new Set<number>();

  return createLandPoiPlans().map((plan, index) => {
    const eligibleIslands = islands.filter((island) => (
      !usedIslandIds.has(island.id) && isIslandEligibleForSize(island, plan.size)
    ));

    if (eligibleIslands.length === 0) {
      throw new Error(
        `Unable to place all 24 land points of interest: no unused island is eligible `
          + `for ${plan.size} placement ${index + 1}.`,
      );
    }

    const island = eligibleIslands[randomInteger(random, 0, eligibleIslands.length - 1)];
    const cellIndex = findCellNearestCentroid(island.cells, width);
    usedIslandIds.add(island.id);

    return Object.freeze({
      id: `land-${String(index + 1).padStart(3, '0')}`,
      environment: 'land' as const,
      kind: plan.kind,
      size: plan.size,
      x: cellIndex % width,
      y: Math.floor(cellIndex / width),
      islandId: island.id,
    });
  });
}

function createLandPoiPlans(): LandPoiPlan[] {
  const plans: LandPoiPlan[] = [];

  ([
    ['big', 1],
    ['medium', 2],
    ['small', 3],
  ] as const).forEach(([size, repetitions]) => {
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      LAND_KINDS.forEach((kind) => plans.push({ kind, size }));
    }
  });

  return plans;
}

function collectIslandCells(islandIds: ArrayLike<number>): IslandCells[] {
  const cellsByIsland = new Map<number, number[]>();

  for (let cellIndex = 0; cellIndex < islandIds.length; cellIndex += 1) {
    const islandId = islandIds[cellIndex];
    if (islandId === 0) {
      continue;
    }

    const cells = cellsByIsland.get(islandId);
    if (cells) {
      cells.push(cellIndex);
    } else {
      cellsByIsland.set(islandId, [cellIndex]);
    }
  }

  return Array.from(cellsByIsland, ([id, cells]) => ({ id, cells }));
}

function isIslandEligibleForSize(island: IslandCells, size: PoiSize): boolean {
  if (size === 'big') {
    return island.cells.length === 14;
  }
  if (size === 'medium') {
    return island.cells.length >= 4;
  }
  return true;
}

function findCellNearestCentroid(cells: ReadonlyArray<number>, width: number): number {
  let totalX = 0;
  let totalY = 0;

  cells.forEach((cellIndex) => {
    totalX += cellIndex % width;
    totalY += Math.floor(cellIndex / width);
  });

  const centroidX = totalX / cells.length;
  const centroidY = totalY / cells.length;

  return cells.reduce((nearestCell, cellIndex) => {
    const nearestDistance = distanceSquaredFromCell(nearestCell, width, centroidX, centroidY);
    const cellDistance = distanceSquaredFromCell(cellIndex, width, centroidX, centroidY);
    return cellDistance < nearestDistance
      || (cellDistance === nearestDistance && cellIndex < nearestCell)
      ? cellIndex
      : nearestCell;
  });
}

function distanceSquaredFromCell(
  cellIndex: number,
  width: number,
  targetX: number,
  targetY: number,
): number {
  const deltaX = cellIndex % width - targetX;
  const deltaY = Math.floor(cellIndex / width) - targetY;
  return deltaX * deltaX + deltaY * deltaY;
}

function generateWaterPoints(
  width: number,
  height: number,
  islandIds: ArrayLike<number>,
  random: () => number,
): ReadonlyArray<WaterPointOfInterest> {
  const candidates: number[] = [];

  for (let y = WATER_COAST_CLEARANCE; y < height - WATER_COAST_CLEARANCE; y += 1) {
    for (let x = WATER_COAST_CLEARANCE; x < width - WATER_COAST_CLEARANCE; x += 1) {
      const cellIndex = y * width + x;
      if (!hasLandWithinClearance(x, y, width, islandIds)) {
        candidates.push(cellIndex);
      }
    }
  }

  shuffle(candidates, random);
  const selectedCells: number[] = [];
  for (const candidate of candidates) {
    if (selectedCells.every((selected) => areWaterEncountersSeparated(
      candidate,
      selected,
      width,
    ))) {
      selectedCells.push(candidate);
      if (selectedCells.length === WATER_POI_PLANS.length) {
        break;
      }
    }
  }

  if (selectedCells.length !== WATER_POI_PLANS.length) {
    throw new Error(
      `Unable to place all ${WATER_POI_PLANS.length} water encounters on a ${width}x${height} map `
        + `with ${WATER_COAST_CLEARANCE}-cell coast clearance and `
        + `${WATER_ENCOUNTER_MINIMUM_SPACING}-cell encounter spacing. `
        + `Placed ${selectedCells.length}.`,
    );
  }

  return WATER_POI_PLANS.map((plan, index) => {
    const cellIndex = selectedCells[index];
    return Object.freeze({
      id: `water-${String(index + 1).padStart(3, '0')}`,
      environment: 'water' as const,
      kind: plan.kind,
      size: plan.size,
      x: cellIndex % width,
      y: Math.floor(cellIndex / width),
    });
  });
}

function hasLandWithinClearance(
  centerX: number,
  centerY: number,
  width: number,
  islandIds: ArrayLike<number>,
): boolean {
  for (let offsetY = -WATER_COAST_CLEARANCE; offsetY <= WATER_COAST_CLEARANCE; offsetY += 1) {
    for (let offsetX = -WATER_COAST_CLEARANCE; offsetX <= WATER_COAST_CLEARANCE; offsetX += 1) {
      if (islandIds[(centerY + offsetY) * width + centerX + offsetX] !== 0) {
        return true;
      }
    }
  }
  return false;
}

function areWaterEncountersSeparated(
  firstCell: number,
  secondCell: number,
  width: number,
): boolean {
  const deltaX = firstCell % width - secondCell % width;
  const deltaY = Math.floor(firstCell / width) - Math.floor(secondCell / width);
  return deltaX * deltaX + deltaY * deltaY
    >= WATER_ENCOUNTER_MINIMUM_SPACING * WATER_ENCOUNTER_MINIMUM_SPACING;
}

function shuffle(values: number[], random: () => number) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(random, 0, index);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
}

function createSeededRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

function randomInteger(random: () => number, minimum: number, maximum: number): number {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}
