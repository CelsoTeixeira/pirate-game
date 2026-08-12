import Phaser from 'phaser';

export class StartScene extends Phaser.Scene {
  constructor() {
    super('StartScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#082f49');

    this.add.text(480, 210, 'PIRATE GAME', {
      color: '#e0f2fe',
      fontFamily: 'monospace',
      fontSize: '32px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(480, 290, '[ENTER] or [SPACE] begin', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '16px',
    }).setOrigin(0.5);

    this.input.keyboard?.once('keydown-ENTER', () => {
      this.scene.start('ModularShipScene');
    });
    this.input.keyboard?.once('keydown-SPACE', () => {
      this.scene.start('ModularShipScene');
    });
  }
}
