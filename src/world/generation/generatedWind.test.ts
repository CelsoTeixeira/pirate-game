import {
  generateArchipelago,
  DEFAULT_ARCHIPELAGO_CONFIG,
} from './archipelago.ts';
import {
  sampleGeneratedWind,
  type GeneratedWind,
  type GeneratedWindSample,
} from './wind.ts';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const first = generateArchipelago(0x51a7d, DEFAULT_ARCHIPELAGO_CONFIG);
const second = generateArchipelago(0x51a7d, DEFAULT_ARCHIPELAGO_CONFIG);
assert(DEFAULT_ARCHIPELAGO_CONFIG.width === 64, 'default generation width must be 64 cells');
assert(DEFAULT_ARCHIPELAGO_CONFIG.height === 64, 'default generation height must be 64 cells');
assert(first.islandCompositions.length === 56, '64x64 generation must place 56 islands');
assert(
  first.pointsOfInterest.filter((point) => point.environment === 'land').length === 24,
  'generation must retain 24 land points of interest',
);
assert(
  first.pointsOfInterest.filter((point) => point.environment === 'water').length === 12,
  'generation must retain 12 water points of interest',
);
assert(
  JSON.stringify(first) === JSON.stringify(second),
  'the same archipelago seed must generate the same world decorations',
);
assert(
  JSON.stringify(first.wind) === JSON.stringify(second.wind),
  'the same archipelago seed must generate the same wind loops',
);
assert(first.wind.loops.length > 0, 'generated wind must include at least one loop');

const anchorPoints = first.pointsOfInterest.filter((point) => point.environment === 'water');
const ambient = sampleGeneratedWind(first.wind, 128 * 64, 128 * 64, 64);
assertSample(ambient, 'ambient sampling');
assert(ambient.strength === 0, 'outside every corridor must be calm');

anchorPoints.forEach((anchor) => {
  const routeSample = sampleGeneratedWind(
    first.wind,
    (anchor.x + 0.5) * 64,
    (anchor.y + 0.5) * 64,
    64,
  );
  assertSample(routeSample, `anchor ${anchor.id} sampling`);
  assert(routeSample.strength > 0, `anchor ${anchor.id} must sample corridor wind`);
});

const syntheticWind: GeneratedWind = Object.freeze({
  width: 16,
  height: 16,
  ambientDirectionRad: 0.4,
  loops: Object.freeze([Object.freeze({
    id: 'fixture-loop',
    points: Object.freeze([
      Object.freeze({ x: 4, y: 4 }),
      Object.freeze({ x: 8, y: 4 }),
      Object.freeze({ x: 8, y: 8 }),
    ]),
    strength: 0.9,
    corridorRadius: 2,
  })]),
});
const outside = sampleGeneratedWind(syntheticWind, 0, 0, 1);
assertSample(outside, 'outside-corridor sampling');
assert(outside.strength === 0, 'outside corridor must return zero strength');
assert(outside.directionRad === syntheticWind.ambientDirectionRad, 'outside corridor must return ambient direction');

const edge = sampleGeneratedWind(syntheticWind, 4, 7, 1);
assert(edge.strength === 0, 'corridor edge must return zero strength');
const inside = sampleGeneratedWind(syntheticWind, 4, 6, 1);
assert(inside.strength > 0 && inside.strength < 0.9, 'corridor interior must smoothly rise above zero');
const centerline = sampleGeneratedWind(syntheticWind, 4, 4, 1);
assert(centerline.strength === 0.9, 'corridor centerline must return full loop strength');

for (let seed = 0; seed < 1000; seed += 1) {
  const world = generateArchipelago(seed, DEFAULT_ARCHIPELAGO_CONFIG);
  assert(world.islandCompositions.length === 56, `seed ${seed} must place all 56 islands`);
  assert(world.pointsOfInterest.length === 36, `seed ${seed} must place all 36 points of interest`);
  assert(
    world.pointsOfInterest.filter((point) => point.environment === 'land').length === 24,
    `seed ${seed} must place 24 land points of interest`,
  );
  assert(
    world.pointsOfInterest.filter((point) => point.environment === 'water').length === 12,
    `seed ${seed} must place 12 water points of interest`,
  );
}

function assertSample(sample: GeneratedWindSample, label: string) {
  assert(Number.isFinite(sample.directionRad), `${label} direction must be finite`);
  assert(sample.strength >= 0 && sample.strength <= 1, `${label} strength must be clamped`);
}

console.log('generated wind behavior passed');
