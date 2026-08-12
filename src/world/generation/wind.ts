import type { GeneratedPointOfInterest } from './pointsOfInterest.ts';

export type GeneratedWindSample = Readonly<{
  directionRad: number;
  strength: number;
}>;

export type GeneratedWindPoint = Readonly<{
  x: number;
  y: number;
}>;

export type GeneratedWindLoop = Readonly<{
  id: string;
  points: ReadonlyArray<GeneratedWindPoint>;
  strength: number;
  corridorRadius: number;
}>;

export type GeneratedWind = Readonly<{
  width: number;
  height: number;
  ambientDirectionRad: number;
  loops: ReadonlyArray<GeneratedWindLoop>;
}>;

export type WindAnchor = Readonly<Pick<GeneratedPointOfInterest, 'id' | 'x' | 'y'>>;

const CORRIDOR_STRENGTH = 0.86;
const CORRIDOR_RADIUS = 14;
const WIND_SEED_SALT = 0x2c1b3c6d;

/**
 * Generates immutable, seed-stable water-current loops. Waypoints are stored
 * in generation-cell coordinates; sampling is the only place that converts
 * runtime world pixels back to those coordinates.
 */
export function generateWind(
  seed: number,
  width: number,
  height: number,
  anchors: ReadonlyArray<WindAnchor>,
): GeneratedWind {
  const waterPoints = [...anchors]
    .sort((first, second) => (
      first.y - second.y
      || first.x - second.x
      || first.id.localeCompare(second.id)
    ));
  const centerX = width / 2;
  const centerY = height / 2;
  const randomOffset = hashToUnitInterval((seed ^ WIND_SEED_SALT) >>> 0) * Math.PI * 2;
  const orderedPoints = [...waterPoints].sort((first, second) => {
    const firstAngle = Math.atan2(first.y - centerY, first.x - centerX) + randomOffset;
    const secondAngle = Math.atan2(second.y - centerY, second.x - centerX) + randomOffset;
    return firstAngle - secondAngle || first.id.localeCompare(second.id);
  });
  const loopPoints = orderedPoints.map((point) => Object.freeze({
    x: point.x + 0.5,
    y: point.y + 0.5,
  }));
  const loop = Object.freeze({
    id: 'water-discovery-loop',
    points: Object.freeze(loopPoints),
    strength: CORRIDOR_STRENGTH,
    corridorRadius: CORRIDOR_RADIUS,
  });

  return Object.freeze({
    width,
    height,
    ambientDirectionRad: normalizeAngle(randomOffset),
    loops: Object.freeze(loopPoints.length >= 3 ? [loop] : []),
  });
}

/**
 * Samples generated wind at a Phaser world position. The caller supplies the
 * runtime tile size; no scene or rendering dependency crosses this seam.
 */
export function sampleGeneratedWind(
  wind: GeneratedWind,
  worldX: number,
  worldY: number,
  tileSize: number,
): GeneratedWindSample {
  if (!Number.isFinite(tileSize) || tileSize <= 0) {
    throw new Error('Wind sampling requires a positive runtime tile size.');
  }

  const tileX = worldX / tileSize;
  const tileY = worldY / tileSize;
  let best: {
    distance: number;
    directionRad: number;
    strength: number;
    corridorRadius: number;
  } | undefined;

  for (const loop of wind.loops) {
    const candidate = sampleLoop(loop, tileX, tileY);
    if (!best || candidate.distance < best.distance) {
      best = candidate;
    }
  }

  if (!best || best.distance >= best.corridorRadius) {
    return Object.freeze({
      directionRad: wind.ambientDirectionRad,
      strength: 0,
    });
  }

  const falloff = 1 - best.distance / best.corridorRadius;
  return Object.freeze({
    directionRad: best.directionRad,
    strength: best.strength * falloff,
  });
}

function sampleLoop(
  loop: GeneratedWindLoop,
  x: number,
  y: number,
): { distance: number; directionRad: number; strength: number; corridorRadius: number } {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestDirection = 0;

  for (let index = 0; index < loop.points.length; index += 1) {
    const start = loop.points[index];
    const end = loop.points[(index + 1) % loop.points.length];
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const segmentLengthSquared = deltaX * deltaX + deltaY * deltaY;
    const projection = segmentLengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - start.x) * deltaX + (y - start.y) * deltaY) / segmentLengthSquared));
    const closestX = start.x + projection * deltaX;
    const closestY = start.y + projection * deltaY;
    const distance = Math.hypot(x - closestX, y - closestY);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestDirection = Math.atan2(deltaY, deltaX);
    }
  }

  return {
    distance: bestDistance,
    directionRad: normalizeAngle(bestDirection),
    strength: loop.strength,
    corridorRadius: loop.corridorRadius,
  };
}

function normalizeAngle(angle: number) {
  const fullTurn = Math.PI * 2;
  return ((angle + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
}

function hashToUnitInterval(seed: number) {
  let value = seed;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0x1_0000_0000;
}
