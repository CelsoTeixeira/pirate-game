import Phaser from 'phaser';

type MovementKey = 'up' | 'down' | 'left' | 'right';

export class KeyboardControls {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys?: Record<MovementKey, Phaser.Input.Keyboard.Key>;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;

    if (!keyboard) {
      return;
    }

    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<MovementKey, Phaser.Input.Keyboard.Key>;
  }

  getDirection(): Phaser.Math.Vector2 {
    const left = this.cursors?.left.isDown || this.keys?.left.isDown;
    const right = this.cursors?.right.isDown || this.keys?.right.isDown;
    const up = this.cursors?.up.isDown || this.keys?.up.isDown;
    const down = this.cursors?.down.isDown || this.keys?.down.isDown;

    return new Phaser.Math.Vector2(
      Number(Boolean(right)) - Number(Boolean(left)),
      Number(Boolean(down)) - Number(Boolean(up)),
    );
  }
}
