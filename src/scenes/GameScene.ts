import Phaser from 'phaser';
import { Ship } from '../entities/Ship';
import { KeyboardControls } from '../input/KeyboardControls';

export class GameScene extends Phaser.Scene {
  private playerShip?: Ship;
  private controls?: KeyboardControls;
  private damageKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super('GameScene');
  }

  preload() {
    Ship.preload(this);
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
    this.damageKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.H);
  }

  update(_time: number, delta: number) {
    if (!this.playerShip || !this.controls) {
      return;
    }

    this.playerShip.move(this.controls.getDirection(), delta);

    if (this.damageKey && Phaser.Input.Keyboard.JustDown(this.damageKey)) {
      this.playerShip.takeDamage(25);
    }
  }
}
