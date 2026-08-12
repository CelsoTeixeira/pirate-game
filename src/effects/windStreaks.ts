import Phaser from 'phaser';
import { Wind } from '../world/Wind';

const WIND_STREAK_TEXTURE = 'effect-wind-streak';
const WIND_STREAK_DEPTH = -5;
const WIND_STREAK_PADDING = 80;
const WIND_STREAK_MIN_SPEED = 40;
const WIND_STREAK_SPEED_RANGE = 160;
const WIND_STREAK_INITIAL_FREQUENCY_MS = 250;
const WIND_STREAK_MIN_COUNT = 18;
const WIND_STREAK_MAX_COUNT = 42;
const WIND_STREAK_PEAK_ALPHA = 0.6;
const WIND_STREAK_LOCAL_WIDTH = 720;
const WIND_STREAK_LOCAL_HEIGHT = 480;

type Bounds = {
  width: number;
  height: number;
};

type Position = {
  x: number;
  y: number;
};

export class WindStreaks {
  private readonly scene: Phaser.Scene;
  private readonly wind: Wind;
  private readonly getPosition: () => Position;
  private readonly emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private lastDirectionRad = Number.NaN;
  private lastStrength = Number.NaN;
  private lastWidth = 0;
  private lastHeight = 0;

  constructor(
    scene: Phaser.Scene,
    wind: Wind,
    getPosition: () => Position,
    bounds: Bounds = { width: WIND_STREAK_LOCAL_WIDTH, height: WIND_STREAK_LOCAL_HEIGHT },
  ) {
    this.scene = scene;
    this.wind = wind;
    this.getPosition = getPosition;
    this.lastWidth = bounds.width;
    this.lastHeight = bounds.height;

    ensureWindStreakTexture(scene);

    this.emitter = scene.add.particles(0, 0, WIND_STREAK_TEXTURE, {
      frequency: WIND_STREAK_INITIAL_FREQUENCY_MS,
      lifespan: { min: 1200, max: 1800 },
      quantity: 1,
      radial: false,
      speedX: WIND_STREAK_MIN_SPEED,
      speedY: 0,
      rotate: 0,
      scale: { min: 1, max: 1.5 },
      alpha: WIND_STREAK_PEAK_ALPHA,
      emitZone: this.createEmitZone(wind.directionRad),
    });
    this.emitter
      .setDepth(WIND_STREAK_DEPTH)
      .setScrollFactor(1);
    this.sync(true);
  }

  update() {
    this.sync();
  }

  sync(force = false) {
    const width = this.lastWidth;
    const height = this.lastHeight;
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
    const lifespan = this.calculateLifespan(width, height, directionRad, speed);
    const targetCount = Phaser.Math.Linear(WIND_STREAK_MIN_COUNT, WIND_STREAK_MAX_COUNT, strength);
    const frequency = lifespan / targetCount;

    this.emitter.updateConfig({
      frequency,
      radial: false,
      speedX: Math.cos(directionRad) * speed,
      speedY: Math.sin(directionRad) * speed,
      rotate: Phaser.Math.RadToDeg(directionRad),
      lifespan,
      emitZone: this.createEmitZone(directionRad),
    });
    this.emitter.setDepth(WIND_STREAK_DEPTH);
    if (strength === 0) {
      this.emitter.killAll();
    }
    this.emitter.emitting = strength > 0;

    this.lastDirectionRad = directionRad;
    this.lastStrength = strength;
    this.lastWidth = width;
    this.lastHeight = height;
  }

  private calculateLifespan(width: number, height: number, directionRad: number, speed: number) {
    const directionX = Math.cos(directionRad);
    const directionY = Math.sin(directionRad);
    const horizontal = Math.abs(directionX) >= Math.abs(directionY);
    const crossingDistance = (horizontal ? width : height) + WIND_STREAK_PADDING * 2;
    const crossingSpeed = speed * Math.abs(horizontal ? directionX : directionY);

    return crossingDistance / crossingSpeed * 1000;
  }

  private createEmitZone(directionRad: number): Phaser.Types.GameObjects.Particles.EmitZoneData {
    const directionX = Math.cos(directionRad);
    const directionY = Math.sin(directionRad);
    const horizontal = Math.abs(directionX) >= Math.abs(directionY);
    const getPosition = this.getPosition;
    const streaks = this;

    return {
      type: 'random',
      source: {
        getRandomPoint(point) {
          const position = getPosition();
          const left = position.x - streaks.lastWidth / 2;
          const right = position.x + streaks.lastWidth / 2;
          const top = position.y - streaks.lastHeight / 2;
          const bottom = position.y + streaks.lastHeight / 2;

          if (horizontal) {
            point.x = directionX >= 0
              ? left - WIND_STREAK_PADDING
              : right + WIND_STREAK_PADDING;
            point.y = Phaser.Math.FloatBetween(top, bottom);
          } else {
            point.x = Phaser.Math.FloatBetween(left, right);
            point.y = directionY >= 0
              ? top - WIND_STREAK_PADDING
              : bottom + WIND_STREAK_PADDING;
          }
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
  graphics.fillStyle(0xffffff, 0.35);
  graphics.fillTriangle(0, 1.5, 10, 0, 10, 3);
  graphics.fillRect(10, 0, 14, 3);
  graphics.fillTriangle(24, 0, 32, 1.5, 24, 3);
  graphics.fillStyle(0xffffff, 0.85);
  graphics.fillTriangle(4, 1.5, 12, 0.75, 12, 2.25);
  graphics.fillRect(12, 0.75, 12, 1.5);
  graphics.fillTriangle(24, 0.75, 30, 1.5, 24, 2.25);
  graphics.generateTexture(WIND_STREAK_TEXTURE, 32, 3);
  graphics.destroy();
}
