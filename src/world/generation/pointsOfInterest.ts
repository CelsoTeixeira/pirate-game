export type PoiSize = 'small' | 'medium' | 'big';

export type GeneratedWorldCell = Readonly<{
  x: number;
  y: number;
}>;

export type IslandIdentity = 'forested' | 'mountainous' | 'rocky' | 'tropical';

export type GeneratedPointOfInterest =
  | Readonly<{
    id: string;
    environment: 'land';
    kind: 'city' | 'trading-post' | 'fortress' | 'pirate-hub';
    size: PoiSize;
    x: number;
    y: number;
    islandId: number;
    occupiedCells: ReadonlyArray<GeneratedWorldCell>;
  }>
  | Readonly<{
    id: string;
    environment: 'water';
    kind: 'merchant-ship' | 'navy-patrol' | 'pirate-ship' | 'kraken' | 'ghost-ship' | 'siren-waters';
    size: PoiSize;
    x: number;
    y: number;
    occupiedCells: ReadonlyArray<GeneratedWorldCell>;
  }>;

export type SettlementModuleKind =
  | 'house'
  | 'market'
  | 'tower'
  | 'fortress-keep'
  | 'pirate-hideout'
  | 'dock'
  | 'warehouse';

export type NaturalFeatureKind =
  | 'tree-cluster'
  | 'palm-cluster'
  | 'mountain'
  | 'rock-cluster'
  | 'ruins'
  | 'treasure-shrine';

export type GeneratedIslandComposition = Readonly<{
  islandId: number;
  size: PoiSize;
  identity: IslandIdentity;
  cells: ReadonlyArray<GeneratedWorldCell>;
}>;

export type GeneratedSettlementModule = Readonly<{
  id: string;
  pointOfInterestId: string;
  islandId: number;
  kind: SettlementModuleKind;
  x: number;
  y: number;
  occupiedCells: ReadonlyArray<GeneratedWorldCell>;
}>;

export type GeneratedNaturalFeature = Readonly<{
  id: string;
  islandId: number;
  kind: NaturalFeatureKind;
  source: 'dominant' | 'unique';
  x: number;
  y: number;
  occupiedCells: ReadonlyArray<GeneratedWorldCell>;
}>;

export type GeneratedWorldDecorations = Readonly<{
  islandCompositions: ReadonlyArray<GeneratedIslandComposition>;
  pointsOfInterest: ReadonlyArray<GeneratedPointOfInterest>;
  settlementModules: ReadonlyArray<GeneratedSettlementModule>;
  naturalFeatures: ReadonlyArray<GeneratedNaturalFeature>;
}>;

type LandPointOfInterest = Extract<GeneratedPointOfInterest, { environment: 'land' }>;
type WaterPointOfInterest = Extract<GeneratedPointOfInterest, { environment: 'water' }>;
type LandPoiPlan = Readonly<Pick<LandPointOfInterest, 'kind' | 'size'>>;
type WaterPoiPlan = Readonly<Pick<WaterPointOfInterest, 'kind' | 'size'>>;
type IslandCells = Readonly<{
  id: number;
  cells: ReadonlyArray<number>;
}>;
type ModuleConstraint = 'water-adjacency';
type SettlementModuleRule = Readonly<{
  kind: SettlementModuleKind;
  identities: ReadonlyArray<IslandIdentity>;
  constraints?: ReadonlyArray<ModuleConstraint>;
}>;

const LAND_POI_COUNT = 24;
const WATER_POI_COUNT = 12;
const MINI_ISLAND_POPULATION_CAP = 0.3;
const POI_LAYOUT_SEED_SALT = 0xa53c_91e5;
const MODULE_LAYOUT_SEED_SALT = 0x7f4a_7c15;
const NATURAL_FEATURE_SEED_SALT = 0x4d3c_2b1a;
const WATER_LAYOUT_SEED_SALT = 0x91e5_a53c;
const WATER_COAST_CLEARANCE = 3;
const WATER_ENCOUNTER_MINIMUM_SPACING = 16;

const ISLAND_IDENTITIES: ReadonlyArray<IslandIdentity> = [
  'forested',
  'mountainous',
  'rocky',
  'tropical',
];

