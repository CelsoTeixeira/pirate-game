import Phaser from 'phaser';

export type ModularShipSize = 'small' | 'medium' | 'big';
export type ModularShipSailState = 'closed' | 'partial' | 'open';
export type ModularShipSailColor = 'black' | 'crimson' | 'ivory' | 'navy';

export type ModularShipConfig = {
  size: ModularShipSize;
  sailState: ModularShipSailState;
  sailColor: ModularShipSailColor;
};

type ShipLayout = {
  cannonX: number;
  cannonScale: number;
  minCannonY: number;
  maxCannonY: number;
  dropZoneWidth: number;
  dropZoneHeight: number;
};

const SHIP_PARTS_PATH = 'assets/ship-parts';
const MODULAR_SHIP_CANNON_TEXTURE_KEY = 'modular-ship-cannon';
const SHIP_SIZES: readonly ModularShipSize[] = ['small', 'medium', 'big'];
const SAIL_STATES: readonly ModularShipSailState[] = ['closed', 'partial', 'open'];
const CANNON_HIT_AREA = new Phaser.Geom.Rectangle(300, 400, 700, 450);

export const MODULAR_SHIP_SAIL_TINTS: Record<ModularShipSailColor, number> = {
  black: 0x46464f,
  crimson: 0xe11d48,
  ivory: 0xffffff,
  navy: 0x4c4b8c,
};

const SHIP_LAYOUTS: Record<ModularShipSize, ShipLayout> = {
  small: {
    cannonX: 58,
    cannonScale: 0.08,
    minCannonY: -90,
    maxCannonY: 85,
    dropZoneWidth: 190,
    dropZoneHeight: 330,
  },
  medium: {
    cannonX: 142,
    cannonScale: 0.11,
    minCannonY: -220,
    maxCannonY: 230,
    dropZoneWidth: 380,
    dropZoneHeight: 560,
  },
  big: {
    cannonX: 216,
    cannonScale: 0.14,
    minCannonY: -290,
    maxCannonY: 290,
    dropZoneWidth: 560,
    dropZoneHeight: 700,
  },
};

function getPartTextureKey(size: ModularShipSize, part: 'base' | 'poles') {
  return `modular-ship-${size}-${part}`;
}

function getSailsTextureKey(size: ModularShipSize, sailState: ModularShipSailState) {
  return `modular-ship-${size}-sails-${sailState}`;
}

export class ModularShip extends Phaser.GameObjects.Container {
  public readonly config: ModularShipConfig;
  public readonly cannonDropZone: Phaser.GameObjects.Zone;

