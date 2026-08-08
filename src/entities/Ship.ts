import Phaser from 'phaser';
import { CannonBall } from './CannonBall';
import { playShipExplosion } from '../effects/effects';
import shipTypes from './ship-types.json';
import { Wind } from '../world/Wind';

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
  sailing: {
    upwind: number;
    beam: number;
    downwind: number;
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
const BASE_TURN_SPEED_STAT = 6;
const RUDDER_RATE_AT_BASE_TURN_SPEED = 2.5;

export type SailState = 0 | 1 | 2;
export type RudderDirection = -1 | 0 | 1;

export class Ship extends Phaser.Physics.Arcade.Sprite {
  public readonly maxHp: number;
  public hp: number;
  public readonly speed: number;
  public readonly turnSpeed: number;
  public sailState: SailState = 0;
  public anchored = false;

  private readonly textureBase: string;
  private readonly sailing: ShipTypeDefinition['sailing'];
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
    this.sailing = definition.sailing;
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

  raiseSail() {
    this.sailState = Math.min(2, this.sailState + 1) as SailState;
  }

  lowerSail() {
    this.sailState = Math.max(0, this.sailState - 1) as SailState;
  }

  toggleAnchor() {
    this.anchored = !this.anchored;
  }

  sail(wind: Wind, rudder: RudderDirection, deltaMs: number) {
    if (this.isDestroyed) {
      this.setVelocity(0, 0);
      return;
    }

    const dt = deltaMs / 1000;
    const rudderRate = this.turnSpeed * (RUDDER_RATE_AT_BASE_TURN_SPEED / BASE_TURN_SPEED_STAT);
    this.rotation = Phaser.Math.Angle.Normalize(this.rotation + rudder * rudderRate * dt);

    if (this.anchored) {
      this.setVelocity(0, 0);
      return;
    }

    const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(this.heading - wind.directionRad));
    const pointsOfSail = this.getPointsOfSailMultiplier(angleDiff);
    const sailFactor = this.sailState / 2;
    const speed = this.speed * sailFactor * wind.strength * pointsOfSail;

    this.setVelocity(Math.cos(this.heading) * speed, Math.sin(this.heading) * speed);
  }

  takeDamage(amount: number) {
    const wasDestroyed = this.isDestroyed;

    this.hp = Math.max(0, this.hp - Math.max(0, amount));
    this.setTexture(this.getCurrentTextureKey());

    if (!wasDestroyed && this.isDestroyed) {
      playShipExplosion(this.scene, this.x, this.y);
    }
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

  private getPointsOfSailMultiplier(angleDiff: number) {
    if (angleDiff <= Math.PI / 2) {
      return Phaser.Math.Linear(this.sailing.downwind, this.sailing.beam, angleDiff / (Math.PI / 2));
    }

    return Phaser.Math.Linear(this.sailing.beam, this.sailing.upwind, (angleDiff - Math.PI / 2) / (Math.PI / 2));
  }
}