const LAND_KINDS: ReadonlyArray<LandPointOfInterest['kind']> = [
  'city',
  'trading-post',
  'fortress',
  'pirate-hub',
];

const SETTLEMENT_COMPATIBLE_IDENTITIES: Readonly<Record<LandPointOfInterest['kind'], ReadonlyArray<IslandIdentity>>> = Object.freeze({
  city: ['forested', 'tropical'],
  'trading-post': ['forested', 'mountainous', 'rocky', 'tropical'],
  fortress: ['mountainous', 'rocky'],
  'pirate-hub': ['forested', 'mountainous', 'rocky', 'tropical'],
});

/**
 * Complete one-cell modules are selected from this catalog. Constraints stay
 * data-driven so future harbour, hilltop, or ruin rules do not leak into the
 * layout algorithm.
 */
const SETTLEMENT_MODULE_RULES: Readonly<Record<LandPointOfInterest['kind'], ReadonlyArray<SettlementModuleRule>>> = Object.freeze({
  city: [
    { kind: 'house', identities: ['forested', 'tropical'] },
    { kind: 'market', identities: ['forested', 'tropical'] },
    { kind: 'dock', identities: ['forested', 'tropical'], constraints: ['water-adjacency'] },
  ],
  'trading-post': [
    { kind: 'house', identities: ['forested', 'mountainous', 'rocky', 'tropical'] },
    { kind: 'market', identities: ['forested', 'rocky', 'tropical'] },
    { kind: 'warehouse', identities: ['forested', 'mountainous', 'rocky', 'tropical'] },
  ],
  fortress: [
    { kind: 'tower', identities: ['mountainous', 'rocky'] },
    { kind: 'fortress-keep', identities: ['mountainous', 'rocky'] },
    { kind: 'warehouse', identities: ['mountainous', 'rocky'] },
  ],
  'pirate-hub': [
    { kind: 'pirate-hideout', identities: ['forested', 'mountainous', 'rocky', 'tropical'] },
    { kind: 'tower', identities: ['forested', 'mountainous', 'rocky', 'tropical'] },
    { kind: 'warehouse', identities: ['forested', 'mountainous', 'rocky', 'tropical'] },
  ],
});

const REPEATABLE_MODULE_KINDS: Readonly<Record<LandPointOfInterest['kind'], ReadonlyArray<SettlementModuleKind>>> = Object.freeze({
  city: ['house'],
  'trading-post': ['house', 'warehouse'],
  fortress: ['tower'],
  'pirate-hub': ['tower', 'warehouse'],
});

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

const NATURAL_KIND_BY_IDENTITY: Readonly<Record<IslandIdentity, NaturalFeatureKind>> = Object.freeze({
  forested: 'tree-cluster',
  mountainous: 'mountain',
  rocky: 'rock-cluster',
  tropical: 'palm-cluster',
});

/**
 * Generates all visual world decoration records after terrain has been made.
 * This function is pure: terrain receives no random state from this layer,
 * and each layout concern owns a salted deterministic stream.
 */
export function generateWorldDecorations(
  seed: number,
  width: number,
  height: number,
  islandIds: ArrayLike<number>,
): GeneratedWorldDecorations {
  validateInput(width, height, islandIds);

  const islands = collectIslandCells(islandIds);
  const islandCompositions = createIslandCompositions(seed, width, islands);
  const landResult = generateLandPointsAndModules(
    seed,
    width,
    height,
    islandIds,
    islandCompositions,
  );
  const naturalFeatures = generateNaturalFeatures(
    seed,
    width,
    islandCompositions,
    landResult.points,
    landResult.modules,
  );
  const waterPoints = generateWaterPoints(seed, width, height, islandIds);

  return Object.freeze({
    islandCompositions: Object.freeze(islandCompositions),
    pointsOfInterest: Object.freeze([...landResult.points, ...waterPoints]),
    settlementModules: Object.freeze(landResult.modules),
    naturalFeatures: Object.freeze(naturalFeatures),
  });
}

