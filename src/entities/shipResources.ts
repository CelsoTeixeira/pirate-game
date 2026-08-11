export type ShipHullSize = 'small' | 'medium' | 'big';

export type ShipResourceSnapshot = Readonly<{
  crew: number;
  crewCapacity: number;
  supplies: number;
  supplyCapacity: number;
}>;

export const CREW_CAPACITY_BY_HULL_SIZE: Readonly<Record<ShipHullSize, number>> = Object.freeze({
  small: 8,
  medium: 20,
  big: 40,
});
export const SUPPLY_UNITS_PER_CREW = 10;
export const FULL_CREW_SUPPLY_RANGE = 6_400;
export const OUT_OF_SUPPLIES_SPEED_MULTIPLIER = 0.2;
export const OUT_OF_SUPPLIES_RELOAD_MULTIPLIER = 2;
export const DAMAGE_CONSEQUENCE_HP_RATIO = 0.4;
export const DAMAGE_RESOURCE_LOSS_RATIO = 0.1;
export const DAMAGE_CONSEQUENCE_ROLL_MINIMUM = 1;
export const DAMAGE_CONSEQUENCE_ROLL_MAXIMUM = 6;
export const SUPPLY_LOSS_ROLL_MINIMUM = 4;
export const SUPPLY_LOSS_ROLL_MAXIMUM = 5;
export const CREW_LOSS_ROLL = 6;

export function createShipResources(hullSize: ShipHullSize): ShipResourceSnapshot {
  const crewCapacity = CREW_CAPACITY_BY_HULL_SIZE[hullSize];
  const supplyCapacity = crewCapacity * SUPPLY_UNITS_PER_CREW;

  return Object.freeze({
    crew: crewCapacity,
    crewCapacity,
    supplies: supplyCapacity,
    supplyCapacity,
  });
}

export function consumeSuppliesForDistance(
  resources: ShipResourceSnapshot,
  acceptedDistance: number,
): ShipResourceSnapshot {
  if (acceptedDistance <= 0 || resources.supplies <= 0 || resources.crew <= 0) {
    return resources;
  }

  const supplyCost = acceptedDistance
    * resources.crew
    * SUPPLY_UNITS_PER_CREW
    / FULL_CREW_SUPPLY_RANGE;
  const supplies = Math.max(0, resources.supplies - supplyCost);

  if (supplies === resources.supplies) {
    return resources;
  }

  return Object.freeze({
    ...resources,
    supplies,
  });
}

export function applyDamageResourceConsequence(
  resources: ShipResourceSnapshot,
  roll: number,
): ShipResourceSnapshot {
  if (roll >= SUPPLY_LOSS_ROLL_MINIMUM && roll <= SUPPLY_LOSS_ROLL_MAXIMUM) {
    return Object.freeze({
      ...resources,
      supplies: Math.max(
        0,
        resources.supplies - resources.supplyCapacity * DAMAGE_RESOURCE_LOSS_RATIO,
      ),
    });
  }

  if (roll === CREW_LOSS_ROLL) {
    return Object.freeze({
      ...resources,
      crew: Math.max(
        0,
        resources.crew - Math.ceil(resources.crewCapacity * DAMAGE_RESOURCE_LOSS_RATIO),
      ),
    });
  }

  return resources;
}

export function restoreShipResources(
  resources: ShipResourceSnapshot,
): ShipResourceSnapshot {
  if (
    resources.crew === resources.crewCapacity
    && resources.supplies === resources.supplyCapacity
  ) {
    return resources;
  }

  return Object.freeze({
    ...resources,
    crew: resources.crewCapacity,
    supplies: resources.supplyCapacity,
  });
}

export function getMovementSpeedMultiplier(resources: ShipResourceSnapshot): number {
  if (resources.crewCapacity <= 0) {
    return 0;
  }

  const crewMultiplier = resources.crew / resources.crewCapacity;
  const supplyMultiplier = resources.supplies > 0
    ? 1
    : OUT_OF_SUPPLIES_SPEED_MULTIPLIER;
  return crewMultiplier * supplyMultiplier;
}

export function getReloadTimeMultiplier(resources: ShipResourceSnapshot): number {
  return resources.supplies > 0 ? 1 : OUT_OF_SUPPLIES_RELOAD_MULTIPLIER;
}
