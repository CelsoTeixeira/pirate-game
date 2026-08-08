import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  private ship?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys?: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

  constructor() {
    super('GameScene');
  }

  preload() {
    const shipTexture = this.textures.createCanvas('ship', 48, 32);

    if (!shipTexture) {
      return;
    }

    const context = shipTexture.getContext();

    context.fillStyle = '#b45309';
    context.fillRect(8, 12, 32, 12);
    context.fillStyle = '#facc15';
    context.beginPath();
    context.moveTo(26, 2);
    context.lineTo(42, 16);
    context.lineTo(26, 16);
    context.closePath();
    context.fill();
    context.fillStyle = '#f8fafc';
    context.fillRect(23, 2, 3, 22);

    shipTexture.refresh();
  }

  create() {
    this.cameras.main.setBackgroundColor('#082f49');

    this.add.text(16, 16, 'pirate-game', {
      color: '#e0f2fe',
      fontFamily: 'monospace',
      fontSize: '18px',
    });

    this.ship = this.physics.add.sprite(480, 270, 'ship');
    this.ship.setCollideWorldBounds(true);

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  }

  update() {
    if (!this.ship) {
      return;
    }

    const speed = 220;
    const left = this.cursors?.left.isDown || this.keys?.left.isDown;
    const right = this.cursors?.right.isDown || this.keys?.right.isDown;
    const up = this.cursors?.up.isDown || this.keys?.up.isDown;
    const down = this.cursors?.down.isDown || this.keys?.down.isDown;

    this.ship.setVelocity(0);

    if (left) {
      this.ship.setVelocityX(-speed);
    } else if (right) {
      this.ship.setVelocityX(speed);
    }

    if (up) {
      this.ship.setVelocityY(-speed);
    } else if (down) {
      this.ship.setVelocityY(speed);
    }

    this.ship.body.velocity.normalize().scale(speed);
  }
}
