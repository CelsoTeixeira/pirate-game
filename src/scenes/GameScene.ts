import Phaser from 'phaser';
import { CannonBall } from '../entities/CannonBall';
import { Ship } from '../entities/Ship';
import { TargetReticle } from '../entities/TargetReticle';
import { KeyboardControls } from '../input/KeyboardControls';

const CANNON_BALL_SPAWN_OFFSET = 36;

export class GameScene extends Phaser.Scene {
  private playerShip?: Ship;
  private controls?: KeyboardControls;
  private damageKey?: Phaser.Input.Keyboard.Key;
  private targetReticle?: TargetReticle;
  private aimMode = false;

  constructor() {
    super('GameScene');
  }

  preload() {
    Ship.preload(this);
    CannonBall.preload(this);
  }

  create() {
    this.cameras.main.setBackgroundColor('#082f49');

    this.add.text(16, 16, 'pirate-game', {
      color: '#e0f2fe',
      fontFamily: 'monospace',
      fontSize: '18px',
    });

    this.controls = new KeyboardControls(this);
    this.playerShip = new Ship(this, 480, 270, 'pirate');
    this.targetReticle = new TargetReticle(this);
    this.damageKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.input.on('pointerdown', this.handlePointerDown, this);
  }

  update(_time: number, delta: number) {
    if (!this.playerShip || !this.controls) {
      return;
    }

    this.playerShip.move(this.controls.getDirection(), delta);

    if (this.controls.isAimTogglePressed()) {
      this.aimMode = !this.aimMode;
      this.targetReticle?.setVisible(this.aimMode);
    }

    if (this.aimMode && this.targetReticle) {
      const pointer = this.input.activePointer;
      this.targetReticle.setPosition(pointer.worldX, pointer.worldY);
    }

    if (this.damageKey && Phaser.Input.Keyboard.JustDown(this.damageKey)) {
      this.playerShip.takeDamage(25);
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    if (!this.aimMode || !this.playerShip || !this.targetReticle || this.playerShip.isDestroyed) {
      return;
    }

    if (!pointer.leftButtonDown()) {
      return;
    }

    const targetX = this.targetReticle.x;
    const targetY = this.targetReticle.y;
    const angle = Phaser.Math.Angle.Between(this.playerShip.x, this.playerShip.y, targetX, targetY);
    const x = this.playerShip.x + Math.cos(angle) * CANNON_BALL_SPAWN_OFFSET;
    const y = this.playerShip.y + Math.sin(angle) * CANNON_BALL_SPAWN_OFFSET;

    new CannonBall(this, x, y, targetX, targetY);
  }
}
