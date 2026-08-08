import Phaser from 'phaser';

export const SMOKE_TEXTURE = 'effect-smoke';
export const SPARK_TEXTURE = 'effect-spark';
export const SPLINTER_TEXTURE = 'effect-splinter';
export const DROPLET_TEXTURE = 'effect-droplet';
export const RIPPLE_RING_TEXTURE = 'effect-ripple-ring';
export const FLASH_TEXTURE = 'effect-flash';

export function ensureEffectTextures(scene: Phaser.Scene) {
  if (
    scene.textures.exists(SMOKE_TEXTURE) &&
    scene.textures.exists(SPARK_TEXTURE) &&
    scene.textures.exists(SPLINTER_TEXTURE) &&
    scene.textures.exists(DROPLET_TEXTURE) &&
    scene.textures.exists(RIPPLE_RING_TEXTURE) &&
    scene.textures.exists(FLASH_TEXTURE)
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

  if (!scene.textures.exists(FLASH_TEXTURE)) {
    graphics.clear();
    graphics.fillStyle(0xffffff, 0.95);
    graphics.fillCircle(8, 8, 7);
    graphics.fillStyle(0xfacc15, 0.9);
    graphics.fillCircle(8, 8, 4);
    graphics.generateTexture(FLASH_TEXTURE, 16, 16);
  }

  graphics.destroy();
}
