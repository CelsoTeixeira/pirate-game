import Phaser from 'phaser';

const CANNON_BALL_SPEED = 400;
const CANNON_BALL_LIFETIME_MS = 2000;

export class CannonBall extends Phaser.Physics.Arcade.Sprite {
  private readonly target = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, x: number, y: number, targetX: number, targetY: number) {
    super(scene, x, y, 'cannonBall');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.target.set(targetX, targetY);
    const angleRad = Phaser.Math.Angle.Between(x, y, targetX, targetY);

    this.setRotation(angleRad);
    this.setVelocity(Math.cos(angleRad) * CANNON_BALL_SPEED, Math.sin(angleRad) * CANNON_BALL_SPEED);

    scene.time.delayedCall(CANNON_BALL_LIFETIME_MS, () => {
      this.destroy();
    });
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
