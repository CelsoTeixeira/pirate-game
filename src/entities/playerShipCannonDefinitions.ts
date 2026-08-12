import Phaser from 'phaser';
import shipTypes from './ship-types.json';
import type { ShipCannonDefinition } from './Ship';
import type { ShipBuild } from './ModularShip';

export function createPlayerCannonDefinitions(build: ShipBuild): ShipCannonDefinition[] {
  const pirateCannon = shipTypes.pirate.cannons[0];

  return build.cannons.map((cannon) => ({
    ...pirateCannon,
    direction: Phaser.Math.RadToDeg(
      cannon.rotation + (cannon.x < 0 ? Math.PI : 0) - Math.PI / 2,
    ),
  }));
}
