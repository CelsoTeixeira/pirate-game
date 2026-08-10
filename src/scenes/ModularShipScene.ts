import Phaser from 'phaser';
import { ModularShip, type ModularShipSize } from '../entities/ModularShip';

type CannonState = {
  placement: 'palette' | 'ship';
  homeX: number;
  homeY: number;
  dragStartX?: number;
  dragStartY?: number;
};

type SizeButton = {
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

const SHIP_X = 400;
const SHIP_Y = 300;
const SHIP_DISPLAY_SCALES: Record<ModularShipSize, number> = {
  small: 1.05,
  medium: 0.48,
  big: 0.39,
};
const PALETTE_X = 770;
const PALETTE_Y = 230;
const PALETTE_CANNON_SCALE = 0.16;
const CANNON_ROTATION_STEP = 15;
const SHIP_SIZE_Y = 99;
const SHIP_SIZE_BUTTON_WIDTH = 74;
const SHIP_SIZE_BUTTON_HEIGHT = 28;
const SHIP_SIZE_OPTIONS: ReadonlyArray<{ size: ModularShipSize; label: string }> = [
  { size: 'small', label: 'SMALL' },
  { size: 'medium', label: 'MEDIUM' },
  { size: 'big', label: 'BIG' },
];

export class ModularShipScene extends Phaser.Scene {
  private ship?: ModularShip;
  private cannonCountText?: Phaser.GameObjects.Text;
  private selectedCannon?: Phaser.GameObjects.Image;
  private selectedCannonControls?: Phaser.GameObjects.Container;
  private selectedCannonAngleText?: Phaser.GameObjects.Text;
  private readonly selectedCannonButtons: Phaser.GameObjects.Rectangle[] = [];
  private readonly cannonStates = new Map<Phaser.GameObjects.Image, CannonState>();
  private readonly sizeButtons = new Map<ModularShipSize, SizeButton>();

  constructor() {
    super('ModularShipScene');
  }

  preload() {
    ModularShip.preload(this);
  }

  create() {
    this.cannonStates.clear();
    this.selectedCannon = undefined;
    this.selectedCannonButtons.length = 0;
    this.sizeButtons.clear();
    this.cameras.main.setBackgroundColor('#082f49');

    this.add.text(24, 18, 'SHIP BUILDER', {
      color: '#e0f2fe',
      fontFamily: 'monospace',
      fontSize: '22px',
      fontStyle: 'bold',
    });
    this.add.text(24, 49, 'Drag cannons onto the hull. Click a mounted cannon to move, rotate, or remove it.', {
      color: '#7dd3fc',
      fontFamily: 'monospace',
      fontSize: '13px',
    });

    this.ship = new ModularShip(this, SHIP_X, SHIP_Y, {
      size: 'small',
      sailState: 'closed',
    }).setScale(SHIP_DISPLAY_SCALES.small);

    this.createSizeControls();

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
    this.createSelectedCannonControls();

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

  private createSizeControls() {
    this.add.text(PALETTE_X, 73, 'SHIP SIZE', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '11px',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    SHIP_SIZE_OPTIONS.forEach(({ size, label }, index) => {
      const x = PALETTE_X + (index - 1) * 82;
      const background = this.add.rectangle(
        x,
        SHIP_SIZE_Y,
        SHIP_SIZE_BUTTON_WIDTH,
        SHIP_SIZE_BUTTON_HEIGHT,
      ).setInteractive({ useHandCursor: true });
      const buttonLabel = this.add.text(x, SHIP_SIZE_Y, label, {
        fontFamily: 'monospace',
        fontSize: '11px',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      background.on(Phaser.Input.Events.POINTER_DOWN, () => {
        this.ship?.setShipSize(size).setScale(SHIP_DISPLAY_SCALES[size]);
        this.refreshSizeControls();
      });
      this.sizeButtons.set(size, { background, label: buttonLabel });
    });

    this.refreshSizeControls();
  }

  private refreshSizeControls() {
    const selectedSize = this.ship?.config.size;

    for (const [size, { background, label }] of this.sizeButtons) {
      const isSelected = size === selectedSize;
      background
        .setFillStyle(isSelected ? 0x0284c7 : 0x0c4a6e, isSelected ? 1 : 0.65)
        .setStrokeStyle(1, isSelected ? 0xe0f2fe : 0x38bdf8, isSelected ? 1 : 0.45);
      label.setColor(isSelected ? '#ffffff' : '#bae6fd');
    }
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

  private createSelectedCannonControls() {
    const frame = this.add.rectangle(PALETTE_X, 351, 226, 130, 0x082f49, 0.85)
      .setStrokeStyle(2, 0x22d3ee, 0.95);
    const heading = this.add.text(PALETTE_X, 300, 'EDITING CANNON', {
      color: '#67e8f9',
      fontFamily: 'monospace',
      fontSize: '12px',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.selectedCannonAngleText = this.add.text(PALETTE_X, 325, '', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '11px',
    }).setOrigin(0.5);

    const rotateLeftButton = this.createCannonControlButton(
      PALETTE_X - 55,
      354,
      96,
      32,
      '-15\u00b0',
      () => this.rotateSelectedCannon(-CANNON_ROTATION_STEP),
    );
    const rotateRightButton = this.createCannonControlButton(
      PALETTE_X + 55,
      354,
      96,
      32,
      '+15\u00b0',
      () => this.rotateSelectedCannon(CANNON_ROTATION_STEP),
    );
    const removeButton = this.createCannonControlButton(
      PALETTE_X,
      397,
      206,
      34,
      'REMOVE CANNON',
      () => {
        if (this.selectedCannon) {
          this.removeCannon(this.selectedCannon);
        }
      },
      true,
    );

    this.selectedCannonControls = this.add.container(0, 0, [
      frame,
      heading,
      this.selectedCannonAngleText,
      ...rotateLeftButton,
      ...rotateRightButton,
      ...removeButton,
    ]);
    this.refreshSelectedCannonControls();
  }

  private createCannonControlButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    destructive = false,
  ): [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Text] {
    const background = this.add.rectangle(
      x,
      y,
      width,
      height,
      destructive ? 0x7f1d1d : 0x075985,
      0.9,
    )
      .setStrokeStyle(1, destructive ? 0xfca5a5 : 0x7dd3fc, 0.8)
      .setInteractive({ useHandCursor: true });
    const buttonLabel = this.add.text(x, y, label, {
      color: destructive ? '#fee2e2' : '#e0f2fe',
      fontFamily: 'monospace',
      fontSize: '11px',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    background.on(Phaser.Input.Events.POINTER_DOWN, onClick);
    this.selectedCannonButtons.push(background);
    return [background, buttonLabel];
  }

  private configureDraggableCannon(cannon: Phaser.GameObjects.Image, state: CannonState) {
    this.cannonStates.set(cannon, state);
    this.input.setDraggable(cannon);

    cannon.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (state.placement === 'ship') {
        this.selectCannon(cannon);
      }
    });
    cannon.on(Phaser.Input.Events.DRAG_START, () => {
      if (state.placement === 'ship') {
        state.dragStartX = cannon.x;
        state.dragStartY = cannon.y;
      }
    });
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

        cannon.setPosition(state.dragStartX ?? cannon.x, state.dragStartY ?? cannon.y);
        this.ship?.repositionCannon(cannon);
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
      this.selectCannon(cannon);
      this.createPaletteCannon();
      this.updateCannonCount();
      return;
    }

    this.ship.repositionCannon(cannon);
    this.selectCannon(cannon);
  }

  private removeCannon(cannon: Phaser.GameObjects.Image) {
    if (this.selectedCannon === cannon) {
      this.selectCannon(undefined);
    }
    this.cannonStates.delete(cannon);
    cannon.destroy();
    this.updateCannonCount();
  }

  private selectCannon(cannon: Phaser.GameObjects.Image | undefined) {
    this.selectedCannon = cannon;

    if (cannon) {
      this.ship?.bringCannonToFront(cannon);
    }

    for (const [mountedCannon, state] of this.cannonStates) {
      if (state.placement !== 'ship') {
        continue;
      }

      mountedCannon.clearTint().setAlpha(1);

      if (cannon) {
        if (mountedCannon === cannon) {
          mountedCannon.setTintFill(0x22d3ee);
        } else {
          mountedCannon.setAlpha(0.5);
        }
      }
    }

    this.refreshSelectedCannonControls();
  }

  private rotateSelectedCannon(delta: number) {
    if (!this.selectedCannon) {
      return;
    }

    this.selectedCannon.setAngle(this.selectedCannon.angle + delta);
    this.refreshSelectedCannonControls();
  }

  private refreshSelectedCannonControls() {
    const hasSelection = Boolean(this.selectedCannon);
    this.selectedCannonControls?.setVisible(hasSelection);

    for (const button of this.selectedCannonButtons) {
      if (hasSelection) {
        button.setInteractive({ useHandCursor: true });
      } else {
        button.disableInteractive();
      }
    }

    if (this.selectedCannon) {
      const angle = Phaser.Math.Wrap(Math.round(this.selectedCannon.angle), 0, 360);
      this.selectedCannonAngleText?.setText(`ANGLE ${angle}\u00b0`);
    }
  }

  private updateCannonCount() {
    const count = [...this.cannonStates.values()].filter(({ placement }) => placement === 'ship').length;
    this.cannonCountText?.setText(`${count} cannon${count === 1 ? '' : 's'} mounted`);
  }
}