  private layout: ShipLayout;
  private readonly base: Phaser.GameObjects.Image;
  private readonly poles: Phaser.GameObjects.Image;
  private readonly sails: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, config: ModularShipConfig) {
    super(scene, x, y);

    this.config = { ...config };
    this.layout = SHIP_LAYOUTS[config.size];

    this.base = new Phaser.GameObjects.Image(scene, 0, 0, getPartTextureKey(config.size, 'base'));
    this.poles = new Phaser.GameObjects.Image(scene, 0, 0, getPartTextureKey(config.size, 'poles'));
    this.sails = new Phaser.GameObjects.Image(scene, 0, 0, getSailsTextureKey(config.size, config.sailState))
      .setTint(MODULAR_SHIP_SAIL_TINTS[config.sailColor]);

    this.add(this.base);
    this.add(this.poles);
    this.add(this.sails);

    this.cannonDropZone = new Phaser.GameObjects.Zone(
      scene,
      0,
      0,
      this.layout.dropZoneWidth,
      this.layout.dropZoneHeight,
    );
    this.cannonDropZone.setRectangleDropZone(this.layout.dropZoneWidth, this.layout.dropZoneHeight);
    this.add(this.cannonDropZone);
    this.sendToBack(this.cannonDropZone);

    scene.add.existing(this);
  }

  static preload(scene: Phaser.Scene) {
    scene.load.image(MODULAR_SHIP_CANNON_TEXTURE_KEY, `${SHIP_PARTS_PATH}/cannons/ship_cannon.png`);

    for (const size of SHIP_SIZES) {
      scene.load.image(getPartTextureKey(size, 'base'), `${SHIP_PARTS_PATH}/base/pirate_ship_${size}_base.png`);
      scene.load.image(getPartTextureKey(size, 'poles'), `${SHIP_PARTS_PATH}/poles/wood/ship_${size}_poles.png`);

      for (const sailState of SAIL_STATES) {
        scene.load.image(
          getSailsTextureKey(size, sailState),
          `${SHIP_PARTS_PATH}/sails/ivory/ship_${size}_sails_${sailState}.png`,
        );
      }
    }
  }

  createCannon(x: number, y: number) {
    return new Phaser.GameObjects.Image(this.scene, x, y, MODULAR_SHIP_CANNON_TEXTURE_KEY)
      .setInteractive(CANNON_HIT_AREA, Phaser.Geom.Rectangle.Contains);
  }

  setShipSize(size: ModularShipSize): this {
    if (size === this.config.size) {
      return this;
    }

    const previousLayout = this.layout;
    const mountedCannons = this.list
      .filter(
        (child): child is Phaser.GameObjects.Image =>
          child instanceof Phaser.GameObjects.Image && child.texture.key === MODULAR_SHIP_CANNON_TEXTURE_KEY,
      )
      .map((cannon) => ({
        cannon,
        xProgress: Phaser.Math.Clamp(
          (cannon.x + previousLayout.cannonX) / (previousLayout.cannonX * 2),
          0,
          1,
        ),
        yProgress: Phaser.Math.Clamp(
          (cannon.y - previousLayout.minCannonY)
            / (previousLayout.maxCannonY - previousLayout.minCannonY),
          0,
          1,
        ),
      }));

    this.layout = SHIP_LAYOUTS[size];
    this.config.size = size;
    this.base.setTexture(getPartTextureKey(size, 'base'));
    this.poles.setTexture(getPartTextureKey(size, 'poles'));
    this.sails
      .setTexture(getSailsTextureKey(size, this.config.sailState))
      .setTint(MODULAR_SHIP_SAIL_TINTS[this.config.sailColor]);

    this.cannonDropZone.setSize(this.layout.dropZoneWidth, this.layout.dropZoneHeight, false);
    const dropZoneHitArea = this.cannonDropZone.input?.hitArea;
    if (dropZoneHitArea instanceof Phaser.Geom.Rectangle) {
      dropZoneHitArea.setSize(this.layout.dropZoneWidth, this.layout.dropZoneHeight);
    }

    for (const { cannon, xProgress, yProgress } of mountedCannons) {
      this.moveCannon(
        cannon,
        Phaser.Math.Linear(-this.layout.cannonX, this.layout.cannonX, xProgress),
        Phaser.Math.Linear(this.layout.minCannonY, this.layout.maxCannonY, yProgress),
      );
    }

    return this;
  }

  setSailColor(color: ModularShipSailColor): this {
    this.config.sailColor = color;
    this.sails.setTint(MODULAR_SHIP_SAIL_TINTS[color]);
    return this;
  }

  mountCannon(cannon: Phaser.GameObjects.Image, worldX: number, worldY: number) {
    const localPoint = this.pointToContainer({ x: worldX, y: worldY });

    this.addAt(cannon, this.getIndex(this.poles));
    cannon.setPosition(localPoint.x, localPoint.y);
    this.repositionCannon(cannon);
  }

  bringCannonToFront(cannon: Phaser.GameObjects.Image) {
    const cannonIndex = this.getIndex(cannon);
    const polesIndex = this.getIndex(this.poles);

    if (cannonIndex === -1) {
      return;
    }

    this.moveTo(cannon, cannonIndex < polesIndex ? polesIndex - 1 : polesIndex);
  }

  repositionCannon(cannon: Phaser.GameObjects.Image) {
    cannon.x = cannon.x < 0 ? -this.layout.cannonX : this.layout.cannonX;
    this.moveCannon(cannon, cannon.x, cannon.y);
  }

  moveCannon(cannon: Phaser.GameObjects.Image, x: number, y: number) {
    cannon.setPosition(
      Phaser.Math.Clamp(x, -this.layout.cannonX, this.layout.cannonX),
      Phaser.Math.Clamp(y, this.layout.minCannonY, this.layout.maxCannonY),
    );
    cannon.setScale(this.layout.cannonScale);
    cannon.setFlipX(cannon.x < 0);
  }
}
