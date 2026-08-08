import Phaser from 'phaser';
import shipTypes from './ship-types.json';

type ShipCannonDefinition = {
  direction: number;
  halfAngle: number;
  range: number;
};

export type ShipTypeDefinition = {
  texture: string;
  stats: {
    maxHp: number;
    speed: number;
    turnSpeed: number;
  };
  cannons: ShipCannonDefinition[];
};

export type ShipTypeKey = keyof typeof shipTypes;

type CannonArc = {
  centerAngle: number;
  halfAngle: number;
  range: number;
};

const shipTypeDefinitions: Record<string, ShipTypeDefinition> = shipTypes;
const TEXTURE_FACING_OFFSET = Math.PI / 2;
const DAMAGE_STATES = ['', '-half-damage', '-full-damage', '-destroyed'] as const;

export class Ship extends Phaser.Physics.Arcade.Sprite {
  public readonly maxHp: number;
  public hp: number;
  public readonly speed: number;
  public readonly turnSpeed: number;

  private readonly textureBase: string;
  private readonly localCannonArcs: CannonArc[];

  constructor(scene: Phaser.Scene, x: number, y: number, type: ShipTypeKey) {
    const definition = shipTypeDefinitions[type];

    super(scene, x, y, definition.texture);

    this.textureBase = definition.texture;
    this.maxHp = definition.stats.maxHp;
    this.hp = this.maxHp;
    this.speed = definition.stats.speed;
    this.turnSpeed = definition.stats.turnSpeed;
    this.localCannonArcs = definition.cannons.map((cannon) => ({
      centerAngle: Phaser.Math.DegToRad(cannon.direction),
      halfAngle: Phaser.Math.DegToRad(cannon.halfAngle),
      range: cannon.range,
    }));

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
  }

  static preload(scene: Phaser.Scene) {
    for (const definition of Object.values(shipTypeDefinitions)) {
      for (const damageState of DAMAGE_STATES) {
        const textureKey = `${definition.texture}${damageState}`;
        scene.load.image(textureKey, `assets/${textureKey}.png`);
      }
    }
  }

  get isDestroyed() {
    return this.hp <= 0;
  }

  get heading() {
    return Phaser.Math.Angle.Normalize(this.rotation + TEXTURE_FACING_OFFSET);
  }

  get cannonArcs(): CannonArc[] {
    return this.localCannonArcs.map((arc) => ({
      centerAngle: Phaser.Math.Angle.Normalize(this.heading + arc.centerAngle),
      halfAngle: arc.halfAngle,
      range: arc.range,
    }));
  }

  canFireAt(targetX: number, targetY: number): boolean {
    if (this.isDestroyed) {
      return false;
    }

    const distance = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
    const targetAngle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);

    return this.cannonArcs.some((arc) => {
      return distance <= arc.range && Math.abs(Phaser.Math.Angle.Wrap(targetAngle - arc.centerAngle)) <= arc.halfAngle;
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
      return this.textureBase;
    }

    if (hpRatio > 1 / 3) {
      return this.getDamageTextureKey('half-damage');
    }

    if (hpRatio > 0) {
      return this.getDamageTextureKey('full-damage');
    }

    return this.getDamageTextureKey('destroyed');
  }

  private getDamageTextureKey(damageState: 'half-damage' | 'full-damage' | 'destroyed') {
    return `${this.textureBase}-${damageState}`;
  }
}
