import Phaser from 'phaser';
import type { GeneratedWind } from '../world/generation/wind';

const WIND_GUIDE_DEPTH = -4;
const WIND_GUIDE_COLOR = 0x67e8f9;
const WIND_GUIDE_OFFSET = 224;
const WIND_GUIDE_LINE_WIDTH = 3;
const WIND_GUIDE_LINE_ALPHA = 0.42;
const WIND_GUIDE_DASH_LENGTH = 42;
const WIND_GUIDE_GAP_LENGTH = 28;
const WIND_GUIDE_PULSE_DURATION_MS = 1800;

/**
 * Adds a pair of subtle current seams alongside each generated wind loop.
 * These marks are presentation-only: the generated loop remains the source
 * of truth for wind sampling and gameplay.
 */
export class WindPathGuides {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly pulse: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    wind: GeneratedWind,
    tileSize: number,
  ) {
    this.graphics = scene.add.graphics()
      .setDepth(WIND_GUIDE_DEPTH)
      .setAlpha(0.78);
    this.draw(wind, tileSize);
    this.pulse = scene.tweens.add({
      targets: this.graphics,
      alpha: { from: 0.72, to: 1 },
      duration: WIND_GUIDE_PULSE_DURATION_MS,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  destroy() {
    this.pulse.stop();
    this.graphics.destroy();
  }

  private draw(wind: GeneratedWind, tileSize: number) {
    this.graphics.lineStyle(
      WIND_GUIDE_LINE_WIDTH,
      WIND_GUIDE_COLOR,
      WIND_GUIDE_LINE_ALPHA,
    );

    wind.loops.forEach((loop) => {
      if (loop.points.length < 2) {
        return;
      }

      for (let index = 0; index < loop.points.length; index += 1) {
        const start = loop.points[index];
        const end = loop.points[(index + 1) % loop.points.length];
        const startX = start.x * tileSize;
        const startY = start.y * tileSize;
        const endX = end.x * tileSize;
        const endY = end.y * tileSize;
        this.drawDashedSegment(startX, startY, endX, endY, 1);
        this.drawDashedSegment(startX, startY, endX, endY, -1);
      }
    });
  }

  private drawDashedSegment(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    side: 1 | -1,
  ) {
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const length = Math.hypot(deltaX, deltaY);
    if (length === 0) {
      return;
    }

    const directionX = deltaX / length;
    const directionY = deltaY / length;
    const normalX = -directionY * WIND_GUIDE_OFFSET * side;
    const normalY = directionX * WIND_GUIDE_OFFSET * side;

    for (
      let distance = 0;
      distance < length;
      distance += WIND_GUIDE_DASH_LENGTH + WIND_GUIDE_GAP_LENGTH
    ) {
      const dashEnd = Math.min(distance + WIND_GUIDE_DASH_LENGTH, length);
      this.graphics.lineBetween(
        startX + normalX + directionX * distance,
        startY + normalY + directionY * distance,
        startX + normalX + directionX * dashEnd,
        startY + normalY + directionY * dashEnd,
      );
    }
  }
}