/** Retained as the narrow POI-only entry point for callers that do not need decorations. */
export function generatePointsOfInterest(
  seed: number,
  width: number,
  height: number,
  islandIds: ArrayLike<number>,
): ReadonlyArray<GeneratedPointOfInterest> {
  return generateWorldDecorations(seed, width, height, islandIds).pointsOfInterest;
}

function validateInput(width: number, height: number, islandIds: ArrayLike<number>) {
  if (islandIds.length !== width * height) {
    throw new Error(
      `Unable to generate world decorations: expected ${width * height} island cells, `
        + `received ${islandIds.length}.`,
    );
  }
}

function createIslandCompositions(
  seed: number,
  width: number,
  islands: ReadonlyArray<IslandCells>,
): GeneratedIslandComposition[] {
  const identityOffset = hashToInteger(seed ^ POI_LAYOUT_SEED_SALT, ISLAND_IDENTITIES.length);
  return islands.map((island, index) => Object.freeze({
    islandId: island.id,
    size: getIslandSize(island.cells.length),
    identity: ISLAND_IDENTITIES[(identityOffset + index) % ISLAND_IDENTITIES.length],
    cells: Object.freeze(island.cells.map((cellIndex) => cellFromIndex(cellIndex, width))),
  }));
}

function generateLandPointsAndModules(
  seed: number,
  width: number,
  height: number,
  islandIds: ArrayLike<number>,
  compositions: ReadonlyArray<GeneratedIslandComposition>,
): Readonly<{
  points: ReadonlyArray<LandPointOfInterest>;
  modules: ReadonlyArray<GeneratedSettlementModule>;
}> {
  const random = createSeededRandom((seed ^ POI_LAYOUT_SEED_SALT) >>> 0);
  const usedIslandIds = new Set<number>();
  const points: LandPointOfInterest[] = [];
  const modules: GeneratedSettlementModule[] = [];

  createLandPoiPlans().forEach((plan, index) => {
    const eligibleIslands = compositions.filter((island) => (
      !usedIslandIds.has(island.islandId)
      && isIslandEligibleForPoi(island, plan.size)
      && SETTLEMENT_COMPATIBLE_IDENTITIES[plan.kind].includes(island.identity)
    ));

    if (eligibleIslands.length === 0) {
      throw new Error(
        `Unable to place all ${LAND_POI_COUNT} land points of interest: no unused island is eligible `
          + `for ${plan.size} ${plan.kind} placement ${index + 1}.`,
      );
    }

    const island = eligibleIslands[randomInteger(random, 0, eligibleIslands.length - 1)];
    usedIslandIds.add(island.islandId);
    const occupiedCells = plan.size === 'small'
      ? [findCellNearestCentroid(island.cells, width)]
      : [...island.cells];
    const anchor = findCellNearestCentroid(occupiedCells, width);
    const point = Object.freeze({
      id: `land-${String(index + 1).padStart(3, '0')}`,
      environment: 'land' as const,
      kind: plan.kind,
      size: plan.size,
      x: anchor.x,
      y: anchor.y,
      islandId: island.islandId,
      occupiedCells: Object.freeze(occupiedCells),
    });
    points.push(point);
    modules.push(...generateSettlementModules(
      seed,
      width,
      height,
      islandIds,
      island,
      point,
    ));
  });

  return Object.freeze({
    points: Object.freeze(points),
    modules: Object.freeze(modules),
  });
}

function createLandPoiPlans(): LandPoiPlan[] {
  const plans: LandPoiPlan[] = [];

  (['big', 'medium', 'small'] as const).forEach((size) => {
    const repetitions = size === 'big' ? 1 : size === 'medium' ? 2 : 3;
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      LAND_KINDS.forEach((kind) => plans.push({ kind, size }));
    }
  });

  return plans;
}

