import Phaser from 'phaser';
import {
  MODULAR_SHIP_SAIL_TINTS,
  ModularShip,
  type ModularShipSailColor,
  type ModularShipSailState,
  type ModularShipSize,
  type ShipBuild,
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

type RangeControlButton = {
  background: Phaser.GameObjects.Image;
  normalTexture: string;
  activeTexture: string;
  disabledTexture: string;
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
const RANGE_MIN_ZOOM = 0.4;
const RANGE_MAX_ZOOM = 1.6;
const RANGE_ZOOM_STEP = 0.2;
const RANGE_PAN_SCREEN_STEP = 80;
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
  private initialBuild?: ShipBuild;
  private ship?: ModularShip;
  private cannonCountText?: Phaser.GameObjects.Text;
  private builderInstructionsText?: Phaser.GameObjects.Text;
  private paletteHeadingText?: Phaser.GameObjects.Text;
  private paletteInstructionsText?: Phaser.GameObjects.Text;
  private controlsInstructionsText?: Phaser.GameObjects.Text;
  private rightPanelBackground?: Phaser.GameObjects.Rectangle;
  private selectedCannon?: Phaser.GameObjects.Image;
  private cannonTransformGizmo?: CannonTransformGizmo;
  private cannonRangeOverlay?: CannonRangeOverlay;
  private uiRoot?: Phaser.GameObjects.Container;
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  private editCameraState?: CameraState;
  private rangeCameraState?: CameraState;
  private rangeCameraControls?: Phaser.GameObjects.Container;
  private rangeZoomText?: Phaser.GameObjects.Text;
  private rangeZoomInButton?: RangeControlButton;
  private rangeZoomOutButton?: RangeControlButton;
  private viewMode: BuilderViewMode = 'edit';
  private viewModeInitialized = false;
  private readonly rangeControlInputs: Phaser.GameObjects.GameObject[] = [];
  private readonly rangeControlButtons: RangeControlButton[] = [];
  private readonly editPanelObjects: Array<
    Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible
  > = [];
  private readonly cannonStates = new Map<Phaser.GameObjects.Image, CannonState>();
  private readonly viewModeButtons = new Map<BuilderViewMode, ControlButton>();
  private readonly sizeButtons = new Map<ModularShipSize, ControlButton>();
  private readonly sailColorButtons = new Map<ModularShipSailColor, ControlButton>();
  private readonly sailStateButtons = new Map<ModularShipSailState, ControlButton>();

  constructor() {
    super('ModularShipScene');
  }

  init(data: { build?: ShipBuild }) {
    this.initialBuild = data.build;
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
    this.rangeCameraState = undefined;
    this.rangeControlInputs.length = 0;
    this.rangeControlButtons.length = 0;
    this.editPanelObjects.length = 0;
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

    const initialConfig = this.initialBuild ?? {
      size: 'small' as const,
      sailState: 'closed' as const,
      sailColor: 'ivory' as const,
    };
    this.ship = new ModularShip(this, SHIP_X, SHIP_Y, initialConfig)
      .setScale(SHIP_DISPLAY_SCALES[initialConfig.size]);
    if (this.initialBuild) {
      this.ship.applyBuild(this.initialBuild);
      this.restoreMountedCannonBookkeeping();
    }
    this.cannonTransformGizmo = new CannonTransformGizmo(
      this,
      (cannon) => this.removeCannon(cannon),
    );
    this.cannonRangeOverlay = new CannonRangeOverlay(this);
    this.uiCamera.ignore(this.ship);
    this.cannonTransformGizmo.ignoreBy(this.uiCamera);
    this.cannonRangeOverlay.ignoreBy(this.uiCamera);

    this.rightPanelBackground = this.addToUi(this.add.rectangle(770, 291, 260, 382, 0x0c4a6e, 0.55)
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
    this.createRangeCameraControls();

    this.cannonCountText = this.addToUi(this.add.text(PALETTE_X, 486, '', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '12px',
    }).setOrigin(0.5));
    this.updateCannonCount();

    this.addToUi(this.add.text(
      480,
      516,
      '[SPACE] current game scene   [H] world generation lab',
      {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '12px',
      },
    ).setOrigin(0.5));

    this.input.keyboard?.once('keydown-SPACE', () => {
      if (!this.ship) {
        throw new Error('Cannot start GameScene without a ship build.');
      }

      this.scene.start('GameScene', { build: this.ship.exportBuild() });
    });
    this.input.keyboard?.once('keydown-H', () => {
      if (!this.ship) {
        throw new Error('Cannot open world generation without a ship build.');
      }
      this.scene.start('WorldGenerationScene', { build: this.ship.exportBuild() });
    });
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

  private restoreMountedCannonBookkeeping() {
    if (!this.ship) return;

    for (const child of this.ship.list) {
      if (!(child instanceof Phaser.GameObjects.Image) || !child.input) continue;
      this.configureDraggableCannon(child, {
        placement: 'ship',
        homeX: child.x,
        homeY: child.y,
      });
      this.input.setDraggable(child, false);
    }
  }

  private addToEditPanel<
    T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible,
  >(gameObject: T): T {
    this.editPanelObjects.push(gameObject);
    return this.addToUi(gameObject);
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

  private createRangeCameraControls() {
    this.createRangeControlTextures();
    const controls = this.add.container(0, 0).setVisible(false);
    const children: Phaser.GameObjects.GameObject[] = [];

    const createButton = (
      x: number,
      y: number,
      icon: 'up' | 'left' | 'right' | 'down' | 'minus' | 'plus',
      onClick: () => void,
    ): RangeControlButton => {
      const normalTexture = `range-control-${icon}`;
      const activeTexture = `${normalTexture}-active`;
      const disabledTexture = `${normalTexture}-disabled`;
      const background = this.add.image(x, y, normalTexture)
        .setInteractive({ useHandCursor: true });

      background.on(Phaser.Input.Events.POINTER_OVER, () => {
        if (background.input?.enabled) {
          background.setTexture(activeTexture);
        }
      });
      background.on(Phaser.Input.Events.POINTER_OUT, () => {
        if (background.input?.enabled) {
          background.setTexture(normalTexture);
        }
      });

      background.on(Phaser.Input.Events.POINTER_DOWN, (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        if (this.viewMode !== 'range') {
          return;
        }
        onClick();
      });
      children.push(background);
      this.rangeControlInputs.push(background);
      const button = { background, normalTexture, activeTexture, disabledTexture };
      this.rangeControlButtons.push(button);
      return button;
    };

    const panCenterX = 38;
    const panCenterY = 486;
    const panStep = 19;
    createButton(panCenterX, panCenterY - panStep, 'up', () => this.panRangeCamera(0, -1));
    createButton(panCenterX - panStep, panCenterY, 'left', () => this.panRangeCamera(-1, 0));
    createButton(panCenterX + panStep, panCenterY, 'right', () => this.panRangeCamera(1, 0));
    createButton(panCenterX, panCenterY + panStep, 'down', () => this.panRangeCamera(0, 1));

    this.rangeZoomOutButton = createButton(88, panCenterY, 'minus', () => this.zoomRangeCamera(-1));
    this.rangeZoomText = this.add.text(116, panCenterY, '', {
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: '10px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    children.push(this.rangeZoomText);
    this.rangeZoomInButton = createButton(144, panCenterY, 'plus', () => this.zoomRangeCamera(1));

    controls.add(children);
    this.rangeCameraControls = this.addToUi(controls);
  }

  private createRangeControlTextures() {
    const icons: ReadonlyArray<'up' | 'left' | 'right' | 'down' | 'minus' | 'plus'> = [
      'up', 'left', 'right', 'down', 'minus', 'plus',
    ];
    icons.forEach((icon) => {
      this.createRangeControlTexture(`range-control-${icon}`, icon, 0xf8fafc, 0x1f2937);
      this.createRangeControlTexture(`range-control-${icon}-active`, icon, 0xf43f5e, 0xffffff);
      this.createRangeControlTexture(`range-control-${icon}-disabled`, icon, 0x94a3b8, 0x475569);
    });
  }

  private createRangeControlTexture(
    key: string,
    icon: 'up' | 'left' | 'right' | 'down' | 'minus' | 'plus',
    fillColor: number,
    symbolColor: number,
  ) {
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.fillStyle(0x020617, 0.45).fillRoundedRect(1, 2, 20, 20, 4);
    graphics.fillStyle(fillColor, 1).fillRoundedRect(1, 1, 20, 20, 4);
    graphics.lineStyle(1, 0xffffff, 0.82).strokeRoundedRect(1.5, 1.5, 19, 19, 3.5);
    graphics.fillStyle(symbolColor, 1);

    if (icon === 'up') {
      graphics.fillTriangle(11, 6, 6.5, 12, 15.5, 12).fillRect(9, 11, 4, 5);
    } else if (icon === 'down') {
      graphics.fillTriangle(6.5, 10, 15.5, 10, 11, 16).fillRect(9, 7, 4, 5);
    } else if (icon === 'left') {
      graphics.fillTriangle(6, 11, 12, 6.5, 12, 15.5).fillRect(11, 9, 5, 4);
    } else if (icon === 'right') {
      graphics.fillTriangle(16, 11, 10, 6.5, 10, 15.5).fillRect(6, 9, 5, 4);
    } else if (icon === 'minus') {
      graphics.fillRect(6, 9.5, 10, 3);
    } else {
      graphics.fillRect(6, 9.5, 10, 3).fillRect(9.5, 6, 3, 10);
    }

    graphics.generateTexture(key, 22, 23);
    graphics.destroy();
  }

  private createSizeControls() {
    this.addToEditPanel(this.add.text(PALETTE_X, 73, 'SHIP SIZE', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '11px',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    SHIP_SIZE_OPTIONS.forEach(({ size, label }, index) => {
      const x = PALETTE_X + (index - 1) * 82;
      const background = this.addToEditPanel(this.add.rectangle(
        x,
        SHIP_SIZE_Y,
        SHIP_SIZE_BUTTON_WIDTH,
        SHIP_SIZE_BUTTON_HEIGHT,
      ).setInteractive({ useHandCursor: true }));
      const buttonLabel = this.addToEditPanel(this.add.text(x, SHIP_SIZE_Y, label, {
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
    this.addToEditPanel(this.add.text(PALETTE_X, 130, 'SAIL COLOR', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '11px',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    SAIL_COLOR_OPTIONS.forEach(({ color, label }, index) => {
      const x = PALETTE_X + (index - 1.5) * 62;
      const background = this.addToEditPanel(this.add.rectangle(
        x,
        SAIL_COLOR_Y,
        SAIL_COLOR_BUTTON_WIDTH,
        SAIL_COLOR_BUTTON_HEIGHT,
        MODULAR_SHIP_SAIL_TINTS[color],
      ).setInteractive({ useHandCursor: true }));
      const buttonLabel = this.addToEditPanel(this.add.text(x, SAIL_COLOR_Y, label, {
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
    this.addToEditPanel(this.add.text(PALETTE_X, 185, 'SAIL STATE', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '11px',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    SAIL_STATE_OPTIONS.forEach(({ state, label }, index) => {
      const x = PALETTE_X + (index - 1) * 82;
      const background = this.addToEditPanel(this.add.rectangle(
        x,
        SAIL_STATE_Y,
        SHIP_SIZE_BUTTON_WIDTH,
        SHIP_SIZE_BUTTON_HEIGHT,
      ).setInteractive({ useHandCursor: true }));
      const buttonLabel = this.addToEditPanel(this.add.text(x, SAIL_STATE_Y, label, {
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
    const previousMode = this.viewMode;
    const wasInitialized = this.viewModeInitialized;
    this.viewMode = mode;
    this.viewModeInitialized = true;

    if (isEditMode) {
      if (wasInitialized && previousMode === 'range') {
        this.saveRangeCameraState();
      }
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
      if (this.rangeCameraState) {
        mainCamera
          .setZoom(this.rangeCameraState.zoom)
          .setScroll(this.rangeCameraState.scrollX, this.rangeCameraState.scrollY);
      } else {
        const halfWidth = mainCamera.width / 2;
        const halfHeight = mainCamera.height / 2;
        mainCamera
          .setZoom(RANGE_VIEW_ZOOM)
          .setScroll(
            SHIP_X
              - halfWidth
              - (RANGE_SHIP_SCREEN_X - mainCamera.x - halfWidth) / RANGE_VIEW_ZOOM,
            SHIP_Y
              - halfHeight
              - (RANGE_SHIP_SCREEN_Y - mainCamera.y - halfHeight) / RANGE_VIEW_ZOOM,
          );
      }
    }

    this.setPaletteEnabled(isEditMode);
    this.setEditPanelVisible(isEditMode);
    this.setRightPanelLayout(isEditMode);
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
    this.refreshRangeCameraControls();
  }

  private setEditPanelVisible(visible: boolean) {
    for (const gameObject of this.editPanelObjects) {
      gameObject.setVisible(visible);
    }
  }

  private setRightPanelLayout(isEditMode: boolean) {
    this.rightPanelBackground
      ?.setPosition(770, isEditMode ? 291 : 151)
      .setSize(260, isEditMode ? 382 : 154);
  }

  private panRangeCamera(directionX: number, directionY: number) {
    if (this.viewMode !== 'range') {
      return;
    }

    const camera = this.cameras.main;
    camera.setScroll(
      camera.scrollX + directionX * RANGE_PAN_SCREEN_STEP / camera.zoom,
      camera.scrollY + directionY * RANGE_PAN_SCREEN_STEP / camera.zoom,
    );
    this.saveRangeCameraState();
  }

  private zoomRangeCamera(direction: -1 | 1) {
    if (this.viewMode !== 'range') {
      return;
    }

    const camera = this.cameras.main;
    const oldZoom = camera.zoom;
    const nextZoom = Phaser.Math.Clamp(
      Math.round((oldZoom + direction * RANGE_ZOOM_STEP) * 10) / 10,
      RANGE_MIN_ZOOM,
      RANGE_MAX_ZOOM,
    );
    if (nextZoom === oldZoom) {
      return;
    }

    const focus = camera.getWorldPoint(RANGE_SHIP_SCREEN_X, RANGE_SHIP_SCREEN_Y);
    const halfWidth = camera.width / 2;
    const halfHeight = camera.height / 2;
    camera
      .setZoom(nextZoom)
      .setScroll(
        focus.x - halfWidth - (RANGE_SHIP_SCREEN_X - camera.x - halfWidth) / nextZoom,
        focus.y - halfHeight - (RANGE_SHIP_SCREEN_Y - camera.y - halfHeight) / nextZoom,
      );
    this.saveRangeCameraState();
    this.refreshRangeCameraControls();
  }

  private saveRangeCameraState() {
    const camera = this.cameras.main;
    this.rangeCameraState = {
      scrollX: camera.scrollX,
      scrollY: camera.scrollY,
      zoom: camera.zoom,
    };
  }

  private refreshRangeCameraControls() {
    const isRangeMode = this.viewMode === 'range';
    this.rangeCameraControls?.setVisible(isRangeMode);

    for (const control of this.rangeControlInputs) {
      if (control.input) {
        control.input.enabled = isRangeMode;
      }
    }
    for (const button of this.rangeControlButtons) {
      button.background.setTexture(button.normalTexture);
    }

    const zoom = this.cameras.main.zoom;
    this.rangeZoomText?.setText(`${Math.round(zoom * 100)}%`);
    this.setRangeZoomButtonEnabled(
      this.rangeZoomInButton,
      isRangeMode && zoom < RANGE_MAX_ZOOM,
    );
    this.setRangeZoomButtonEnabled(
      this.rangeZoomOutButton,
      isRangeMode && zoom > RANGE_MIN_ZOOM,
    );
  }

  private setRangeZoomButtonEnabled(button: RangeControlButton | undefined, enabled: boolean) {
    if (!button) {
      return;
    }

    if (button.background.input) {
      button.background.input.enabled = enabled;
    }
    button.background
      .setTexture(enabled ? button.normalTexture : button.disabledTexture)
      .setAlpha(enabled ? 1 : 0.45);
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
      this.paletteHeadingText?.setY(250);
      this.paletteInstructionsText?.setY(272).setText('drag a copy to the ship');
      this.controlsInstructionsText
        ?.setY(414)
        .setText([
          'SELECT A MOUNTED CANNON',
          'red handle: move X',
          'green handle: move Y',
          'yellow knob: rotate',
          'red X: remove',
        ]);
      this.cannonCountText?.setY(486);
      return;
    }

    this.builderInstructionsText?.setText(
      'Inspect each cannon firing cone. Switch to Edit to adjust the loadout.',
    );
    this.paletteHeadingText?.setY(100).setText('RANGE VIEW');
    this.paletteInstructionsText?.setY(122).setText('firing arcs for mounted cannons');
    this.controlsInstructionsText
      ?.setY(158)
      .setText([
        'red cone = firing area',
        'center line = aim direction',
      ]);
    this.cannonCountText?.setY(205);
  }
}
