import Phaser from 'phaser';
import { ModularShip } from '../entities/ModularShip';

type CannonState = {
  placement: 'palette' | 'ship';
  homeX: number;
  homeY: number;
};

const SHIP_X = 400;
const SHIP_Y = 300;
const SHIP_SCALE = 1.05;
const PALETTE_X = 770;
const PALETTE_Y = 230;
const PALETTE_CANNON_SCALE = 0.16;
const REMOVE_ZONE_X = 770;
const REMOVE_ZONE_Y = 390;
const REMOVE_ZONE_WIDTH = 220;
const REMOVE_ZONE_HEIGHT = 82;

export class ModularShipScene extends Phaser.Scene {
  private ship?: ModularShip;
  private removeZone?: Phaser.GameObjects.Zone;
  private cannonCountText?: Phaser.GameObjects.Text;
  private readonly cannonStates = new Map<Phaser.GameObjects.Image, CannonState>();

  constructor() {
    super('ModularShipScene');
  }

  preload() {
    ModularShip.preload(this);
  }

  create() {
    this.cannonStates.clear();
    this.cameras.main.setBackgroundColor('#082f49');

    this.add.text(24, 18, 'SHIP BUILDER', {
      color: '#e0f2fe',
      fontFamily: 'monospace',
      fontSize: '22px',
      fontStyle: 'bold',
    });
    this.add.text(24, 49, 'Drag cannons onto either side of the hull. Move them to build your layout.', {
      color: '#7dd3fc',
      fontFamily: 'monospace',
      fontSize: '13px',
    });

    this.ship = new ModularShip(this, SHIP_X, SHIP_Y, {
      size: 'small',
      sailState: 'closed',
    }).setScale(SHIP_SCALE);

    this.add.rectangle(770, 267, 260, 300, 0x0c4a6e, 0.55)
      .setStrokeStyle(1, 0x38bdf8, 0.45);
    this.add.text(PALETTE_X, 144, 'CANNON', {
      color: '#e0f2fe',
      fontFamily: 'monospace',
      fontSize: '16px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(PALETTE_X, 171, 'drag a copy to the ship', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '11px',
    }).setOrigin(0.5);

    this.createPaletteCannon();
    this.createRemoveZone();

    this.cannonCountText = this.add.text(PALETTE_X, 474, '', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '12px',
    }).setOrigin(0.5);
    this.updateCannonCount();

    this.add.text(480, 516, '[SPACE] continue to the current game scene', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '12px',
    }).setOrigin(0.5);

    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('GameScene'));
  }

  private createPaletteCannon() {
    if (!this.ship) {
      return;
    }

    const cannon = this.ship.createCannon(PALETTE_X, PALETTE_Y).setScale(PALETTE_CANNON_SCALE);
    this.add.existing(cannon);

    this.configureDraggableCannon(cannon, {
      placement: 'palette',
      homeX: PALETTE_X,
      homeY: PALETTE_Y,
    });
  }

  private createRemoveZone() {
    this.add.rectangle(
      REMOVE_ZONE_X,
      REMOVE_ZONE_Y,
      REMOVE_ZONE_WIDTH,
      REMOVE_ZONE_HEIGHT,
      0x7f1d1d,
      0.75,
    ).setStrokeStyle(1, 0xfca5a5, 0.8);
    this.add.text(REMOVE_ZONE_X, REMOVE_ZONE_Y, 'DROP HERE TO REMOVE', {
      color: '#fee2e2',
      fontFamily: 'monospace',
      fontSize: '12px',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.removeZone = this.add.zone(
      REMOVE_ZONE_X,
      REMOVE_ZONE_Y,
      REMOVE_ZONE_WIDTH,
      REMOVE_ZONE_HEIGHT,
    ).setRectangleDropZone(REMOVE_ZONE_WIDTH, REMOVE_ZONE_HEIGHT);
  }

  private configureDraggableCannon(cannon: Phaser.GameObjects.Image, state: CannonState) {
    this.cannonStates.set(cannon, state);
    this.input.setDraggable(cannon);

    cannon.on(
      Phaser.Input.Events.DRAG,
      (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => cannon.setPosition(dragX, dragY),
    );
    cannon.on(
      Phaser.Input.Events.DROP,
      (_pointer: Phaser.Input.Pointer, dropZone: Phaser.GameObjects.GameObject) => {
        if (dropZone === this.ship?.cannonDropZone) {
          this.dropOnShip(cannon, state);
          return;
        }

        if (dropZone === this.removeZone) {
          this.dropOnRemoveZone(cannon, state);
        }
      },
    );
    cannon.on(
      Phaser.Input.Events.DRAG_END,
      (_pointer: Phaser.Input.Pointer, _dragX: number, _dragY: number, dropped: boolean) => {
        if (dropped) {
          return;
        }

        if (state.placement === 'palette') {
          cannon.setPosition(state.homeX, state.homeY);
          return;
        }

        this.removeCannon(cannon);
      },
    );
  }

  private dropOnShip(cannon: Phaser.GameObjects.Image, state: CannonState) {
    if (!this.ship) {
      return;
    }

    if (state.placement === 'palette') {
      this.ship.mountCannon(cannon, cannon.x, cannon.y);
      state.placement = 'ship';
      this.createPaletteCannon();
      this.updateCannonCount();
      return;
    }

    this.ship.repositionCannon(cannon);
  }

  private dropOnRemoveZone(cannon: Phaser.GameObjects.Image, state: CannonState) {
    if (state.placement === 'palette') {
      cannon.setPosition(state.homeX, state.homeY);
      return;
    }

    this.removeCannon(cannon);
  }

  private removeCannon(cannon: Phaser.GameObjects.Image) {
    this.cannonStates.delete(cannon);
    cannon.destroy();
    this.updateCannonCount();
  }

  private updateCannonCount() {
    const count = [...this.cannonStates.values()].filter(({ placement }) => placement === 'ship').length;
    this.cannonCountText?.setText(`${count} cannon${count === 1 ? '' : 's'} mounted`);
  }
}