function generateSettlementModules(
  seed: number,
  width: number,
  height: number,
  islandIds: ArrayLike<number>,
  island: GeneratedIslandComposition,
  point: LandPointOfInterest,
): ReadonlyArray<GeneratedSettlementModule> {
  const rules = shuffleValues(
    SETTLEMENT_MODULE_RULES[point.kind].filter((rule) => rule.identities.includes(island.identity)),
    createSeededRandom((seed ^ MODULE_LAYOUT_SEED_SALT ^ Math.imul(point.islandId, 0x9e3779b1)) >>> 0),
  );
  const random = createSeededRandom((seed ^ MODULE_LAYOUT_SEED_SALT ^ Math.imul(point.islandId, 0x85ebca6b)) >>> 0);
  const usedCells = new Set<number>();
  const modules: GeneratedSettlementModule[] = [];
  const targetCount = point.size === 'small'
    ? 1
    : point.size === 'medium'
      ? 2 + randomInteger(random, 0, 1)
      : 3 + randomInteger(random, 0, 2);

  for (const rule of rules) {
    if (modules.length >= targetCount) {
      break;
    }

    const candidates = island.cells
      .map((cell) => cell.x + cell.y * width)
      .filter((cellIndex) => (
        !usedCells.has(cellIndex)
        && satisfiesModuleConstraints(rule, cellIndex, width, height, islandIds)
      ));
    if (rule.kind === 'dock') {
      const dockCandidates = candidates.flatMap((landCellIndex) => (
        getCardinalNeighbors(landCellIndex, width, height)
          .filter((waterCellIndex) => islandIds[waterCellIndex] === 0 && !usedCells.has(waterCellIndex))
          .map((waterCellIndex) => ({ landCellIndex, waterCellIndex }))
      ));
      const dockPlacement = dockCandidates.length > 0
        ? dockCandidates[randomInteger(random, 0, dockCandidates.length - 1)]
        : undefined;
      if (dockPlacement) {
        usedCells.add(dockPlacement.landCellIndex);
        usedCells.add(dockPlacement.waterCellIndex);
        modules.push(createSettlementModule(
          point,
          island.islandId,
          'dock',
          cellFromIndex(dockPlacement.waterCellIndex, width),
          [
            cellFromIndex(dockPlacement.landCellIndex, width),
            cellFromIndex(dockPlacement.waterCellIndex, width),
          ],
          modules.length,
        ));
      }
      continue;
    }

    if (candidates.length > 0) {
      const cellIndex = candidates[randomInteger(random, 0, candidates.length - 1)];
      usedCells.add(cellIndex);
      const cell = cellFromIndex(cellIndex, width);
      modules.push(createSettlementModule(
        point,
        island.islandId,
        rule.kind,
        cell,
        [cell],
        modules.length,
      ));
    }
  }

  const repeatableKinds = REPEATABLE_MODULE_KINDS[point.kind];
  while (modules.length < targetCount && repeatableKinds.length > 0) {
    const kind = repeatableKinds[randomInteger(random, 0, repeatableKinds.length - 1)];
    const candidates = island.cells
      .map((cell) => cell.x + cell.y * width)
      .filter((cellIndex) => !usedCells.has(cellIndex));
    if (candidates.length === 0) {
      break;
    }

    const cellIndex = candidates[randomInteger(random, 0, candidates.length - 1)];
    usedCells.add(cellIndex);
    const cell = cellFromIndex(cellIndex, width);
    modules.push(createSettlementModule(
      point,
      island.islandId,
      kind,
      cell,
      [cell],
      modules.length,
    ));
  }

  return Object.freeze(modules);
}

function createSettlementModule(
  point: LandPointOfInterest,
  islandId: number,
  kind: SettlementModuleKind,
  anchor: GeneratedWorldCell,
  occupiedCells: ReadonlyArray<GeneratedWorldCell>,
  moduleIndex: number,
): GeneratedSettlementModule {
  return Object.freeze({
    id: `${point.id}-module-${String(moduleIndex + 1).padStart(2, '0')}`,
    pointOfInterestId: point.id,
    islandId,
    kind,
    x: anchor.x,
    y: anchor.y,
    occupiedCells: Object.freeze(occupiedCells),
  });
}

function satisfiesModuleConstraints(
  rule: SettlementModuleRule,
  cellIndex: number,
  width: number,
  height: number,
  islandIds: ArrayLike<number>,
): boolean {
  if (!rule.constraints?.includes('water-adjacency')) {
    return true;
  }

  return getCardinalNeighbors(cellIndex, width, height)
    .some((neighborIndex) => islandIds[neighborIndex] === 0);
}

