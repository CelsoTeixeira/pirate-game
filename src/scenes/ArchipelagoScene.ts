import Phaser from 'phaser';
import { WindStreaks } from '../effects/windStreaks';
import { ModularShip, type ModularShipSailState, type ShipBuild } from '../entities/ModularShip';
import { Ship, type SailState } from '../entities/Ship';
import { KeyboardControls } from '../input/KeyboardControls';
import { Wind } from '../world/Wind';
import {
  DEFAULT_ARCHIPELAGO_CONFIG,
  generateArchipelago,
  type GeneratedArchipelago,
} from '../world/generation/archipelago';
import { buildTerrainTileIndices, VALID_BLOB_MASKS } from '../world/terrain/blobAutotile';
import {
  BLOB_TERRAIN_TEXTURE_KEY,
  createBlobTerrainAtlas,
  TERRAIN_TILE_SIZE,
} from '../world/terrain/createBlobTerrainAtlas';
import {
  getOrientedHullCorners,
  orientedHullOverlapsLand,
  type OrientedHullFootprint,
  type OrientedHullPose,
} from '../world/terrain/orientedHullCollision';

const TERRAIN_MATERIAL_KEY = 'terrain-atlas-64';
const TERRAIN_MATERIAL_PATH = 'assets/terrain/terrain-atlas-64.png';
const OCEAN_FRAME = 1;
const CAMERA_FOLLOW_LERP = 0.1;
const SPAWN_CLEARANCE_TILES = 2;
const COLLISION_DEBUG_DEPTH = 90;
const TERRAIN_DEBUG_FILL_COLOR = 0xfb923c;
const TERRAIN_DEBUG_FACE_COLOR = 0xffedd5;
const TERRAIN_DEBUG_PADDING_TILES = 1;
const SHIP_BODY_DEBUG_COLOR = 0x22d3ee;
const SHIP_WORLD_SCALE = 0.6;
const SHIP_SCALES: Record<ShipBuild['size'], number> = {
  small: 0.33 * SHIP_WORLD_SCALE,
  medium: 0.15 * SHIP_WORLD_SCALE,
  big: 0.12 * SHIP_WORLD_SCALE,
};
const SAIL_STATES: readonly ModularShipSailState[] = ['closed', 'partial', 'open'];
const SHIP_HULL_FOOTPRINTS: Record<ShipBuild['size'], OrientedHullFootprint> = {
  small: { width: 50 * SHIP_WORLD_SCALE, length: 104 * SHIP_WORLD_SCALE },
  medium: { width: 54 * SHIP_WORLD_SCALE, length: 136 * SHIP_WORLD_SCALE },
  big: { width: 66 * SHIP_WORLD_SCALE, length: 130 * SHIP_WORLD_SCALE },
};

type ArchipelagoSceneData = Readonly<{
  seed?: number;
  build?: ShipBuild;
}>;

export class ArchipelagoScene extends Phaser.Scene {
  private seed = 0;
  private build?: ShipBuild;
  private archipelago?: GeneratedArchipelago;
  private playerShip?: Ship;
  private playerShipVisual?: ModularShip;
  private controls?: KeyboardControls;
  private escapeKey?: Phaser.Input.Keyboard.Key;
  private collisionDebugKey?: Phaser.Input.Keyboard.Key;
  private collisionDebugEnabled = false;
  private collisionDebugGraphics?: Phaser.GameObjects.Graphics;
  private shipHullDebugGraphics?: Phaser.GameObjects.Graphics;
  private collisionDebugStatus?: Phaser.GameObjects.Text;
  private windStreaks?: WindStreaks;
  private readonly wind = new Wind(0, 0.7);

  constructor() {
    super('ArchipelagoScene');
  }

  init(data: ArchipelagoSceneData) {
    if (!data.build) {
      throw new Error('ArchipelagoScene requires a ship build from the generation lab.');
    }
    this.build = data.build;
    this.seed = (data.seed ?? 0) >>> 0;
  }

  preload() {
    if (!this.textures.exists(TERRAIN_MATERIAL_KEY)) {
      this.load.spritesheet(TERRAIN_MATERIAL_KEY, TERRAIN_MATERIAL_PATH, {
        frameWidth: TERRAIN_TILE_SIZE,
        frameHeight: TERRAIN_TILE_SIZE,
      });
    }
    Ship.preload(this);
    ModularShip.preload(this);
  }

