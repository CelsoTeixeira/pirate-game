import Phaser from 'phaser';
import type { RudderDirection } from '../entities/Ship';

type MovementKey = 'up' | 'down' | 'left' | 'right';

export class KeyboardControls {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys?: Record<MovementKey, Phaser.Input.Keyboard.Key>;
  private anchorToggleKey?: Phaser.Input.Keyboard.Key;
  private aimToggleKey?: Phaser.Input.Keyboard.Key;

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
    this.anchorToggleKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.aimToggleKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  getRudder(): RudderDirection {
    const left = this.cursors?.left.isDown || this.keys?.left.isDown;
    const right = this.cursors?.right.isDown || this.keys?.right.isDown;

    return (Number(Boolean(right)) - Number(Boolean(left))) as RudderDirection;
  }

  isSailUpJustPressed(): boolean {
    return Boolean(
      (this.cursors?.up && Phaser.Input.Keyboard.JustDown(this.cursors.up)) ||
        (this.keys?.up && Phaser.Input.Keyboard.JustDown(this.keys.up)),
    );
  }

  isSailDownJustPressed(): boolean {
    return Boolean(
      (this.cursors?.down && Phaser.Input.Keyboard.JustDown(this.cursors.down)) ||
        (this.keys?.down && Phaser.Input.Keyboard.JustDown(this.keys.down)),
    );
  }

  isAnchorTogglePressed(): boolean {
    return Boolean(this.anchorToggleKey && Phaser.Input.Keyboard.JustDown(this.anchorToggleKey));
  }

  isAimTogglePressed(): boolean {
    return Boolean(this.aimToggleKey && Phaser.Input.Keyboard.JustDown(this.aimToggleKey));
  }

  reset() {
    this.cursors?.up.reset();
    this.cursors?.down.reset();
    this.cursors?.left.reset();
    this.cursors?.right.reset();
    Object.values(this.keys ?? {}).forEach((key) => key.reset());
    this.anchorToggleKey?.reset();
    this.aimToggleKey?.reset();
  }
}
