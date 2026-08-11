export type OrientedHullPose = Readonly<{
  x: number;
  y: number;
  rotation: number;
}>;

export type OrientedHullFootprint = Readonly<{
  width: number;
  length: number;
}>;

export type LandCollisionGrid = Readonly<{
  width: number;
  height: number;
  tileSize: number;
  landMask: ReadonlyArray<boolean>;
}>;

export type HullPoint = Readonly<{
  x: number;
  y: number;
}>;

const COLLISION_EPSILON = 0.001;

/**
 * Returns the four world-space corners of a hull whose long axis points along
 * local Y. This matches the orientation of the modular ship artwork.
 */
export function getOrientedHullCorners(
  pose: OrientedHullPose,
  footprint: OrientedHullFootprint,
): readonly HullPoint[] {
  const halfWidth = footprint.width / 2;
  const halfLength = footprint.length / 2;
  const cosine = Math.cos(pose.rotation);
  const sine = Math.sin(pose.rotation);

  return [
    rotateLocalPoint(-halfWidth, -halfLength, pose, cosine, sine),
    rotateLocalPoint(halfWidth, -halfLength, pose, cosine, sine),
    rotateLocalPoint(halfWidth, halfLength, pose, cosine, sine),
    rotateLocalPoint(-halfWidth, halfLength, pose, cosine, sine),
  ];
}

/**
 * Checks only the land cells covered by the hull's world-space bounds. Cells
 * outside the map are solid, so the same footprint also enforces world bounds.
 */
export function orientedHullOverlapsLand(
  pose: OrientedHullPose,
  footprint: OrientedHullFootprint,
  grid: LandCollisionGrid,
): boolean {
  const corners = getOrientedHullCorners(pose, footprint);
  const minimumX = Math.min(...corners.map((point) => point.x));
  const maximumX = Math.max(...corners.map((point) => point.x));
  const minimumY = Math.min(...corners.map((point) => point.y));
  const maximumY = Math.max(...corners.map((point) => point.y));
  const worldWidth = grid.width * grid.tileSize;
  const worldHeight = grid.height * grid.tileSize;

  if (
    minimumX < 0
    || minimumY < 0
    || maximumX > worldWidth
    || maximumY > worldHeight
  ) {
    return true;
  }

  const firstTileX = Math.max(0, Math.floor(minimumX / grid.tileSize));
  const lastTileX = Math.min(grid.width - 1, Math.floor(maximumX / grid.tileSize));
  const firstTileY = Math.max(0, Math.floor(minimumY / grid.tileSize));
  const lastTileY = Math.min(grid.height - 1, Math.floor(maximumY / grid.tileSize));

  for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
    for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
      if (
        grid.landMask[tileY * grid.width + tileX]
        && orientedRectangleOverlapsTile(pose, footprint, tileX, tileY, grid.tileSize)
      ) {
        return true;
      }
    }
  }

  return false;
}

function orientedRectangleOverlapsTile(
  pose: OrientedHullPose,
  footprint: OrientedHullFootprint,
  tileX: number,
  tileY: number,
  tileSize: number,
): boolean {
  const halfWidth = footprint.width / 2;
  const halfLength = footprint.length / 2;
  const halfTile = tileSize / 2;
  const tileCenterX = (tileX + 0.5) * tileSize;
  const tileCenterY = (tileY + 0.5) * tileSize;
  const deltaX = tileCenterX - pose.x;
  const deltaY = tileCenterY - pose.y;
  const cosine = Math.cos(pose.rotation);
  const sine = Math.sin(pose.rotation);

  // Separating-axis test for an oriented rectangle against an axis-aligned tile.
  const hullLocalCenterX = deltaX * cosine + deltaY * sine;
  const hullLocalCenterY = -deltaX * sine + deltaY * cosine;
  const tileRadiusOnHullX = halfTile * (Math.abs(cosine) + Math.abs(sine));
  const tileRadiusOnHullY = tileRadiusOnHullX;

  if (Math.abs(hullLocalCenterX) >= halfWidth + tileRadiusOnHullX - COLLISION_EPSILON) {
    return false;
  }
  if (Math.abs(hullLocalCenterY) >= halfLength + tileRadiusOnHullY - COLLISION_EPSILON) {
    return false;
  }

  const hullRadiusOnWorldX = halfWidth * Math.abs(cosine) + halfLength * Math.abs(sine);
  const hullRadiusOnWorldY = halfWidth * Math.abs(sine) + halfLength * Math.abs(cosine);
  if (Math.abs(deltaX) >= hullRadiusOnWorldX + halfTile - COLLISION_EPSILON) {
    return false;
  }
  if (Math.abs(deltaY) >= hullRadiusOnWorldY + halfTile - COLLISION_EPSILON) {
    return false;
  }

  return true;
}

function rotateLocalPoint(
  localX: number,
  localY: number,
  pose: OrientedHullPose,
  cosine: number,
  sine: number,
): HullPoint {
  return {
    x: pose.x + localX * cosine - localY * sine,
    y: pose.y + localX * sine + localY * cosine,
  };
}
