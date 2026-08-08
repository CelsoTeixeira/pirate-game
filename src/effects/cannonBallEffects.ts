import Phaser from 'phaser';
import {
  DROPLET_TEXTURE,
  RIPPLE_RING_TEXTURE,
  SMOKE_TEXTURE,
  ensureEffectTextures,
} from './effectTextures';

const TRAIL_DEPTH = 5;
const BURST_DEPTH = 10;
const RIPPLE_DEPTH = -1;
const TRAIL_LIFESPAN_MS = 350;
const SPLASH_LIFESPAN_MS = 300;

export function attachTrail(scene: Phaser.Scene, ball: Phaser.GameObjects.Sprite) {
  ensureEffectTextures(scene);

  const emitter = scene.add.particles(0, 0, SMOKE_TEXTURE, {
    frequency: 28,
    lifespan: TRAIL_LIFESPAN_MS,
    quantity: 1,
    speedX: { min: -18, max: 18 },
    speedY: { min: -18, max: 18 },
    scale: { start: 0.8, end: 0 },
    alpha: { start: 0.5, end: 0 },
  });

  emitter.setDepth(TRAIL_DEPTH);
  emitter.startFollow(ball);
  ball.once(Phaser.GameObjects.Events.DESTROY, () => {
    emitter.stop();
    scene.time.delayedCall(TRAIL_LIFESPAN_MS, () => {
      emitter.destroy();
    });
  });

  return emitter;
}

export function playWaterSplash(scene: Phaser.Scene, x: number, y: number) {
  ensureEffectTextures(scene);

  [
    { delay: 0, duration: 450 },
    { delay: 120, duration: 550 },
    { delay: 240, duration: 650 },
  ].forEach(({ delay, duration }) => {
    const ripple = scene.add
      .image(x, y, RIPPLE_RING_TEXTURE)
      .setDepth(RIPPLE_DEPTH)
      .setScale(0.3)
      .setAlpha(0.55);

    scene.tweens.add({
      targets: ripple,
      scale: 2.2,
      alpha: 0,
      duration,
      delay,
      ease: 'Quad.easeOut',
      onComplete: () => {
        ripple.destroy();
      },
    });
  });

  const droplets = scene.add.particles(x, y, DROPLET_TEXTURE, {
    emitting: false,
    lifespan: SPLASH_LIFESPAN_MS,
    speed: { min: 30, max: 90 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.9, end: 0 },
    alpha: { start: 0.85, end: 0 },
    gravityX: 0,
    gravityY: 0,
  });
  droplets.setDepth(BURST_DEPTH);
  droplets.explode(8);

  scene.time.delayedCall(SPLASH_LIFESPAN_MS, () => {
    droplets.destroy();
  });
}
