import type { GeneratedArchipelago } from '../generation/archipelago';

export const BLOB_NEIGHBOR = Object.freeze({
  north: 1 << 0,
  east: 1 << 1,
  south: 1 << 2,
  west: 1 << 3,
  northEast: 1 << 4,
  southEast: 1 << 5,
  southWest: 1 << 6,
  northWest: 1 << 7,
});

export function normalizeBlobMask(mask: number): number {
  let normalized = mask & 0xff;

  if ((normalized & (BLOB_NEIGHBOR.north | BLOB_NEIGHBOR.east))
    !== (BLOB_NEIGHBOR.north | BLOB_NEIGHBOR.east)) {
    normalized &= ~BLOB_NEIGHBOR.northEast;
  }
  if ((normalized & (BLOB_NEIGHBOR.south | BLOB_NEIGHBOR.east))
    !== (BLOB_NEIGHBOR.south | BLOB_NEIGHBOR.east)) {
    normalized &= ~BLOB_NEIGHBOR.southEast;
  }
  if ((normalized & (BLOB_NEIGHBOR.south | BLOB_NEIGHBOR.west))
    !== (BLOB_NEIGHBOR.south | BLOB_NEIGHBOR.west)) {
    normalized &= ~BLOB_NEIGHBOR.southWest;
  }
  if ((normalized & (BLOB_NEIGHBOR.north | BLOB_NEIGHBOR.west))
    !== (BLOB_NEIGHBOR.north | BLOB_NEIGHBOR.west)) {
    normalized &= ~BLOB_NEIGHBOR.northWest;
  }

  return normalized;
}

export const VALID_BLOB_MASKS: ReadonlyArray<number> = Object.freeze(
  Array.from(
    new Set(Array.from({ length: 256 }, (_, mask) => normalizeBlobMask(mask))),
  ).sort((left, right) => left - right),
);

const FRAME_BY_MASK = new Map(VALID_BLOB_MASKS.map((mask, frame) => [mask, frame]));

export function blobMaskToFrame(mask: number): number {
  const frame = FRAME_BY_MASK.get(normalizeBlobMask(mask));
  if (frame === undefined) {
    throw new Error(`No blob tile frame exists for neighbor mask ${mask}.`);
  }
  return frame;
}

export function getLandNeighborMask(
  landMask: ReadonlyArray<boolean>,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  let mask = 0;
  const isLand = (offsetX: number, offsetY: number) => {
    const neighborX = x + offsetX;
    const neighborY = y + offsetY;
    return neighborX >= 0
      && neighborX < width
      && neighborY >= 0
      && neighborY < height
      && landMask[neighborY * width + neighborX] === true;
  };

  if (isLand(0, -1)) mask |= BLOB_NEIGHBOR.north;
  if (isLand(1, 0)) mask |= BLOB_NEIGHBOR.east;
  if (isLand(0, 1)) mask |= BLOB_NEIGHBOR.south;
  if (isLand(-1, 0)) mask |= BLOB_NEIGHBOR.west;
  if (isLand(1, -1)) mask |= BLOB_NEIGHBOR.northEast;
  if (isLand(1, 1)) mask |= BLOB_NEIGHBOR.southEast;
  if (isLand(-1, 1)) mask |= BLOB_NEIGHBOR.southWest;
  if (isLand(-1, -1)) mask |= BLOB_NEIGHBOR.northWest;

  return normalizeBlobMask(mask);
}

export function buildTerrainTileIndices(
  archipelago: Pick<GeneratedArchipelago, 'width' | 'height' | 'landMask'>,
): number[][] {
  const rows: number[][] = [];

  for (let y = 0; y < archipelago.height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < archipelago.width; x += 1) {
      const index = y * archipelago.width + x;
      row.push(archipelago.landMask[index]
        ? blobMaskToFrame(getLandNeighborMask(
          archipelago.landMask,
          archipelago.width,
          archipelago.height,
          x,
          y,
        ))
        : -1);
    }
    rows.push(row);
  }

  return rows;
}
