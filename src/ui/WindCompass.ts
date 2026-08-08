import Phaser from 'phaser';

type WindCompassWind = {
  directionRad: number;
  strength: number;
};

const COMPASS_RADIUS = 26;
const COMPASS_BG_COLOR = 0x020617;
const COMPASS_BG_ALPHA = 0.35;
const COMPASS_RIM_COLOR = 0xe0f2fe;
const COMPASS_RIM_ALPHA = 0.55;
const COMPASS_RIM_WIDTH = 1;
const ARROW_COLOR = 0xfef3c7;
const ARROW_ALPHA = 0.95;
const PIP_RADIUS = 3;
const PIP_SPACING = 10;
const PIP_Y = COMPASS_RADIUS + 9;
const PIP_FILLED_ALPHA = 0.9;
const PIP_EMPTY_ALPHA = 0.2;
const HUD_DEPTH = 100;
const DEFAULT_MARGIN = 44;

export class WindCompass extends Phaser.GameObjects.Container {
  private readonly arrow: Phaser.GameObjects.Graphics;
  private readonly pips: Phaser.GameObjects.Graphics;
  private filledPipCount = -1;

  constructor(scene: Phaser.Scene, x = scene.scale.width - DEFAULT_MARGIN, y = DEFAULT_MARGIN) {
    super(scene, x, y);

    const background = scene.add.graphics();
    background.fillStyle(COMPASS_BG_COLOR, COMPASS_BG_ALPHA);
    background.fillCircle(0, 0, COMPASS_RADIUS);
    background.lineStyle(COMPASS_RIM_WIDTH, COMPASS_RIM_COLOR, COMPASS_RIM_ALPHA);
    background.strokeCircle(0, 0, COMPASS_RADIUS);

    this.arrow = scene.add.graphics();
    this.arrow.fillStyle(ARROW_COLOR, ARROW_ALPHA);
    this.arrow.fillTriangle(16, 0, 4, -7, 4, 7);
    this.arrow.fillRect(-10, -2, 16, 4);

    this.pips = scene.add.graphics();

    this.add([background, this.arrow, this.pips]);
    scene.add.existing(this);

    this.setScrollFactor(0);
    this.setDepth(HUD_DEPTH);
    this.update({ directionRad: 0, strength: 0 });
  }

  update(wind: WindCompassWind) {
    this.arrow.rotation = wind.directionRad;

    const filledPipCount = Math.round(Phaser.Math.Clamp(wind.strength, 0, 1) * 3);

    if (filledPipCount === this.filledPipCount) {
      return;
    }

    this.filledPipCount = filledPipCount;
    this.drawPips();
  }

  private drawPips() {
    this.pips.clear();

    for (let index = 0; index < 3; index += 1) {
      const x = (index - 1) * PIP_SPACING;
      const filled = index < this.filledPipCount;

      this.pips.fillStyle(COMPASS_RIM_COLOR, filled ? PIP_FILLED_ALPHA : PIP_EMPTY_ALPHA);
      this.pips.fillCircle(x, PIP_Y, PIP_RADIUS);
    }
  }
}
