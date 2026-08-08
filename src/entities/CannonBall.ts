import Phaser from 'phaser';
import { attachTrail, playWaterSplash } from '../effects/effects';
import type { Ship } from './Ship';

const CANNON_BALL_SPEED = 400;
const CANNON_BALL_LIFETIME_MS = 2000;
const DEFAULT_CANNON_BALL_DAMAGE = 25;

export class CannonBall extends Phaser.Physics.Arcade.Sprite {
  public readonly damage = DEFAULT_CANNON_BALL_DAMAGE;
  public readonly owner: Ship;

  private readonly target = new Phaser.Math.Vector2();
  private wasHit = false;
  private playedMissEffect = false;

  constructor(scene: Phaser.Scene, x: number, y: number, targetX: number, targetY: number, owner: Ship) {
    super(scene, x, y, 'cannonBall');

    this.owner = owner;
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.target.set(targetX, targetY);
    attachTrail(scene, this);

    const angleRad = Phaser.Math.Angle.Between(x, y, targetX, targetY);

    this.setRotation(angleRad);
    this.setVelocity(Math.cos(angleRad) * CANNON_BALL_SPEED, Math.sin(angleRad) * CANNON_BALL_SPEED);

    scene.time.delayedCall(CANNON_BALL_LIFETIME_MS, () => {
      this.destroy();
    });
  }

  markHit() {
    this.wasHit = true;
  }

  destroy(fromScene?: boolean) {
    if (!fromScene && !this.wasHit && !this.playedMissEffect && this.scene) {
      this.playedMissEffect = true;
      playWaterSplash(this.scene, this.x, this.y);
    }

    super.destroy(fromScene);
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);

    const distanceToTarget = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
    const stepDistance = CANNON_BALL_SPEED * (delta / 1000);

    if (distanceToTarget <= stepDistance) {
      this.setPosition(this.target.x, this.target.y);
      this.destroy();
    }
  }

  static preload(scene: Phaser.Scene) {
    scene.load.image('cannonBall', 'assets/cannonBall.png');
  }
}
