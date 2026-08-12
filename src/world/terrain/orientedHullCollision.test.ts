import {
  getMaximumHullCornerSweep,
  orientedHullOverlapsLand,
  resolveOrientedHullTurn,
  type LandCollisionGrid,
  type OrientedHullFootprint,
  type OrientedHullPose,
} from './orientedHullCollision.ts';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const footprint: OrientedHullFootprint = { width: 32, length: 82 };
const grid: LandCollisionGrid = {
  width: 10,
  height: 10,
  tileSize: 64,
  landMask: Array.from({ length: 100 }, (_, index) => index === 10),
};
const previousPose: OrientedHullPose = {
  x: 105,
  y: 96,
  rotation: Math.PI / 2,
};

for (const rudderSign of [-1, 1] as const) {
  const attemptedRotation = previousPose.rotation + rudderSign * 0.1;
  assert(
    !orientedHullOverlapsLand(previousPose, footprint, grid),
    'the repro must begin at a collision-free pose',
  );
  assert(
    orientedHullOverlapsLand({ ...previousPose, rotation: attemptedRotation }, footprint, grid),
    `rudder ${rudderSign} must reproduce the blocked turn`,
  );

  const resolution = resolveOrientedHullTurn(
    previousPose,
    attemptedRotation,
    footprint,
    grid,
  );
  const maximumSweep = getMaximumHullCornerSweep(
    previousPose.rotation,
    attemptedRotation,
    footprint,
  );
  assert(
    resolution.pose.rotation === previousPose.rotation + rudderSign * 0.1,
    `rudder ${rudderSign} should accept its requested yaw`,
  );
  assert(resolution.backstep > 0, `rudder ${rudderSign} should acquire sternward clearance`);
  assert(
    resolution.backstep <= maximumSweep + 0.001,
    `rudder ${rudderSign} backstep must remain within the rotational sweep`,
  );
  assert(
    !orientedHullOverlapsLand(resolution.pose, footprint, grid),
    `rudder ${rudderSign} must resolve to a collision-free pose`,
  );
}

const edgeGrid: LandCollisionGrid = {
  width: 10,
  height: 10,
  tileSize: 64,
  landMask: Array.from({ length: 100 }, () => false),
};
const edgePreviousPose: OrientedHullPose = {
  x: 20,
  y: 108,
  rotation: 0,
};
const edgeAttemptedRotation = -0.1;
assert(
  !orientedHullOverlapsLand(edgePreviousPose, footprint, edgeGrid),
  'the edge repro must begin at a collision-free pose',
);
assert(
  orientedHullOverlapsLand({ ...edgePreviousPose, rotation: edgeAttemptedRotation }, footprint, edgeGrid),
  'the edge repro must collide after turning',
);
const edgeResolution = resolveOrientedHullTurn(
  edgePreviousPose,
  edgeAttemptedRotation,
  footprint,
  edgeGrid,
);
assert(edgeResolution.backstep === 0, 'the edge repro must not recover beyond the world bounds');
assert(
  edgeResolution.pose.x === edgePreviousPose.x
    && edgeResolution.pose.y === edgePreviousPose.y
    && edgeResolution.pose.rotation === edgePreviousPose.rotation,
  'the edge repro must retain its previous pose when no clear recovery exists',
);

const endpointGrid: LandCollisionGrid = {
  width: 10,
  height: 10,
  tileSize: 64,
  landMask: Array.from({ length: 100 }, (_, index) => index === 63),
};
const endpointPreviousPose: OrientedHullPose = {
  x: 32.5977876689,
  y: 134.1604069248,
  rotation: 0.4498286557,
};
const endpointAttemptedRotation = 0.4875827941;
const endpointSweep = getMaximumHullCornerSweep(
  endpointPreviousPose.rotation,
  endpointAttemptedRotation,
  footprint,
);
assert(endpointSweep % 0.25 > 0.01, 'the endpoint repro must not align with the regular search step');
assert(!orientedHullOverlapsLand(endpointPreviousPose, footprint, endpointGrid), 'the endpoint repro must begin collision-free');
assert(
  orientedHullOverlapsLand(
    { ...endpointPreviousPose, rotation: endpointAttemptedRotation },
    footprint,
    endpointGrid,
  ),
  'the endpoint repro must collide at the attempted rotation',
);
for (let distance = 0.25; distance < endpointSweep; distance += 0.25) {
  const heading = endpointAttemptedRotation + Math.PI / 2;
  assert(
    orientedHullOverlapsLand(
      {
        x: endpointPreviousPose.x - Math.cos(heading) * distance,
        y: endpointPreviousPose.y - Math.sin(heading) * distance,
        rotation: endpointAttemptedRotation,
      },
      footprint,
      endpointGrid,
    ),
    'the endpoint repro must keep regular-step candidates blocked',
  );
}
const endpointResolution = resolveOrientedHullTurn(
  endpointPreviousPose,
  endpointAttemptedRotation,
  footprint,
  endpointGrid,
);
assert(
  Math.abs(endpointResolution.backstep - endpointSweep) < 0.001,
  'the resolver must test and accept the exact sweep endpoint',
);

console.log('oriented hull turn regression passed');
