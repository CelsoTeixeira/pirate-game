import Phaser from 'phaser';
import {
  FLASH_TEXTURE,
  RIPPLE_RING_TEXTURE,
  SMOKE_TEXTURE,
  SPARK_TEXTURE,
  SPLINTER_TEXTURE,
  ensureEffectTextures,
} from './effectTextures';

const BURST_DEPTH = 10;
const EXPLOSION_DEPTH = 12;
const IMPACT_LIFESPAN_MS = 450;
const EXPLOSION_FLASH_MS = 180;
const EXPLOSION_SPARK_LIFESPAN_MS = 600;
const EXPLOSION_SPLINTER_LIFESPAN_MS = 650;
const EXPLOSION_SMOKE_LIFESPAN_MS = 900;
const EXPLOSION_SHOCKWAVE_MS = 450;

type ExplosionBurstOptions = {
  shockwave?: boolean;
  smokeLifespanMultiplier?: number;
};

function scaledValue(value: number, scale: number, min: number) {
  return Math.max(min, Math.round(value * scale));
}

export function playShipImpact(scene: Phaser.Scene, x: number, y: number) {
  ensureEffectTextures(scene);

  const sparks = scene.add.particles(x, y, SPARK_TEXTURE, {
    emitting: false,
    lifespan: { min: 300, max: IMPACT_LIFESPAN_MS },
    speed: { min: 60, max: 160 },
    angle: { min: 0, max: 360 },
    scale: { start: 1, end: 0 },
    alpha: { start: 1, end: 0 },
    gravityX: 0,
    gravityY: 0,
    rotate: { min: 0, max: 360 },
  });
  sparks.setDepth(BURST_DEPTH);
  sparks.explode(10);

  const splinters = scene.add.particles(x, y, SPLINTER_TEXTURE, {
    emitting: false,
    lifespan: { min: 300, max: IMPACT_LIFESPAN_MS },
    speed: { min: 60, max: 160 },
    angle: { min: 0, max: 360 },
    scale: { start: 1, end: 0 },
    alpha: { start: 0.9, end: 0 },
    gravityX: 0,
    gravityY: 0,
    rotate: { min: 0, max: 360 },
  });
  splinters.setDepth(BURST_DEPTH);
  splinters.explode(8);

  scene.time.delayedCall(IMPACT_LIFESPAN_MS, () => {
    sparks.destroy();
    splinters.destroy();
  });
}

export function playShipExplosion(scene: Phaser.Scene, x: number, y: number) {
  ensureEffectTextures(scene);

  playExplosionBurst(scene, x, y, 1, { shockwave: true });

  [
    { delay: 180, lingeringSmoke: false },
    { delay: 380, lingeringSmoke: false },
    { delay: 560, lingeringSmoke: true },
  ].forEach(({ delay, lingeringSmoke }) => {
    scene.time.delayedCall(delay, () => {
      playExplosionBurst(
        scene,
        x + Phaser.Math.Between(-20, 20),
        y + Phaser.Math.Between(-26, 26),
        Phaser.Math.FloatBetween(0.45, 0.6),
        { smokeLifespanMultiplier: lingeringSmoke ? 1.15 : 1 },
      );
    });
  });
}

function playExplosionBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number,
  options: ExplosionBurstOptions = {},
) {
  const sparkLifespan = {
    min: scaledValue(400, scale, 180),
    max: scaledValue(EXPLOSION_SPARK_LIFESPAN_MS, scale, 260),
  };
  const splinterLifespan = {
    min: scaledValue(450, scale, 200),
    max: scaledValue(EXPLOSION_SPLINTER_LIFESPAN_MS, scale, 290),
  };
  const smokeLifespan = scaledValue(
    EXPLOSION_SMOKE_LIFESPAN_MS * (options.smokeLifespanMultiplier ?? 1),
    scale,
    420,
  );

  const flash = scene.add
    .image(x, y, FLASH_TEXTURE)
    .setDepth(EXPLOSION_DEPTH + 2)
    .setScale(0.5 * scale)
    .setAlpha(0.9);
  scene.tweens.add({
    targets: flash,
    scale: 2.5 * scale,
    alpha: 0,
    duration: scaledValue(EXPLOSION_FLASH_MS, scale, 100),
    ease: 'Quad.easeOut',
    onComplete: () => {
      flash.destroy();
    },
  });

  const sparks = scene.add.particles(x, y, SPARK_TEXTURE, {
    emitting: false,
    lifespan: sparkLifespan,
    speed: { min: 80 * scale, max: 220 * scale },
    angle: { min: 0, max: 360 },
    scale: { start: 1.4 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    gravityX: 0,
    gravityY: 0,
    rotate: { min: 0, max: 360 },
  });
  sparks.setDepth(EXPLOSION_DEPTH + 1);
  sparks.explode(scaledValue(16, scale, 6));

  const splinters = scene.add.particles(x, y, SPLINTER_TEXTURE, {
    emitting: false,
    lifespan: splinterLifespan,
    speed: { min: 100 * scale, max: 240 * scale },
    angle: { min: 0, max: 360 },
    scale: { start: 1.1 * scale, end: 0 },
    alpha: { start: 0.95, end: 0 },
    gravityX: 0,
    gravityY: 0,
    rotate: { min: 0, max: 360 },
  });
  splinters.setDepth(EXPLOSION_DEPTH);
  splinters.explode(scaledValue(12, scale, 5));

  const smoke = scene.add.particles(x, y, SMOKE_TEXTURE, {
    emitting: false,
    lifespan: smokeLifespan,
    speed: { min: 15 * scale, max: 50 * scale },
    angle: { min: 0, max: 360 },
    scale: { start: 1.6 * scale, end: 0 },
    alpha: { start: 0.6, end: 0 },
    gravityX: 0,
    gravityY: 0,
  });
  smoke.setDepth(EXPLOSION_DEPTH);
  smoke.explode(scaledValue(10, scale, 5));

  if (options.shockwave) {
    const shockwave = scene.add
      .image(x, y, RIPPLE_RING_TEXTURE)
      .setDepth(EXPLOSION_DEPTH + 1)
      .setScale(0.4 * scale)
      .setAlpha(0.7);
    scene.tweens.add({
      targets: shockwave,
      scale: 3 * scale,
      alpha: 0,
      duration: scaledValue(EXPLOSION_SHOCKWAVE_MS, scale, 250),
      ease: 'Quad.easeOut',
      onComplete: () => {
        shockwave.destroy();
      },
    });
  }

  scene.time.delayedCall(sparkLifespan.max, () => {
    sparks.destroy();
  });
  scene.time.delayedCall(splinterLifespan.max, () => {
    splinters.destroy();
  });
  scene.time.delayedCall(smokeLifespan, () => {
    smoke.destroy();
  });
}
