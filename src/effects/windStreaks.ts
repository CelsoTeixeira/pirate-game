import Phaser from 'phaser';
import { Wind } from '../world/Wind';

const WIND_STREAK_TEXTURE = 'effect-wind-streak';
const WIND_STREAK_DEPTH = -20;
const WIND_STREAK_PADDING = 80;
const WIND_STREAK_MIN_SPEED = 40;
const WIND_STREAK_SPEED_RANGE = 160;
const WIND_STREAK_MAX_FREQUENCY_MS = 180;
const WIND_STREAK_MIN_FREQUENCY_MS = 45;
const WIND_STREAK_PEAK_ALPHA = 0.35;

type Bounds = {
  width: number;
  height: number;
};

export class WindStreaks {
  private readonly scene: Phaser.Scene;
  private readonly wind: Wind;
  private readonly emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private lastDirectionRad = Number.NaN;
  private lastStrength = Number.NaN;
  private lastWidth = 0;
  private lastHeight = 0;

  constructor(scene: Phaser.Scene, wind: Wind, bounds: Bounds = scene.scale.gameSize) {
    this.scene = scene;
    this.wind = wind;
    this.lastWidth = bounds.width;
    this.lastHeight = bounds.height;

    ensureWindStreakTexture(scene);

    this.emitter = scene.add.particles(0, 0, WIND_STREAK_TEXTURE, {
      frequency: WIND_STREAK_MAX_FREQUENCY_MS,
      lifespan: { min: 1200, max: 1800 },
      quantity: 1,
      radial: false,
      speedX: WIND_STREAK_MIN_SPEED,
      speedY: 0,
      rotate: 0,
      scale: { min: 1, max: 1.5 },
      alpha: {
        onUpdate: (_particle, _key, t) => Math.sin(t * Math.PI) * WIND_STREAK_PEAK_ALPHA,
      },
      emitZone: this.createEmitZone(bounds.width, bounds.height),
    });
    this.emitter.setDepth(WIND_STREAK_DEPTH);
    this.sync(true);
  }

  update() {
    this.sync();
  }

  sync(force = false) {
    const { width, height } = this.scene.scale.gameSize;
    const directionRad = this.wind.directionRad;
    const strength = this.wind.strength;

    if (
      !force &&
      directionRad === this.lastDirectionRad &&
      strength === this.lastStrength &&
      width === this.lastWidth &&
      height === this.lastHeight
    ) {
      return;
    }

    const speed = WIND_STREAK_MIN_SPEED + strength * WIND_STREAK_SPEED_RANGE;
    const frequency = Phaser.Math.Linear(WIND_STREAK_MAX_FREQUENCY_MS, WIND_STREAK_MIN_FREQUENCY_MS, strength);

    this.emitter.updateConfig({
      frequency,
      radial: false,
      speedX: Math.cos(directionRad) * speed,
      speedY: Math.sin(directionRad) * speed,
      rotate: Phaser.Math.RadToDeg(directionRad),
      emitZone: this.createEmitZone(width, height),
    });
    this.emitter.setDepth(WIND_STREAK_DEPTH);

    this.lastDirectionRad = directionRad;
    this.lastStrength = strength;
    this.lastWidth = width;
    this.lastHeight = height;
  }

  private createEmitZone(width: number, height: number): Phaser.Types.GameObjects.Particles.EmitZoneData {
    const x = -WIND_STREAK_PADDING;
    const y = -WIND_STREAK_PADDING;
    const paddedWidth = width + WIND_STREAK_PADDING * 2;
    const paddedHeight = height + WIND_STREAK_PADDING * 2;

    return {
      type: 'random',
      source: {
        getRandomPoint(point) {
          point.x = Phaser.Math.FloatBetween(x, x + paddedWidth);
          point.y = Phaser.Math.FloatBetween(y, y + paddedHeight);
        },
      },
    };
  }
}

function ensureWindStreakTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(WIND_STREAK_TEXTURE)) {
    return;
  }

  const graphics = scene.add.graphics();
  graphics.fillStyle(0xffffff, 0.7);
  graphics.fillRect(0, 0, 14, 2);
  graphics.generateTexture(WIND_STREAK_TEXTURE, 14, 2);
  graphics.destroy();
}