  create() {
    if (!this.build) {
      throw new Error('ArchipelagoScene cannot create without a ship build.');
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.archipelago = generateArchipelago(this.seed, DEFAULT_ARCHIPELAGO_CONFIG);
    createBlobTerrainAtlas(this, TERRAIN_MATERIAL_KEY);

    const worldWidth = this.archipelago.width * TERRAIN_TILE_SIZE;
    const worldHeight = this.archipelago.height * TERRAIN_TILE_SIZE;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main
      .setBackgroundColor('#082f49')
      .setBounds(0, 0, worldWidth, worldHeight);

    this.add.tileSprite(
      0,
      0,
      worldWidth,
      worldHeight,
      TERRAIN_MATERIAL_KEY,
      OCEAN_FRAME,
    ).setOrigin(0).setDepth(-30);

    const map = this.make.tilemap({
      data: buildTerrainTileIndices(this.archipelago),
      tileWidth: TERRAIN_TILE_SIZE,
      tileHeight: TERRAIN_TILE_SIZE,
    });
    const tileset = map.addTilesetImage(
      BLOB_TERRAIN_TEXTURE_KEY,
      BLOB_TERRAIN_TEXTURE_KEY,
      TERRAIN_TILE_SIZE,
      TERRAIN_TILE_SIZE,
      0,
      0,
      0,
    );
    if (!tileset) {
      throw new Error('Unable to attach the runtime terrain atlas to the world tilemap.');
    }
    const landLayer = map.createLayer(0, tileset, 0, 0);
    if (!landLayer) {
      throw new Error('Unable to create the archipelago terrain layer.');
    }
    landLayer
      .setCollisionBetween(0, VALID_BLOB_MASKS.length - 1)
      .setCullPadding(2, 2)
      .setDepth(-10);

    this.collisionDebugGraphics = this.add.graphics()
      .setDepth(COLLISION_DEBUG_DEPTH)
      .setVisible(false);
    this.shipHullDebugGraphics = this.add.graphics()
      .setDepth(COLLISION_DEBUG_DEPTH + 1)
      .setVisible(false);

    const spawn = findOpenWaterSpawn(this.archipelago, SPAWN_CLEARANCE_TILES);
    this.playerShip = new Ship(this, spawn.x, spawn.y, 'pirate');
    this.playerShip.sailState = SAIL_STATES.indexOf(this.build.sailState) as SailState;
    this.playerShip.setVisible(false);
    const playerBody = this.playerShip.body;
    if (playerBody instanceof Phaser.Physics.Arcade.Body) {
      // Sailing still uses Arcade velocity, but position is integrated below so
      // terrain contact can use the rotating modular hull instead of an AABB.
      playerBody.moves = false;
    }
    this.playerShipVisual = new ModularShip(this, spawn.x, spawn.y, this.build)
      .applyBuild(this.build)
      .setScale(SHIP_SCALES[this.build.size])
      .setBuildInteractionEnabled(false)
      .setDepth(5);

    this.controls = new KeyboardControls(this);
    this.escapeKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.collisionDebugKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    this.windStreaks = new WindStreaks(this, this.wind);
    this.syncShipVisual();
    this.cameras.main.startFollow(
      this.playerShip,
      true,
      CAMERA_FOLLOW_LERP,
      CAMERA_FOLLOW_LERP,
    );

    this.add.text(16, 16, `ARCHIPELAGO  seed ${this.seed}`, {
      color: '#e0f2fe',
      fontFamily: 'monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      backgroundColor: '#071b28cc',
      padding: { x: 8, y: 5 },
    }).setScrollFactor(0).setDepth(100);
    this.add.text(16, 51, '[W/S] sails  [A/D] steer  [X] anchor  [B] hitboxes  [ESC] generation lab', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '11px',
      backgroundColor: '#071b28cc',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100);
    this.collisionDebugStatus = this.add.text(16, 80, 'HITBOXES  OFF', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '11px',
      backgroundColor: '#071b28cc',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100);
  }

  update(_time: number, delta: number) {
    if (!this.playerShip || !this.controls) {
      return;
    }

    if (this.escapeKey && Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      this.scene.start('WorldGenerationScene', { seed: this.seed, build: this.build });
      return;
    }
    if (this.collisionDebugKey && Phaser.Input.Keyboard.JustDown(this.collisionDebugKey)) {
      this.setCollisionDebugEnabled(!this.collisionDebugEnabled);
    }
    if (this.controls.isSailUpJustPressed()) this.playerShip.raiseSail();
    if (this.controls.isSailDownJustPressed()) this.playerShip.lowerSail();
    if (this.controls.isAnchorTogglePressed()) this.playerShip.toggleAnchor();

    this.movePlayerShip(this.controls.getRudder(), delta);
    this.syncShipVisual();
    this.drawTerrainCollisionDebug();
    this.drawShipHullDebug();
    this.windStreaks?.update();
  }

  private movePlayerShip(rudder: -1 | 0 | 1, delta: number) {
    if (!this.playerShip || !this.archipelago || !this.build) {
      return;
    }

    const previousPose = this.getPlayerHullPose();
    const footprint = SHIP_HULL_FOOTPRINTS[this.build.size];
    this.playerShip.sail(this.wind, rudder, delta);

    if (this.hullOverlapsLand(this.getPlayerHullPose(), footprint)) {
      this.playerShip.rotation = previousPose.rotation;
      // Recalculate the sailing vector for the accepted heading.
      this.playerShip.sail(this.wind, 0, 0);
    }

    const body = this.playerShip.body;
    if (!(body instanceof Phaser.Physics.Arcade.Body)) {
      return;
    }

    const seconds = Math.min(delta, 50) / 1000;
    const targetX = previousPose.x + body.velocity.x * seconds;
    const targetY = previousPose.y + body.velocity.y * seconds;
    const rotation = this.playerShip.rotation;

    if (!this.hullOverlapsLand({ x: targetX, y: targetY, rotation }, footprint)) {
      this.playerShip.setPosition(targetX, targetY);
      return;
    }

    // Resolve each axis independently so the ship can slide along a coast.
    if (!this.hullOverlapsLand({ x: targetX, y: previousPose.y, rotation }, footprint)) {
      this.playerShip.x = targetX;
    } else {
      body.velocity.x = 0;
    }
    if (!this.hullOverlapsLand({ x: this.playerShip.x, y: targetY, rotation }, footprint)) {
      this.playerShip.y = targetY;
    } else {
      body.velocity.y = 0;
    }
  }

  private getPlayerHullPose(): OrientedHullPose {
    if (!this.playerShip) {
      return { x: 0, y: 0, rotation: 0 };
    }
    return {
      x: this.playerShip.x,
      y: this.playerShip.y,
      rotation: this.playerShip.rotation,
    };
  }

  private hullOverlapsLand(pose: OrientedHullPose, footprint: OrientedHullFootprint) {
    if (!this.archipelago) {
      return false;
    }
    return orientedHullOverlapsLand(pose, footprint, {
      width: this.archipelago.width,
      height: this.archipelago.height,
      tileSize: TERRAIN_TILE_SIZE,
      landMask: this.archipelago.landMask,
    });
  }

  private syncShipVisual() {
    if (!this.playerShip || !this.playerShipVisual) {
      return;
    }
    this.playerShipVisual
      .setPosition(this.playerShip.x, this.playerShip.y)
      .setRotation(this.playerShip.rotation);
    const sailState = SAIL_STATES[this.playerShip.sailState];
    if (this.playerShipVisual.config.sailState !== sailState) {
      this.playerShipVisual.setSailState(sailState);
    }
  }

  private setCollisionDebugEnabled(enabled: boolean) {
    this.collisionDebugEnabled = enabled;
    this.collisionDebugGraphics?.setVisible(enabled);
    this.shipHullDebugGraphics?.setVisible(enabled);
    this.drawTerrainCollisionDebug();
    this.drawShipHullDebug();

    this.collisionDebugStatus
      ?.setText(`HITBOXES  ${enabled ? 'ON' : 'OFF'}`)
      .setColor(enabled ? '#fde68a' : '#bae6fd');
  }

  private drawTerrainCollisionDebug() {
    const graphics = this.collisionDebugGraphics;
    graphics?.clear();
    if (!graphics || !this.collisionDebugEnabled || !this.archipelago) {
      return;
    }

    const bounds = getVisibleTileBounds(
      this.cameras.main.worldView,
      this.archipelago.width,
      this.archipelago.height,
      TERRAIN_TILE_SIZE,
      TERRAIN_DEBUG_PADDING_TILES,
    );
    graphics.fillStyle(TERRAIN_DEBUG_FILL_COLOR, 0.4);
    graphics.lineStyle(1, TERRAIN_DEBUG_FACE_COLOR, 1);

    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        if (!this.archipelago.landMask[y * this.archipelago.width + x]) {
          continue;
        }
        const worldX = x * TERRAIN_TILE_SIZE;
        const worldY = y * TERRAIN_TILE_SIZE;
        graphics.fillRect(worldX, worldY, TERRAIN_TILE_SIZE, TERRAIN_TILE_SIZE);
        graphics.strokeRect(worldX, worldY, TERRAIN_TILE_SIZE, TERRAIN_TILE_SIZE);
      }
    }
  }

  private drawShipHullDebug() {
    const graphics = this.shipHullDebugGraphics;
    graphics?.clear();
    if (!graphics || !this.collisionDebugEnabled || !this.build || !this.playerShip) {
      return;
    }

    const corners = getOrientedHullCorners(
      this.getPlayerHullPose(),
      SHIP_HULL_FOOTPRINTS[this.build.size],
    );
    graphics.lineStyle(2, SHIP_BODY_DEBUG_COLOR, 1);
    graphics.strokePoints(Array.from(corners), true, true);
  }

  private handleShutdown() {
    this.collisionDebugGraphics?.clear();
    this.shipHullDebugGraphics?.clear();
    this.archipelago = undefined;
    this.playerShip = undefined;
    this.playerShipVisual = undefined;
    this.controls = undefined;
    this.escapeKey = undefined;
    this.collisionDebugKey = undefined;
    this.collisionDebugEnabled = false;
    this.collisionDebugGraphics = undefined;
    this.shipHullDebugGraphics = undefined;
    this.collisionDebugStatus = undefined;
    this.windStreaks = undefined;
    if (this.textures.exists(BLOB_TERRAIN_TEXTURE_KEY)) {
      this.textures.remove(BLOB_TERRAIN_TEXTURE_KEY);
    }
  }
}

