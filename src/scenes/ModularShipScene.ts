import Phaser from 'phaser';
import {
  MODULAR_SHIP_SAIL_TINTS,
  ModularShip,
  type ModularShipSailColor,
  type ModularShipSailState,
  type ModularShipSize,
} from '../entities/ModularShip';
import { CannonRangeOverlay } from '../ui/CannonRangeOverlay';
import { CannonTransformGizmo } from '../ui/CannonTransformGizmo';

type BuilderViewMode = 'edit' | 'range';

type CannonState = {
  placement: 'palette' | 'ship';
  homeX: number;
  homeY: number;
};

type ControlButton = {
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

type CameraState = {
  scrollX: number;
  scrollY: number;
  zoom: number;
};

const SHIP_X = 400;
const SHIP_Y = 300;
const SHIP_DISPLAY_SCALES: Record<ModularShipSize, number> = {
  small: 1.05,
  medium: 0.48,
  big: 0.39,
};
const PALETTE_X = 770;
const PALETTE_Y = 320;
const PALETTE_CANNON_SCALE = 0.16;
const VIEW_MODE_Y = 43;
const SHIP_SIZE_Y = 99;
const SHIP_SIZE_BUTTON_WIDTH = 74;
const SHIP_SIZE_BUTTON_HEIGHT = 28;
const SAIL_COLOR_Y = 157;
const SAIL_COLOR_BUTTON_WIDTH = 58;
const SAIL_COLOR_BUTTON_HEIGHT = 26;
const SAIL_STATE_Y = 212;
const RANGE_VIEW_ZOOM = 0.8;
const RANGE_SHIP_SCREEN_X = 330;
const RANGE_SHIP_SCREEN_Y = 270;
const VIEW_MODE_OPTIONS: ReadonlyArray<{ mode: BuilderViewMode; label: string }> = [
  { mode: 'edit', label: 'EDIT' },
  { mode: 'range', label: 'RANGE' },
];
const SHIP_SIZE_OPTIONS: ReadonlyArray<{ size: ModularShipSize; label: string }> = [
  { size: 'small', label: 'SMALL' },
  { size: 'medium', label: 'MEDIUM' },
  { size: 'big', label: 'BIG' },
];
const SAIL_COLOR_OPTIONS: ReadonlyArray<{ color: ModularShipSailColor; label: string }> = [
  { color: 'black', label: 'BLACK' },
  { color: 'crimson', label: 'RED' },
  { color: 'ivory', label: 'IVORY' },
  { color: 'navy', label: 'NAVY' },
];
const SAIL_STATE_OPTIONS: ReadonlyArray<{ state: ModularShipSailState; label: string }> = [
  { state: 'closed', label: 'CLOSED' },
  { state: 'partial', label: 'PARTIAL' },
  { state: 'open', label: 'OPEN' },
];

export class ModularShipScene extends Phaser.Scene {
  private ship?: ModularShip;
  private cannonCountText?: Phaser.GameObjects.Text;
  private builderInstructionsText?: Phaser.GameObjects.Text;
  private paletteHeadingText?: Phaser.GameObjects.Text;
  private paletteInstructionsText?: Phaser.GameObjects.Text;
  private controlsInstructionsText?: Phaser.GameObjects.Text;
  private selectedCannon?: Phaser.GameObjects.Image;
  private cannonTransformGizmo?: CannonTransformGizmo;
  private cannonRangeOverlay?: CannonRangeOverlay;
  private uiRoot?: Phaser.GameObjects.Container;
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  private editCameraState?: CameraState;
  private viewMode: BuilderViewMode = 'edit';
  private viewModeInitialized = false;
  private readonly cannonStates = new Map<Phaser.GameObjects.Image, CannonState>();
  private readonly viewModeButtons = new Map<BuilderViewMode, ControlButton>();
  private readonly sizeButtons = new Map<ModularShipSize, ControlButton>();
  private readonly sailColorButtons = new Map<ModularShipSailColor, ControlButton>();
  private readonly sailStateButtons = new Map<ModularShipSailState, ControlButton>();

  constructor() {
    super('ModularShipScene');
  }

  preload() {
    ModularShip.preload(this);
  }

  create() {
    this.cannonStates.clear();
    this.selectedCannon = undefined;
    this.viewModeButtons.clear();
    this.sizeButtons.clear();
    this.sailColorButtons.clear();
    this.sailStateButtons.clear();
    this.editCameraState = undefined;
    this.viewMode = 'edit';
    this.viewModeInitialized = false;
    this.cameras.main.setBackgroundColor('#082f49').setZoom(1).setScroll(0, 0);

    this.uiRoot = this.add.container(0, 0);
    this.uiCamera = this.cameras.add(
      0,
      0,
      this.scale.width,
      this.scale.height,
      false,
      'BuilderUICamera',
    ).setBackgroundColor('rgba(0, 0, 0, 0)');

    this.addToUi(this.add.text(24, 18, 'SHIP BUILDER', {
      color: '#e0f2fe',
      fontFamily: 'monospace',
      fontSize: '22px',
      fontStyle: 'bold',
    }));
    this.builderInstructionsText = this.addToUi(this.add.text(24, 49, '', {
      color: '#7dd3fc',
      fontFamily: 'monospace',
      fontSize: '13px',
    }));

    this.ship = new ModularShip(this, SHIP_X, SHIP_Y, {
      size: 'small',
      sailState: 'closed',
      sailColor: 'ivory',
    }).setScale(SHIP_DISPLAY_SCALES.small);
    this.cannonTransformGizmo = new CannonTransformGizmo(
      this,
      (cannon) => this.removeCannon(cannon),
    );
    this.cannonRangeOverlay = new CannonRangeOverlay(this);
    this.uiCamera.ignore(this.ship);
    this.cannonTransformGizmo.ignoreBy(this.uiCamera);
    this.cannonRangeOverlay.ignoreBy(this.uiCamera);

    this.addToUi(this.add.rectangle(770, 291, 260, 382, 0x0c4a6e, 0.55)
      .setStrokeStyle(1, 0x38bdf8, 0.45));
    this.createViewModeControls();
    this.createSizeControls();
    this.createSailColorControls();
    this.createSailStateControls();

    this.paletteHeadingText = this.addToUi(this.add.text(PALETTE_X, 250, '', {
      color: '#e0f2fe',
      fontFamily: 'monospace',
      fontSize: '16px',
      fontStyle: 'bold',
    }).setOrigin(0.5));
    this.paletteInstructionsText = this.addToUi(this.add.text(PALETTE_X, 272, '', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '11px',
    }).setOrigin(0.5));

    this.createPaletteCannon();
    this.controlsInstructionsText = this.addToUi(this.add.text(PALETTE_X, 414, '', {
      align: 'center',
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '11px',
      lineSpacing: 7,
    }).setOrigin(0.5));

    this.cannonCountText = this.addToUi(this.add.text(PALETTE_X, 486, '', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '12px',
    }).setOrigin(0.5));
    this.updateCannonCount();

    this.addToUi(this.add.text(480, 516, '[SPACE] continue to the current game scene', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '12px',
    }).setOrigin(0.5));

    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('GameScene'));
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (this.viewMode === 'edit') {
        this.selectCannon(undefined);
      }
    });
    this.setViewMode('edit');
  }

  private addToUi<T extends Phaser.GameObjects.GameObject>(gameObject: T): T {
    this.cameras.main.ignore(gameObject);
    this.uiRoot?.add(gameObject);
    return gameObject;
  }

  private createViewModeControls() {
    this.addToUi(this.add.text(665, VIEW_MODE_Y, 'VIEW', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '11px',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    VIEW_MODE_OPTIONS.forEach(({ mode, label }, index) => {
      const x = 748 + index * 84;
      const background = this.addToUi(this.add.rectangle(
        x,
        VIEW_MODE_Y,
        SHIP_SIZE_BUTTON_WIDTH,
        26,
      ).setInteractive({ useHandCursor: true }));
      const buttonLabel = this.addToUi(this.add.text(x, VIEW_MODE_Y, label, {
        fontFamily: 'monospace',
        fontSize: '11px',
        fontStyle: 'bold',
      }).setOrigin(0.5));

      background.on(Phaser.Input.Events.POINTER_DOWN, (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        this.setViewMode(mode);
      });
      this.viewModeButtons.set(mode, { background, label: buttonLabel });
    });
  }

  private createSizeControls() {
    this.addToUi(this.add.text(PALETTE_X, 73, 'SHIP SIZE', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '11px',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    SHIP_SIZE_OPTIONS.forEach(({ size, label }, index) => {
      const x = PALETTE_X + (index - 1) * 82;
      const background = this.addToUi(this.add.rectangle(
        x,
        SHIP_SIZE_Y,
        SHIP_SIZE_BUTTON_WIDTH,
        SHIP_SIZE_BUTTON_HEIGHT,
      ).setInteractive({ useHandCursor: true }));
      const buttonLabel = this.addToUi(this.add.text(x, SHIP_SIZE_Y, label, {
        fontFamily: 'monospace',
        fontSize: '11px',
        fontStyle: 'bold',
      }).setOrigin(0.5));

      background.on(Phaser.Input.Events.POINTER_DOWN, (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        if (this.viewMode !== 'edit') {
          return;
        }
        this.ship?.setShipSize(size).setScale(SHIP_DISPLAY_SCALES[size]);
        this.refreshSizeControls();
        this.cannonTransformGizmo?.sync();
      });
      this.sizeButtons.set(size, { background, label: buttonLabel });
    });

    this.refreshSizeControls();
  }

  private refreshSizeControls() {
    const selectedSize = this.ship?.config.size;
    const isEnabled = this.viewMode === 'edit';

    for (const [size, { background, label }] of this.sizeButtons) {
      const isSelected = size === selectedSize;
      if (!isEnabled) {
        background
          .setFillStyle(0x334155, 0.45)
          .setStrokeStyle(1, 0x64748b, 0.35);
        label.setColor('#64748b');
        continue;
      }

      background
        .setFillStyle(isSelected ? 0x0284c7 : 0x0c4a6e, isSelected ? 1 : 0.65)
        .setStrokeStyle(1, isSelected ? 0xe0f2fe : 0x38bdf8, isSelected ? 1 : 0.45);
      label.setColor(isSelected ? '#ffffff' : '#bae6fd');
    }
  }

  private createSailColorControls() {
    this.addToUi(this.add.text(PALETTE_X, 130, 'SAIL COLOR', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '11px',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    SAIL_COLOR_OPTIONS.forEach(({ color, label }, index) => {
      const x = PALETTE_X + (index - 1.5) * 62;
      const background = this.addToUi(this.add.rectangle(
        x,
        SAIL_COLOR_Y,
        SAIL_COLOR_BUTTON_WIDTH,
        SAIL_COLOR_BUTTON_HEIGHT,
        MODULAR_SHIP_SAIL_TINTS[color],
      ).setInteractive({ useHandCursor: true }));
      const buttonLabel = this.addToUi(this.add.text(x, SAIL_COLOR_Y, label, {
        color: color === 'ivory' ? '#0f172a' : '#ffffff',
        fontFamily: 'monospace',
        fontSize: '10px',
        fontStyle: 'bold',
      }).setOrigin(0.5));

      background.on(Phaser.Input.Events.POINTER_DOWN, (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        if (this.viewMode !== 'edit') {
          return;
        }
        this.ship?.setSailColor(color);
        this.refreshSailColorControls();
      });
      this.sailColorButtons.set(color, { background, label: buttonLabel });
    });

    this.refreshSailColorControls();
  }

  private refreshSailColorControls() {
    const selectedColor = this.ship?.config.sailColor;
    const isEnabled = this.viewMode === 'edit';

    for (const [color, { background, label }] of this.sailColorButtons) {
      const isSelected = color === selectedColor;
      background
        .setAlpha(isEnabled ? 1 : 0.35)
        .setStrokeStyle(
          isEnabled && isSelected ? 3 : 1,
          isEnabled && isSelected ? 0xffffff : 0x64748b,
          isEnabled ? 1 : 0.35,
        );
      label.setAlpha(isEnabled ? 1 : 0.35);
    }
  }

  private createSailStateControls() {
    this.addToUi(this.add.text(PALETTE_X, 185, 'SAIL STATE', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '11px',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    SAIL_STATE_OPTIONS.forEach(({ state, label }, index) => {
      const x = PALETTE_X + (index - 1) * 82;
      const background = this.addToUi(this.add.rectangle(
        x,
        SAIL_STATE_Y,
        SHIP_SIZE_BUTTON_WIDTH,
        SHIP_SIZE_BUTTON_HEIGHT,
      ).setInteractive({ useHandCursor: true }));
      const buttonLabel = this.addToUi(this.add.text(x, SAIL_STATE_Y, label, {
        fontFamily: 'monospace',
        fontSize: '11px',
        fontStyle: 'bold',
      }).setOrigin(0.5));

      background.on(Phaser.Input.Events.POINTER_DOWN, (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        if (this.viewMode !== 'edit') {
          return;
        }
        this.ship?.setSailState(state);
        this.refreshSailStateControls();
      });
      this.sailStateButtons.set(state, { background, label: buttonLabel });
    });

    this.refreshSailStateControls();
  }

  private refreshSailStateControls() {
    const selectedState = this.ship?.config.sailState;
    const isEnabled = this.viewMode === 'edit';

    for (const [state, { background, label }] of this.sailStateButtons) {
      const isSelected = state === selectedState;
      if (!isEnabled) {
        background
          .setFillStyle(0x334155, 0.45)
          .setStrokeStyle(1, 0x64748b, 0.35);
        label.setColor('#64748b');
        continue;
      }

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
    this.uiCamera?.ignore(cannon);

    this.configureDraggableCannon(cannon, {
      placement: 'palette',
      homeX: PALETTE_X,
      homeY: PALETTE_Y,
    });
  }

  private configureDraggableCannon(cannon: Phaser.GameObjects.Image, state: CannonState) {
    this.cannonStates.set(cannon, state);
    this.input.setDraggable(cannon);

    cannon.on(Phaser.Input.Events.POINTER_DOWN, (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (this.viewMode === 'edit' && state.placement === 'ship') {
        this.selectCannon(cannon);
      }
    });
    cannon.on(
      Phaser.Input.Events.DRAG,
      (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        if (this.viewMode === 'edit' && state.placement === 'palette') {
          cannon.setPosition(dragX, dragY);
        }
      },
    );
    cannon.on(
      Phaser.Input.Events.DROP,
      (_pointer: Phaser.Input.Pointer, dropZone: Phaser.GameObjects.GameObject) => {
        if (
          this.viewMode === 'edit'
          && state.placement === 'palette'
          && dropZone === this.ship?.cannonDropZone
        ) {
          this.dropOnShip(cannon, state);
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
        }
      },
    );
  }

  private dropOnShip(cannon: Phaser.GameObjects.Image, state: CannonState) {
    if (!this.ship || this.viewMode !== 'edit') {
      return;
    }

    if (state.placement === 'palette') {
      this.ship.mountCannon(cannon, cannon.x, cannon.y);
      state.placement = 'ship';
      this.input.setDraggable(cannon, false);
      this.selectCannon(cannon);
      this.createPaletteCannon();
      this.updateCannonCount();
    }
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
    if (this.viewMode !== 'edit') {
      return;
    }

    this.selectedCannon = cannon;

    if (cannon) {
      this.ship?.bringCannonToFront(cannon);
      if (this.ship) {
        this.cannonTransformGizmo?.select(this.ship, cannon);
      }
    } else {
      this.cannonTransformGizmo?.clear();
    }
  }

  private updateCannonCount() {
    const count = [...this.cannonStates.values()].filter(({ placement }) => placement === 'ship').length;
    this.cannonCountText?.setText(`${count} cannon${count === 1 ? '' : 's'} mounted`);
  }

  private setViewMode(mode: BuilderViewMode) {
    if (this.viewModeInitialized && this.viewMode === mode) {
      return;
    }

    const mainCamera = this.cameras.main;
    const isEditMode = mode === 'edit';
    this.viewMode = mode;
    this.viewModeInitialized = true;

    if (isEditMode) {
      this.cannonRangeOverlay?.hide();

      if (this.editCameraState) {
        mainCamera
          .setZoom(this.editCameraState.zoom)
          .setScroll(this.editCameraState.scrollX, this.editCameraState.scrollY);
        this.editCameraState = undefined;
      }

      const selectedState = this.selectedCannon
        ? this.cannonStates.get(this.selectedCannon)
        : undefined;
      if (
        this.ship
        && this.selectedCannon?.active
        && selectedState?.placement === 'ship'
      ) {
        this.cannonTransformGizmo?.select(this.ship, this.selectedCannon);
      } else {
        this.selectedCannon = undefined;
        this.cannonTransformGizmo?.clear();
      }
    } else {
      this.editCameraState = {
        scrollX: mainCamera.scrollX,
        scrollY: mainCamera.scrollY,
        zoom: mainCamera.zoom,
      };
      this.cannonTransformGizmo?.clear();
      if (this.ship) {
        this.cannonRangeOverlay?.show(this.ship, this.getMountedCannons());
      }
      mainCamera
        .setZoom(RANGE_VIEW_ZOOM)
        .setScroll(
          SHIP_X - RANGE_SHIP_SCREEN_X / RANGE_VIEW_ZOOM,
          SHIP_Y - RANGE_SHIP_SCREEN_Y / RANGE_VIEW_ZOOM,
        );
    }

    this.setPaletteEnabled(isEditMode);
    this.setMountedCannonsEnabled(isEditMode);
    if (this.ship?.cannonDropZone.input) {
      this.ship.cannonDropZone.input.enabled = isEditMode;
    }
    for (const { background } of [
      ...this.sizeButtons.values(),
      ...this.sailColorButtons.values(),
      ...this.sailStateButtons.values(),
    ]) {
      if (background.input) {
        background.input.enabled = isEditMode;
      }
    }

    this.refreshSizeControls();
    this.refreshSailColorControls();
    this.refreshSailStateControls();
    this.refreshViewModeControls();
    this.refreshInstructions();
  }

  private getMountedCannons() {
    return [...this.cannonStates]
      .filter(([, { placement }]) => placement === 'ship')
      .map(([cannon]) => cannon);
  }

  private setPaletteEnabled(enabled: boolean) {
    for (const [cannon, { placement }] of this.cannonStates) {
      if (placement !== 'palette') {
        continue;
      }

      cannon.setVisible(enabled);
      if (cannon.input) {
        cannon.input.enabled = enabled;
      }
      this.input.setDraggable(cannon, enabled);
    }
  }

  private setMountedCannonsEnabled(enabled: boolean) {
    for (const [cannon, { placement }] of this.cannonStates) {
      if (placement === 'ship' && cannon.input) {
        cannon.input.enabled = enabled;
      }
    }
  }

  private refreshViewModeControls() {
    for (const [mode, { background, label }] of this.viewModeButtons) {
      const isSelected = mode === this.viewMode;
      background
        .setFillStyle(isSelected ? 0x0284c7 : 0x0c4a6e, isSelected ? 1 : 0.65)
        .setStrokeStyle(1, isSelected ? 0xe0f2fe : 0x38bdf8, isSelected ? 1 : 0.45);
      label.setColor(isSelected ? '#ffffff' : '#bae6fd');
    }
  }

  private refreshInstructions() {
    if (this.viewMode === 'edit') {
      this.builderInstructionsText?.setText(
        'Drag cannons onto the hull. Select a mounted cannon to adjust it.',
      );
      this.paletteHeadingText?.setText('CANNON');
      this.paletteInstructionsText?.setText('drag a copy to the ship');
      this.controlsInstructionsText?.setText([
        'SELECT A MOUNTED CANNON',
        'red handle: move X',
        'green handle: move Y',
        'yellow knob: rotate',
        'red X: remove',
      ]);
      return;
    }

    this.builderInstructionsText?.setText(
      'Inspect each cannon firing cone. Switch to Edit to adjust the loadout.',
    );
    this.paletteHeadingText?.setText('RANGE');
    this.paletteInstructionsText?.setText('all mounted cannons');
    this.controlsInstructionsText?.setText([
      'CANNON RANGE VIEW',
      'red cone: firing area',
      'center line: aim direction',
      'switch to EDIT to adjust',
    ]);
  }
}