function generateNaturalFeatures(
  seed: number,
  width: number,
  compositions: ReadonlyArray<GeneratedIslandComposition>,
  points: ReadonlyArray<LandPointOfInterest>,
  modules: ReadonlyArray<GeneratedSettlementModule>,
): ReadonlyArray<GeneratedNaturalFeature> {
  const features: GeneratedNaturalFeature[] = [];
  const reservedCellsByIsland = collectReservedCells(modules, width);
  const random = createSeededRandom((seed ^ NATURAL_FEATURE_SEED_SALT) >>> 0);

  compositions
    .filter((island) => island.size !== 'small')
    .forEach((island) => {
      const reservedCells = reservedCellsByIsland.get(island.islandId) ?? new Set<number>();
      const naturalKind = NATURAL_KIND_BY_IDENTITY[island.identity];
      island.cells.forEach((cell) => {
        const cellIndex = cell.y * width + cell.x;
        if (reservedCells.has(cellIndex)) {
          return;
        }
        features.push(createNaturalFeature(
          features.length,
          island.islandId,
          naturalKind,
          'dominant',
          cell,
        ));
      });
    });

  const smallIslands = compositions.filter((island) => island.size === 'small');
  const smallSettlementIslandIds = new Set(
    points.filter((point) => point.size === 'small').map((point) => point.islandId),
  );
  const populationCap = Math.floor(smallIslands.length * MINI_ISLAND_POPULATION_CAP);
  if (smallSettlementIslandIds.size > populationCap) {
    throw new Error('Small-island settlement population exceeds the generated feature cap.');
  }

  const candidates = smallIslands
    .filter((island) => !smallSettlementIslandIds.has(island.islandId))
    .sort((first, second) => (
      hashToUnitInterval(seed ^ NATURAL_FEATURE_SEED_SALT, first.islandId)
      - hashToUnitInterval(seed ^ NATURAL_FEATURE_SEED_SALT, second.islandId)
    ));
  const selectedCount = Math.max(0, populationCap - smallSettlementIslandIds.size);
  candidates.slice(0, selectedCount).forEach((island) => {
    const roll = random();
    if (roll < 0.4) {
      return;
    }

    const cell = findCellNearestCentroid(island.cells, width);
    const kind = roll < 0.95
      ? NATURAL_KIND_BY_IDENTITY[island.identity]
      : random() < 0.5 ? 'ruins' : 'treasure-shrine';
    features.push(createNaturalFeature(
      features.length,
      island.islandId,
      kind,
      kind === 'ruins' || kind === 'treasure-shrine' ? 'unique' : 'dominant',
      cell,
    ));
  });

  return Object.freeze(features);
}

function collectReservedCells(
  modules: ReadonlyArray<GeneratedSettlementModule>,
  width: number,
): Map<number, Set<number>> {
  const reserved = new Map<number, Set<number>>();
  modules.forEach((module) => {
    const cells = reserved.get(module.islandId) ?? new Set<number>();
    module.occupiedCells.forEach((cell) => cells.add(cell.y * width + cell.x));
    reserved.set(module.islandId, cells);
  });
  return reserved;
}

function createNaturalFeature(
  index: number,
  islandId: number,
  kind: NaturalFeatureKind,
  source: GeneratedNaturalFeature['source'],
  cell: GeneratedWorldCell,
): GeneratedNaturalFeature {
  return Object.freeze({
    id: `natural-${String(index + 1).padStart(3, '0')}`,
    islandId,
    kind,
    source,
    x: cell.x,
    y: cell.y,
    occupiedCells: Object.freeze([cell]),
  });
}

