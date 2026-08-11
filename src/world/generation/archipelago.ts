export type ArchipelagoGenerationConfig = Readonly<{
  width: number;
  height: number;
}>;

export type GeneratedArchipelago = Readonly<{
  seed: number;
  width: number;
  height: number;
  elevations: ReadonlyArray<number>;
  landMask: ReadonlyArray<boolean>;
  islandIds: ReadonlyArray<number>;
}>;

export const DEFAULT_ARCHIPELAGO_CONFIG: ArchipelagoGenerationConfig = Object.freeze({
  width: 256,
  height: 256,
});

const MINI_ISLAND_COUNT = 300;
const MEDIUM_ISLAND_COUNT = 80;
const LARGE_ISLAND_COUNT = 20;
const TOTAL_ISLAND_COUNT = MINI_ISLAND_COUNT + MEDIUM_ISLAND_COUNT + LARGE_ISLAND_COUNT;
const LARGE_ISLAND_SIZE = 14;
const MAP_EDGE_MARGIN = 2;
const MAX_SHAPE_ATTEMPTS = 8;
const OCEAN_ELEVATION_MINIMUM = 0.07;
const OCEAN_ELEVATION_VARIATION = 0.11;
const SHALLOW_WATER_ELEVATION_MINIMUM = 0.28;
const SHALLOW_WATER_ELEVATION_VARIATION = 0.07;
const LAND_ELEVATION_MINIMUM = 0.42;
const LAND_ELEVATION_VARIATION = 0.22;

type IslandPlan = Readonly<{
  size: number;
}>;

/**
 * Generates a deterministic scalar elevation grid normalized to the 0..1 range.
 * Each land footprint is grown from a seed cell and kept one water cell away
 * from every other footprint. Terrain classification remains a presentation concern.
 */
export function generateArchipelago(
  seed: number,
  config: ArchipelagoGenerationConfig,
): GeneratedArchipelago {
  validateConfig(config);

  const normalizedSeed = seed >>> 0;
  const random = createSeededRandom(normalizedSeed);
  const islandIds = placeIslands(config.width, config.height, createIslandPlans(random), random);
  const elevations = createElevationValues(
    config.width,
    config.height,
    islandIds,
    normalizedSeed,
  );

  return Object.freeze({
    seed: normalizedSeed,
    width: config.width,
    height: config.height,
    elevations: Object.freeze(elevations),
    landMask: Object.freeze(Array.from(islandIds, (islandId) => islandId !== 0)),
    islandIds: Object.freeze(Array.from(islandIds)),
  });
}

function validateConfig(config: ArchipelagoGenerationConfig) {
  if (!Number.isInteger(config.width) || config.width < 2) {
    throw new Error('Archipelago width must be an integer greater than one.');
  }
  if (!Number.isInteger(config.height) || config.height < 2) {
    throw new Error('Archipelago height must be an integer greater than one.');
  }
}

function createIslandPlans(random: () => number): IslandPlan[] {
  const plans: IslandPlan[] = [];

  for (let index = 0; index < LARGE_ISLAND_COUNT; index += 1) {
    plans.push({ size: LARGE_ISLAND_SIZE });
  }
  for (let index = 0; index < MEDIUM_ISLAND_COUNT; index += 1) {
    plans.push({ size: randomInteger(random, 4, 8) });
  }
  for (let index = 0; index < MINI_ISLAND_COUNT; index += 1) {
    plans.push({ size: randomInteger(random, 1, 2) });
  }

  return plans;
}

function placeIslands(
  width: number,
  height: number,
  plans: ReadonlyArray<IslandPlan>,
  random: () => number,
): Int32Array {
  const islandIds = new Int32Array(width * height);
  const seedCandidates = createShuffledSeedCandidates(width, height, random);
  let candidateCursor = 0;

  for (let islandIndex = 0; islandIndex < plans.length; islandIndex += 1) {
    const islandId = islandIndex + 1;
    const plan = plans[islandIndex];
    let footprint: number[] | undefined;

    while (!footprint && candidateCursor < seedCandidates.length) {
      const seedIndex = seedCandidates[candidateCursor];
      candidateCursor += 1;

      if (!isSeparatedFromPlacedIslands(seedIndex, width, height, islandIds)) {
        continue;
      }

      for (let attempt = 0; attempt < MAX_SHAPE_ATTEMPTS; attempt += 1) {
        const candidateFootprint = growFootprint(
          seedIndex,
          plan.size,
          width,
          height,
          islandIds,
          random,
        );
        if (candidateFootprint && isIrregularFootprint(candidateFootprint, width)) {
          footprint = candidateFootprint;
          break;
        }
      }
    }

    if (!footprint) {
      throw new Error(
        `Unable to place all ${TOTAL_ISLAND_COUNT} islands on a ${width}x${height} height map. `
          + `Placement stopped after ${islandIndex} islands.`,
      );
    }

    footprint.forEach((cellIndex) => {
      islandIds[cellIndex] = islandId;
    });
  }

  return islandIds;
}

function createShuffledSeedCandidates(
  width: number,
  height: number,
  random: () => number,
): number[] {
  const candidates: number[] = [];

  for (let y = MAP_EDGE_MARGIN; y < height - MAP_EDGE_MARGIN; y += 1) {
    for (let x = MAP_EDGE_MARGIN; x < width - MAP_EDGE_MARGIN; x += 1) {
      candidates.push(y * width + x);
    }
  }

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(random, 0, index);
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }

  return candidates;
}

