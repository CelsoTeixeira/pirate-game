import Phaser from 'phaser';

export type ShipVariant = 'pirate' | 'white';

type ShipConfig = {
  maxHp?: number;
  speed?: number;
  turnSpeed?: number;
  cannonMaxRange?: number;
  cannonArcHalfAngle?: number;
};

const TEXTURE_FACING_OFFSET = Math.PI / 2;
const DAMAGE_STATES = ['', '-half-damage', '-full-damage', '-destroyed'] as const;
const DEFAULT_CANNON_MAX_RANGE = 320;
const DEFAULT_CANNON_ARC_HALF_ANGLE = Phaser.Math.DegToRad(55);

export class Ship extends Phaser.Physics.Arcade.Sprite {
  public readonly maxHp: number;
  public hp: number;
  public readonly speed: number;
  public readonly turnSpeed: number;
  public readonly cannonMaxRange: number;
  public readonly cannonArcHalfAngle: number;

  private readonly variant: ShipVariant;

  constructor(scene: Phaser.Scene, x: number, y: number, variant: ShipVariant, config: ShipConfig = {}) {
    super(scene, x, y, Ship.getTextureKey(variant));

    this.variant = variant;
    this.maxHp = config.maxHp ?? 100;
    this.hp = this.maxHp;
    this.speed = config.speed ?? 220;
    this.turnSpeed = config.turnSpeed ?? 6;
    this.cannonMaxRange = config.cannonMaxRange ?? DEFAULT_CANNON_MAX_RANGE;
    this.cannonArcHalfAngle = config.cannonArcHalfAngle ?? DEFAULT_CANNON_ARC_HALF_ANGLE;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
  }

  static preload(scene: Phaser.Scene) {
    const variants: ShipVariant[] = ['pirate', 'white'];

    for (const variant of variants) {
      for (const damageState of DAMAGE_STATES) {
        const filename = `ship-${variant}${damageState}.png`;
        scene.load.image(filename.replace('.png', ''), `assets/${filename}`);
      }
    }
  }

  get isDestroyed() {
    return this.hp <= 0;
  }

  get heading() {
    return Phaser.Math.Angle.Normalize(this.rotation + TEXTURE_FACING_OFFSET);
  }

  get cannonArcCenterAngles(): [number, number] {
    return [
      Phaser.Math.Angle.Normalize(this.heading + Math.PI / 2),
      Phaser.Math.Angle.Normalize(this.heading - Math.PI / 2),
    ];
  }

  canFireAt(targetX: number, targetY: number): boolean {
    if (this.isDestroyed) {
      return false;
    }

    const distance = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);

    if (distance > this.cannonMaxRange) {
      return false;
    }

    const targetAngle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);

    return this.cannonArcCenterAngles.some((centerAngle) => {
      return Math.abs(Phaser.Math.Angle.Wrap(targetAngle - centerAngle)) <= this.cannonArcHalfAngle;
    });
  }

  move(direction: Phaser.Math.Vector2, deltaMs: number) {
    if (this.isDestroyed || direction.lengthSq() === 0) {
      this.setVelocity(0, 0);
      return;
    }

    const velocity = direction.clone().normalize().scale(this.speed);
    const movementAngle = Phaser.Math.Angle.Between(0, 0, velocity.x, velocity.y);
    const targetRotation = movementAngle - TEXTURE_FACING_OFFSET;

    this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, targetRotation, this.turnSpeed * (deltaMs / 1000));
    this.setVelocity(velocity.x, velocity.y);
  }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - Math.max(0, amount));
    this.setTexture(this.getCurrentTextureKey());
  }

  private getCurrentTextureKey() {
    const hpRatio = this.hp / this.maxHp;

    if (hpRatio > 2 / 3) {
      return Ship.getTextureKey(this.variant);
    }

    if (hpRatio > 1 / 3) {
      return Ship.getTextureKey(this.variant, 'half-damage');
    }

    if (hpRatio > 0) {
      return Ship.getTextureKey(this.variant, 'full-damage');
    }

    return Ship.getTextureKey(this.variant, 'destroyed');
  }

  private static getTextureKey(variant: ShipVariant, damageState?: 'half-damage' | 'full-damage' | 'destroyed') {
    return `ship-${variant}${damageState ? `-${damageState}` : ''}`;
  }
}