function generateWaterPoints(
  seed: number,
  width: number,
  height: number,
  islandIds: ArrayLike<number>,
): ReadonlyArray<WaterPointOfInterest> {
  const random = createSeededRandom((seed ^ WATER_LAYOUT_SEED_SALT) >>> 0);
  const placements = new Map<PoiSize, number[][]>();
  const selectedCells: number[] = [];

  (['big', 'medium', 'small'] as const).forEach((size) => {
    const count = WATER_POI_PLANS.filter((plan) => plan.size === size).length;
    const sizePlacements: number[][] = [];
    const candidates = createWaterCandidates(width, height, size, random);
    for (let placementIndex = 0; placementIndex < count; placementIndex += 1) {
      const footprint = candidates.find((candidate) => (
        isValidWaterFootprint(candidate, width, height, islandIds)
        && isSeparatedFromSelectedFootprints(candidate, selectedCells, width)
      ));
      if (!footprint) {
        throw new Error(
          `Unable to place all ${WATER_POI_COUNT} water encounters: no ${size} footprint remains.`,
        );
      }
      sizePlacements.push(footprint);
      selectedCells.push(...footprint);
      candidates.splice(candidates.indexOf(footprint), 1);
    }
    placements.set(size, sizePlacements);
  });

  const placementCursor: Record<PoiSize, number> = { small: 0, medium: 0, big: 0 };
  return WATER_POI_PLANS.map((plan, index) => {
    const footprintIndices = placements.get(plan.size);
    if (!footprintIndices) {
      throw new Error(`Water POI size ${plan.size} has no generated footprint bucket.`);
    }
    const footprint = footprintIndices[placementCursor[plan.size]];
    placementCursor[plan.size] += 1;
    const occupiedCells = footprint.map((cellIndex) => cellFromIndex(cellIndex, width));
    const anchor = findCellNearestCentroid(occupiedCells, width);
    return Object.freeze({
      id: `water-${String(index + 1).padStart(3, '0')}`,
      environment: 'water' as const,
      kind: plan.kind,
      size: plan.size,
      x: anchor.x,
      y: anchor.y,
      occupiedCells: Object.freeze(occupiedCells),
    });
  });
}

function createWaterCandidates(
  width: number,
  height: number,
  size: PoiSize,
  random: () => number,
): number[][] {
  const candidates: number[][] = [];
  const offsets = getWaterFootprintOffsets(size);
  const maximumOffsetX = Math.max(...offsets.map(([x]) => x));
  const maximumOffsetY = Math.max(...offsets.map(([, y]) => y));

  for (let y = WATER_COAST_CLEARANCE; y < height - WATER_COAST_CLEARANCE - maximumOffsetY; y += 1) {
    for (let x = WATER_COAST_CLEARANCE; x < width - WATER_COAST_CLEARANCE - maximumOffsetX; x += 1) {
      candidates.push(offsets.map(([offsetX, offsetY]) => (
        (y + offsetY) * width + x + offsetX
      )));
    }
  }
  shuffle(candidates, random);
  return candidates;
}

function getWaterFootprintOffsets(size: PoiSize): ReadonlyArray<readonly [number, number]> {
  if (size === 'small') {
    return [[0, 0]];
  }
  if (size === 'medium') {
    return [[0, 0], [1, 0], [0, 1], [1, 1]];
  }
  return [
    [1, 0], [2, 0],
    [0, 1], [1, 1], [2, 1], [3, 1],
    [0, 2], [1, 2], [2, 2], [3, 2],
    [0, 3], [1, 3], [2, 3], [3, 3],
  ];
}

function isValidWaterFootprint(
  footprint: ReadonlyArray<number>,
  width: number,
  height: number,
  islandIds: ArrayLike<number>,
): boolean {
  return footprint.every((cellIndex) => {
    const x = cellIndex % width;
    const y = Math.floor(cellIndex / width);
    return x >= 0
      && x < width
      && y >= 0
      && y < height
      && !hasLandWithinClearance(x, y, width, height, islandIds);
  });
}

function isSeparatedFromSelectedFootprints(
  candidate: ReadonlyArray<number>,
  selectedCells: ReadonlyArray<number>,
  width: number,
): boolean {
  return candidate.every((firstCell) => selectedCells.every((secondCell) => {
    const deltaX = firstCell % width - secondCell % width;
    const deltaY = Math.floor(firstCell / width) - Math.floor(secondCell / width);
    return deltaX * deltaX + deltaY * deltaY
      >= WATER_ENCOUNTER_MINIMUM_SPACING * WATER_ENCOUNTER_MINIMUM_SPACING;
  }));
}