function growFootprint(
  seedIndex: number,
  targetSize: number,
  width: number,
  height: number,
  islandIds: Int32Array,
  random: () => number,
): number[] | undefined {
  const cells = [seedIndex];
  const cellSet = new Set(cells);

  while (cells.length < targetSize) {
    const frontier: number[] = [];
    const frontierSet = new Set<number>();

    cells.forEach((cellIndex) => {
      getCardinalNeighbors(cellIndex, width, height).forEach((neighborIndex) => {
        if (
          !cellSet.has(neighborIndex)
          && !frontierSet.has(neighborIndex)
          && isInsidePlacementArea(neighborIndex, width, height)
          && isSeparatedFromPlacedIslands(neighborIndex, width, height, islandIds)
        ) {
          frontierSet.add(neighborIndex);
          frontier.push(neighborIndex);
        }
      });
    });

    if (frontier.length === 0) {
      return undefined;
    }

    const nextCell = frontier[randomInteger(random, 0, frontier.length - 1)];
    cells.push(nextCell);
    cellSet.add(nextCell);
  }

  return cells;
}

function isIrregularFootprint(cells: ReadonlyArray<number>, width: number): boolean {
  if (cells.length <= 2) {
    return true;
  }

  let minimumX = width;
  let maximumX = 0;
  let minimumY = Number.MAX_SAFE_INTEGER;
  let maximumY = 0;

  cells.forEach((cellIndex) => {
    const x = cellIndex % width;
    const y = Math.floor(cellIndex / width);
    minimumX = Math.min(minimumX, x);
    maximumX = Math.max(maximumX, x);
    minimumY = Math.min(minimumY, y);
    maximumY = Math.max(maximumY, y);
  });

  const boundingArea = (maximumX - minimumX + 1) * (maximumY - minimumY + 1);
  return boundingArea > cells.length;
}

function isInsidePlacementArea(cellIndex: number, width: number, height: number): boolean {
  const x = cellIndex % width;
  const y = Math.floor(cellIndex / width);
  return x >= MAP_EDGE_MARGIN
    && x < width - MAP_EDGE_MARGIN
    && y >= MAP_EDGE_MARGIN
    && y < height - MAP_EDGE_MARGIN;
}

function isSeparatedFromPlacedIslands(
  cellIndex: number,
  width: number,
  height: number,
  islandIds: Int32Array,
): boolean {
  const centerX = cellIndex % width;
  const centerY = Math.floor(cellIndex / width);

  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    const y = centerY + offsetY;
    if (y < 0 || y >= height) {
      continue;
    }

    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const x = centerX + offsetX;
      if (x >= 0 && x < width && islandIds[y * width + x] !== 0) {
        return false;
      }
    }
  }

  return true;
}

function getCardinalNeighbors(cellIndex: number, width: number, height: number): number[] {
  const x = cellIndex % width;
  const y = Math.floor(cellIndex / width);
  const neighbors: number[] = [];

  if (x > 0) {
    neighbors.push(cellIndex - 1);
  }
  if (x + 1 < width) {
    neighbors.push(cellIndex + 1);
  }
  if (y > 0) {
    neighbors.push(cellIndex - width);
  }
  if (y + 1 < height) {
    neighbors.push(cellIndex + width);
  }

  return neighbors;
}

function createElevationValues(
  width: number,
  height: number,
  islandIds: Int32Array,
  seed: number,
): number[] {
  const values = new Array<number>(islandIds.length);

  for (let cellIndex = 0; cellIndex < islandIds.length; cellIndex += 1) {
    const islandId = islandIds[cellIndex];
    const variation = hashToUnitInterval(cellIndex, seed);

    if (islandId !== 0) {
      const connectedNeighbors = getCardinalNeighbors(cellIndex, width, height)
        .filter((neighborIndex) => islandIds[neighborIndex] === islandId)
        .length;
      values[cellIndex] = Math.min(
        1,
        LAND_ELEVATION_MINIMUM + variation * LAND_ELEVATION_VARIATION
          + connectedNeighbors * 0.025,
      );
      continue;
    }

    values[cellIndex] = hasAdjacentLand(cellIndex, width, height, islandIds)
      ? SHALLOW_WATER_ELEVATION_MINIMUM + variation * SHALLOW_WATER_ELEVATION_VARIATION
      : OCEAN_ELEVATION_MINIMUM + variation * OCEAN_ELEVATION_VARIATION;
  }

  return values;
}

function hasAdjacentLand(
  cellIndex: number,
  width: number,
  height: number,
  islandIds: Int32Array,
): boolean {
  const centerX = cellIndex % width;
  const centerY = Math.floor(cellIndex / width);

  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    const y = centerY + offsetY;
    if (y < 0 || y >= height) {
      continue;
    }

    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const x = centerX + offsetX;
      if (x >= 0 && x < width && islandIds[y * width + x] !== 0) {
        return true;
      }
    }
  }

  return false;
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

function hashToUnitInterval(cellIndex: number, seed: number): number {
  let value = seed ^ Math.imul(cellIndex, 0x9e3779b1);
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0x1_0000_0000;
}
