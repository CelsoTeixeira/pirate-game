import Phaser from 'phaser';
import shipTypes from '../entities/ship-types.json';
import { ModularShip } from '../entities/ModularShip';

const PIRATE_CANNON = shipTypes.pirate.cannons[0];
const RANGE_COLOR = 0xf43f5e;
const RANGE_FILL_ALPHA = 0.09;
const RANGE_EDGE_ALPHA = 0.72;
const RANGE_CENTER_ALPHA = 0.95;
const RANGE_DEPTH = -10;

export class CannonRangeOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(RANGE_DEPTH).setVisible(false);
  }

  show(ship: ModularShip, cannons: Iterable<Phaser.GameObjects.Image>) {
    this.graphics.clear().setVisible(true);

    const shipRotation = ship.getWorldTransformMatrix().rotation;
    const halfAngle = Phaser.Math.DegToRad(PIRATE_CANNON.halfAngle);

    for (const cannon of cannons) {
      if (!cannon.active) {
        continue;
      }

      const origin = cannon.getWorldTransformMatrix().transformPoint(0, 0);
      const centerAngle = shipRotation + cannon.rotation + (cannon.flipX ? Math.PI : 0);
      const startAngle = centerAngle - halfAngle;
      const endAngle = centerAngle + halfAngle;

      this.graphics.fillStyle(RANGE_COLOR, RANGE_FILL_ALPHA);
      this.graphics.slice(
        origin.x,
        origin.y,
        PIRATE_CANNON.range,
        startAngle,
        endAngle,
      );
      this.graphics.fillPath();

      this.graphics.lineStyle(1.5, RANGE_COLOR, RANGE_EDGE_ALPHA);
      this.graphics.lineBetween(
        origin.x,
        origin.y,
        origin.x + Math.cos(startAngle) * PIRATE_CANNON.range,
        origin.y + Math.sin(startAngle) * PIRATE_CANNON.range,
      );
      this.graphics.lineBetween(
        origin.x,
        origin.y,
        origin.x + Math.cos(endAngle) * PIRATE_CANNON.range,
        origin.y + Math.sin(endAngle) * PIRATE_CANNON.range,
      );
      this.graphics.slice(
        origin.x,
        origin.y,
        PIRATE_CANNON.range,
        startAngle,
        endAngle,
      );
      this.graphics.strokePath();

      this.graphics.lineStyle(2, RANGE_COLOR, RANGE_CENTER_ALPHA);
      this.graphics.lineBetween(
        origin.x,
        origin.y,
        origin.x + Math.cos(centerAngle) * PIRATE_CANNON.range,
        origin.y + Math.sin(centerAngle) * PIRATE_CANNON.range,
      );
    }
  }

  hide() {
    this.graphics.clear().setVisible(false);
  }

  ignoreBy(camera: Phaser.Cameras.Scene2D.Camera) {
    camera.ignore(this.graphics);
  }
}