function hasLandWithinClearance(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  islandIds: ArrayLike<number>,
): boolean {
  for (let offsetY = -WATER_COAST_CLEARANCE; offsetY <= WATER_COAST_CLEARANCE; offsetY += 1) {
    for (let offsetX = -WATER_COAST_CLEARANCE; offsetX <= WATER_COAST_CLEARANCE; offsetX += 1) {
      const x = centerX + offsetX;
      const y = centerY + offsetY;
      if (x >= 0 && x < width && y >= 0 && y < height && islandIds[y * width + x] !== 0) {
        return true;
      }
    }
  }
  return false;
}

function collectIslandCells(islandIds: ArrayLike<number>): IslandCells[] {
  const cellsByIsland = new Map<number, number[]>();
  for (let cellIndex = 0; cellIndex < islandIds.length; cellIndex += 1) {
    const islandId = islandIds[cellIndex];
    if (islandId === 0) continue;
    const cells = cellsByIsland.get(islandId);
    if (cells) cells.push(cellIndex);
    else cellsByIsland.set(islandId, [cellIndex]);
  }
  return Array.from(cellsByIsland, ([id, cells]) => ({ id, cells }));
}

function getIslandSize(cellCount: number): PoiSize {
  if (cellCount === 14) return 'big';
  if (cellCount >= 4) return 'medium';
  return 'small';
}

function isIslandEligibleForPoi(
  island: GeneratedIslandComposition,
  size: PoiSize,
): boolean {
  if (size === 'big') return island.size === 'big';
  if (size === 'medium') return island.size === 'medium';
  return island.size === 'small';
}

function findCellNearestCentroid(
  cells: ReadonlyArray<GeneratedWorldCell>,
  width: number,
): GeneratedWorldCell {
  let totalX = 0;
  let totalY = 0;
  cells.forEach((cell) => {
    totalX += cell.x;
    totalY += cell.y;
  });
  const centroidX = totalX / cells.length;
  const centroidY = totalY / cells.length;
  return cells.reduce((nearestCell, cell) => {
    const nearestDistance = distanceSquared(nearestCell, centroidX, centroidY);
    const cellDistance = distanceSquared(cell, centroidX, centroidY);
    const nearestIndex = nearestCell.y * width + nearestCell.x;
    const cellIndex = cell.y * width + cell.x;
    return cellDistance < nearestDistance
      || (cellDistance === nearestDistance && cellIndex < nearestIndex)
      ? cell
      : nearestCell;
  });
}

function distanceSquared(cell: GeneratedWorldCell, targetX: number, targetY: number) {
  return (cell.x - targetX) ** 2 + (cell.y - targetY) ** 2;
}

function cellFromIndex(cellIndex: number, width: number): GeneratedWorldCell {
  return Object.freeze({ x: cellIndex % width, y: Math.floor(cellIndex / width) });
}

function getCardinalNeighbors(cellIndex: number, width: number, height: number): number[] {
  const x = cellIndex % width;
  const y = Math.floor(cellIndex / width);
  const neighbors: number[] = [];
  if (x > 0) neighbors.push(cellIndex - 1);
  if (x + 1 < width) neighbors.push(cellIndex + 1);
  if (y > 0) neighbors.push(cellIndex - width);
  if (y + 1 < height) neighbors.push(cellIndex + width);
  return neighbors;
}

function shuffle<T>(values: T[], random: () => number) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(random, 0, index);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
}

function shuffleValues<T>(values: ReadonlyArray<T>, random: () => number): T[] {
  const copy = [...values];
  shuffle(copy, random);
  return copy;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
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

function hashToInteger(seed: number, modulus: number): number {
  return Math.floor(hashToUnitInterval(seed, modulus) * modulus);
}

function hashToUnitInterval(seed: number, value: number): number {
  let hash = seed ^ Math.imul(value, 0x9e3779b1);
  hash = Math.imul(hash ^ (hash >>> 16), 0x21f0aaad);
  hash = Math.imul(hash ^ (hash >>> 15), 0x735a2d97);
  return ((hash ^ (hash >>> 15)) >>> 0) / 0x1_0000_0000;
}
