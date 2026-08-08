import Phaser from 'phaser';

const TARGET_TEXTURE_KEY = 'target';
const TARGET_TEXTURE_SIZE = 32;
const TARGET_TEXTURE_CENTER = TARGET_TEXTURE_SIZE / 2;
const TARGET_RING_RADIUS = 10;
const TARGET_LINE_GAP = 12;
const TARGET_LINE_LENGTH = 6;
const TARGET_DEPTH = 1000;

export class TargetReticle extends Phaser.GameObjects.Image {
  constructor(scene: Phaser.Scene, x = 0, y = 0) {
    TargetReticle.ensureTexture(scene);

    super(scene, x, y, TARGET_TEXTURE_KEY);

    scene.add.existing(this);

    this.setDepth(TARGET_DEPTH);
    this.setVisible(false);
  }

  static ensureTexture(scene: Phaser.Scene) {
    if (scene.textures.exists(TARGET_TEXTURE_KEY)) {
      return;
    }

    const graphics = scene.make.graphics({ x: 0, y: 0 });

    graphics.lineStyle(2, 0xffdddd, 1);
    graphics.strokeCircle(TARGET_TEXTURE_CENTER, TARGET_TEXTURE_CENTER, TARGET_RING_RADIUS);

    graphics.lineBetween(
      TARGET_TEXTURE_CENTER,
      TARGET_TEXTURE_CENTER - TARGET_LINE_GAP,
      TARGET_TEXTURE_CENTER,
      TARGET_TEXTURE_CENTER - TARGET_LINE_GAP - TARGET_LINE_LENGTH,
    );
    graphics.lineBetween(
      TARGET_TEXTURE_CENTER + TARGET_LINE_GAP,
      TARGET_TEXTURE_CENTER,
      TARGET_TEXTURE_CENTER + TARGET_LINE_GAP + TARGET_LINE_LENGTH,
      TARGET_TEXTURE_CENTER,
    );
    graphics.lineBetween(
      TARGET_TEXTURE_CENTER,
      TARGET_TEXTURE_CENTER + TARGET_LINE_GAP,
      TARGET_TEXTURE_CENTER,
      TARGET_TEXTURE_CENTER + TARGET_LINE_GAP + TARGET_LINE_LENGTH,
    );
    graphics.lineBetween(
      TARGET_TEXTURE_CENTER - TARGET_LINE_GAP,
      TARGET_TEXTURE_CENTER,
      TARGET_TEXTURE_CENTER - TARGET_LINE_GAP - TARGET_LINE_LENGTH,
      TARGET_TEXTURE_CENTER,
    );

    graphics.generateTexture(TARGET_TEXTURE_KEY, TARGET_TEXTURE_SIZE, TARGET_TEXTURE_SIZE);
    graphics.destroy();
  }
}
