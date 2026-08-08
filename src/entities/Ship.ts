import Phaser from 'phaser';
import { CannonBall } from './CannonBall';
import shipTypes from './ship-types.json';

type ShipCannonDefinition = {
  direction: number;
  halfAngle: number;
  range: number;
  cooldownMs: number;
  fuseMs: number;
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
  cooldownMs: number;
  fuseMs: number;
  state: CannonSideState;
};

type LocalCannonArc = Omit<CannonArc, 'state'>;
type CannonSideState = 'ready' | 'fusing' | 'recharging';
type CannonSideFiringState = {
  state: CannonSideState;
  readyAt: number;
};
type CoveringCannonArc = {
  index: number;
  arc: CannonArc;
  angleDiff: number;
};

const shipTypeDefinitions: Record<string, ShipTypeDefinition> = shipTypes;
const TEXTURE_FACING_OFFSET = Math.PI / 2;
const CANNON_BALL_SPAWN_OFFSET = 36;
const DAMAGE_STATES = ['', '-half-damage', '-full-damage', '-destroyed'] as const;

export class Ship extends Phaser.Physics.Arcade.Sprite {
  public readonly maxHp: number;
  public hp: number;
  public readonly speed: number;
  public readonly turnSpeed: number;

  private readonly textureBase: string;
  private readonly localCannonArcs: LocalCannonArc[];
  private readonly cannonSideStates: CannonSideFiringState[];

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
      cooldownMs: cannon.cooldownMs,
      fuseMs: cannon.fuseMs,
    }));
    this.cannonSideStates = this.localCannonArcs.map(() => ({
      state: 'ready',
      readyAt: scene.time.now,
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
    return this.localCannonArcs.map((arc, index) => ({
      centerAngle: Phaser.Math.Angle.Normalize(this.heading + arc.centerAngle),
      halfAngle: arc.halfAngle,
      range: arc.range,
      cooldownMs: arc.cooldownMs,
      fuseMs: arc.fuseMs,
      state: this.cannonSideStates[index].state,
    }));
  }

  canFireAt(targetX: number, targetY: number): boolean {
    if (this.isDestroyed) {
      return false;
    }

    return this.getCoveringCannonArcs(targetX, targetY).length > 0;
  }

  canFireNowAt(targetX: number, targetY: number): boolean {
    if (this.isDestroyed) {
      return false;
    }

    return this.getCoveringCannonArcs(targetX, targetY, true).length > 0;
  }

  fireAt(targetX: number, targetY: number): boolean {
    if (this.isDestroyed) {
      return false;
    }

    const coveringArc = this.getCoveringCannonArcs(targetX, targetY, true).sort((a, b) => a.angleDiff - b.angleDiff)[0];

    if (!coveringArc) {
      return false;
    }

    const sideState = this.cannonSideStates[coveringArc.index];
    sideState.state = 'fusing';
    sideState.readyAt = this.scene.time.now + coveringArc.arc.fuseMs + coveringArc.arc.cooldownMs;

    this.scene.time.delayedCall(coveringArc.arc.fuseMs, () => {
      if (!this.isDestroyed) {
        const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
        const x = this.x + Math.cos(angle) * CANNON_BALL_SPAWN_OFFSET;
        const y = this.y + Math.sin(angle) * CANNON_BALL_SPAWN_OFFSET;

        const ball = new CannonBall(this.scene, x, y, targetX, targetY, this);
        this.emit('cannonball-fired', ball);
      }

      sideState.state = 'recharging';
      sideState.readyAt = this.scene.time.now + coveringArc.arc.cooldownMs;

      this.scene.time.delayedCall(coveringArc.arc.cooldownMs, () => {
        sideState.state = 'ready';
        sideState.readyAt = this.scene.time.now;
      });
    });

    return true;
  }

  private getCoveringCannonArcs(targetX: number, targetY: number, readyOnly = false): CoveringCannonArc[] {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
    const targetAngle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);

    return this.cannonArcs
      .map((arc, index) => ({
        index,
        arc,
        angleDiff: Math.abs(Phaser.Math.Angle.Wrap(targetAngle - arc.centerAngle)),
      }))
      .filter(({ arc, angleDiff }) => {
        return distance <= arc.range && angleDiff <= arc.halfAngle && (!readyOnly || arc.state === 'ready');
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
