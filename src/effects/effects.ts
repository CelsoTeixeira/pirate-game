import Phaser from 'phaser';

const SMOKE_TEXTURE = 'effect-smoke';
const SPARK_TEXTURE = 'effect-spark';
const SPLINTER_TEXTURE = 'effect-splinter';
const DROPLET_TEXTURE = 'effect-droplet';
const RIPPLE_RING_TEXTURE = 'effect-ripple-ring';

const TRAIL_DEPTH = 5;
const BURST_DEPTH = 10;
const RIPPLE_DEPTH = -1;
const TRAIL_LIFESPAN_MS = 350;
const IMPACT_LIFESPAN_MS = 450;
const SPLASH_LIFESPAN_MS = 300;

export function ensureEffectTextures(scene: Phaser.Scene) {
  if (
    scene.textures.exists(SMOKE_TEXTURE) &&
    scene.textures.exists(SPARK_TEXTURE) &&
    scene.textures.exists(SPLINTER_TEXTURE) &&
    scene.textures.exists(DROPLET_TEXTURE) &&
    scene.textures.exists(RIPPLE_RING_TEXTURE)
  ) {
    return;
  }

  const graphics = scene.add.graphics();

  if (!scene.textures.exists(SMOKE_TEXTURE)) {
    graphics.clear();
    graphics.fillStyle(0xd1d5db, 0.25);
    graphics.fillCircle(4, 4, 4);
    graphics.fillStyle(0xf3f4f6, 0.45);
    graphics.fillCircle(4, 4, 2.5);
    graphics.generateTexture(SMOKE_TEXTURE, 8, 8);
  }

  if (!scene.textures.exists(SPARK_TEXTURE)) {
    graphics.clear();
    graphics.fillStyle(0xf97316, 1);
    graphics.fillRect(0, 0, 4, 4);
    graphics.fillStyle(0xfacc15, 1);
    graphics.fillRect(1, 1, 2, 2);
    graphics.generateTexture(SPARK_TEXTURE, 4, 4);
  }

  if (!scene.textures.exists(SPLINTER_TEXTURE)) {
    graphics.clear();
    graphics.fillStyle(0x7c2d12, 1);
    graphics.fillRect(0, 1, 6, 2);
    graphics.fillStyle(0xb45309, 1);
    graphics.fillRect(1, 0, 4, 1);
    graphics.generateTexture(SPLINTER_TEXTURE, 6, 4);
  }

  if (!scene.textures.exists(DROPLET_TEXTURE)) {
    graphics.clear();
    graphics.fillStyle(0xf8fafc, 1);
    graphics.fillCircle(2, 2, 2);
    graphics.fillStyle(0xbfdbfe, 0.85);
    graphics.fillCircle(2, 3, 1);
    graphics.generateTexture(DROPLET_TEXTURE, 4, 4);
  }

  if (!scene.textures.exists(RIPPLE_RING_TEXTURE)) {
    graphics.clear();
    graphics.lineStyle(2, 0xe0f2fe, 0.9);
    graphics.strokeCircle(12, 12, 10.5);
    graphics.generateTexture(RIPPLE_RING_TEXTURE, 24, 24);
  }

  graphics.destroy();
}

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