type TileBounds = Readonly<{
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}>;

function getVisibleTileBounds(
  worldView: Phaser.Geom.Rectangle,
  mapWidth: number,
  mapHeight: number,
  tileSize: number,
  padding: number,
): TileBounds {
  return {
    minX: Phaser.Math.Clamp(Math.floor(worldView.left / tileSize) - padding, 0, mapWidth - 1),
    maxX: Phaser.Math.Clamp(Math.floor(worldView.right / tileSize) + padding, 0, mapWidth - 1),
    minY: Phaser.Math.Clamp(Math.floor(worldView.top / tileSize) - padding, 0, mapHeight - 1),
    maxY: Phaser.Math.Clamp(Math.floor(worldView.bottom / tileSize) + padding, 0, mapHeight - 1),
  };
}

function findOpenWaterSpawn(
  archipelago: GeneratedArchipelago,
  clearance: number,
): Readonly<{ x: number; y: number }> {
  const cellCount = archipelago.width * archipelago.height;
  const startIndex = archipelago.seed % cellCount;

  for (let offset = 0; offset < cellCount; offset += 1) {
    const index = (startIndex + offset) % cellCount;
    const x = index % archipelago.width;
    const y = Math.floor(index / archipelago.width);
    if (hasWaterClearance(archipelago, x, y, clearance)) {
      return {
        x: (x + 0.5) * TERRAIN_TILE_SIZE,
        y: (y + 0.5) * TERRAIN_TILE_SIZE,
      };
    }
  }

  throw new Error('Generated archipelago has no safe open-water ship spawn.');
}

function hasWaterClearance(
  archipelago: GeneratedArchipelago,
  centerX: number,
  centerY: number,
  clearance: number,
): boolean {
  if (
    centerX < clearance
    || centerX >= archipelago.width - clearance
    || centerY < clearance
    || centerY >= archipelago.height - clearance
  ) {
    return false;
  }

  for (let y = centerY - clearance; y <= centerY + clearance; y += 1) {
    for (let x = centerX - clearance; x <= centerX + clearance; x += 1) {
      if (archipelago.landMask[y * archipelago.width + x]) {
        return false;
      }
    }
  }
  return true;
}
