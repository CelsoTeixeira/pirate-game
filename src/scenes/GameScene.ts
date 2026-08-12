import Phaser from 'phaser';
import { PlayerCombatController } from '../combat/PlayerCombatController';
import { WindPathGuides } from '../effects/windPathGuides';
import { WindStreaks } from '../effects/windStreaks';
import { CannonBall } from '../entities/CannonBall';
import { ModularShip, type ModularShipSailState, type ShipBuild } from '../entities/ModularShip';
import { SHIP_CREW_DEFEATED_EVENT, Ship, type SailState } from '../entities/Ship';
import { createPlayerCannonDefinitions } from '../entities/playerShipCannonDefinitions';
import { KeyboardControls } from '../input/KeyboardControls';
import {
  gameHudStore,
  hideGameHud,
  initializeGameHud,
  syncGameHudControls,
  syncGameHudResources,
  syncMinimapPlayerPose,
  type MinimapPlayerPose,
  type MinimapPointOfInterest,
  type MinimapWorldSnapshot,
} from '../ui/gameHudStore';
import { Wind } from '../world/Wind';
import { sampleGeneratedWind } from '../world/generation/wind';
import {
  DEFAULT_ARCHIPELAGO_CONFIG,
  generateArchipelago,
  type GeneratedArchipelago,
} from '../world/generation/archipelago';
import type {
  GeneratedNaturalFeature,
  GeneratedPointOfInterest,
  GeneratedSettlementModule,
  NaturalFeatureKind,
  PoiSize,
  SettlementModuleKind,
} from '../world/generation/pointsOfInterest';
import { buildTerrainTileIndices, VALID_BLOB_MASKS } from '../world/terrain/blobAutotile';
import {
  BLOB_TERRAIN_TEXTURE_KEY,
  createBlobTerrainAtlas,
  TERRAIN_TILE_SIZE,
} from '../world/terrain/createBlobTerrainAtlas';
import {
  getOrientedHullCorners,
  orientedHullOverlapsLand,
  resolveOrientedHullTurn,
  type OrientedHullFootprint,
  type OrientedHullPose,
} from '../world/terrain/orientedHullCollision';

const TERRAIN_MATERIAL_KEY = 'terrain-atlas-64';
const TERRAIN_MATERIAL_PATH = 'assets/terrain/terrain-atlas-64.png';
const OCEAN_FRAME = 1;
const CAMERA_FOLLOW_LERP = 0.1;
const SPAWN_CLEARANCE_TILES = 2;
const DOCKING_RANGE_TILES = 2.5;
const COLLISION_DEBUG_DEPTH = 90;
const TERRAIN_DEBUG_FILL_COLOR = 0xfb923c;
const TERRAIN_DEBUG_FACE_COLOR = 0xffedd5;
const TERRAIN_DEBUG_PADDING_TILES = 1;
const SHIP_BODY_DEBUG_COLOR = 0x22d3ee;
const SHIP_WORLD_SCALE = 0.6;
const MINIMAP_POSE_INTERVAL_MS = 50;
const MINIMAP_POSITION_EPSILON = 1;
const MINIMAP_ROTATION_EPSILON = Phaser.Math.DegToRad(1);
const GENERATION_DEBUG_DEPTH = 88;
const DEBUG_PANEL_WIDTH = 332;
const DEBUG_PANEL_HEIGHT = 288;
const DEBUG_PANEL_MARGIN = 12;
const FREE_CAMERA_SPEED = 720;
const FREE_CAMERA_MIN_ZOOM = 0.5;
const FREE_CAMERA_MAX_ZOOM = 2.4;
const DEBUG_DETAIL_COLORS = Object.freeze({
  settlement: 0x67e8f9,
  natural: 0x86efac,
  landPoi: 0xfbbf24,
  waterPoi: 0x60a5fa,
});
type WaterPointOfInterest = Extract<GeneratedPointOfInterest, { environment: 'water' }>;
type WaterPointOfInterestKind = WaterPointOfInterest['kind'];
type PointOfInterestTexture = Readonly<{
  key: string;
  path: string;
}>;

const WATER_ENCOUNTER_TEXTURES: Readonly<Record<WaterPointOfInterestKind, PointOfInterestTexture>> = Object.freeze({
  'merchant-ship': { key: 'poi-merchant-ship', path: 'assets/poi/merchant-ship.png' },
  'navy-patrol': { key: 'poi-navy-patrol', path: 'assets/poi/navy-patrol.png' },
  'pirate-ship': { key: 'poi-pirate-ship', path: 'assets/poi/pirate-ship.png' },
  kraken: { key: 'poi-kraken', path: 'assets/poi/kraken.png' },
  'ghost-ship': { key: 'poi-ghost-ship', path: 'assets/poi/ghost-ship.png' },
  'siren-waters': { key: 'poi-siren-waters', path: 'assets/poi/siren-waters.png' },
});
const WATER_ENCOUNTER_DISPLAY_SIZES: Readonly<Record<PoiSize, number>> = Object.freeze({
  small: 24,
  medium: 40,
  big: 56,
});
type WorldModuleKind = SettlementModuleKind | NaturalFeatureKind;
type WorldModuleTexture = Readonly<{
  key: string;
  path: string;
  displaySize: number;
}>;

const WORLD_MODULE_TEXTURES: Readonly<Record<WorldModuleKind, WorldModuleTexture>> = Object.freeze({
  house: { key: 'world-module-house', path: 'assets/world-modules/house.png', displaySize: 56 },
  market: { key: 'world-module-market', path: 'assets/world-modules/market.png', displaySize: 58 },
  tower: { key: 'world-module-tower', path: 'assets/world-modules/tower.png', displaySize: 50 },
  'fortress-keep': { key: 'world-module-fortress-keep', path: 'assets/world-modules/fortress-keep.png', displaySize: 60 },
  'pirate-hideout': { key: 'world-module-pirate-hideout', path: 'assets/world-modules/pirate-hideout.png', displaySize: 58 },
  dock: { key: 'world-module-dock', path: 'assets/world-modules/dock.png', displaySize: 50 },
  warehouse: { key: 'world-module-warehouse', path: 'assets/world-modules/warehouse.png', displaySize: 58 },
  'tree-cluster': { key: 'world-module-tree-cluster', path: 'assets/world-modules/tree-cluster.png', displaySize: 56 },
  'palm-cluster': { key: 'world-module-palm-cluster', path: 'assets/world-modules/palm-cluster.png', displaySize: 56 },
  mountain: { key: 'world-module-mountain', path: 'assets/world-modules/mountain.png', displaySize: 60 },
  'rock-cluster': { key: 'world-module-rock-cluster', path: 'assets/world-modules/rock-cluster.png', displaySize: 54 },
  ruins: { key: 'world-module-ruins', path: 'assets/world-modules/ruins.png', displaySize: 56 },
  'treasure-shrine': { key: 'world-module-treasure-shrine', path: 'assets/world-modules/treasure-shrine.png', displaySize: 56 },
});
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

type GameSceneData = Readonly<{
  seed?: number;
  build?: ShipBuild;
}>;

type LandPointOfInterest = Extract<
  GeneratedArchipelago['pointsOfInterest'][number],
  { environment: 'land' }
>;

export class GameScene extends Phaser.Scene {
  private seed = 0;
  private build?: ShipBuild;
  private archipelago?: GeneratedArchipelago;
  private playerShip?: Ship;
  private playerCombat?: PlayerCombatController;
  private playerShipVisual?: ModularShip;
  private controls?: KeyboardControls;
  private escapeKey?: Phaser.Input.Keyboard.Key;
  private collisionDebugKey?: Phaser.Input.Keyboard.Key;
  private collisionDebugEnabled = false;
  private collisionDebugGraphics?: Phaser.GameObjects.Graphics;
  private shipHullDebugGraphics?: Phaser.GameObjects.Graphics;
  private collisionDebugStatus?: Phaser.GameObjects.Text;
  private generationGridDebugGraphics?: Phaser.GameObjects.Graphics;
  private windDebugGraphics?: Phaser.GameObjects.Graphics;
  private poiDebugGraphics?: Phaser.GameObjects.Graphics;
  private detailDebugGraphics?: Phaser.GameObjects.Graphics;
  private windDebugLabels: Phaser.GameObjects.Text[] = [];
  private poiDebugLabels: Phaser.GameObjects.Text[] = [];
  private detailDebugLabels: Phaser.GameObjects.Text[] = [];
  private windPathGuides?: WindPathGuides;
  private debugPanel?: Phaser.GameObjects.Container;
  private debugPanelBackground?: Phaser.GameObjects.Rectangle;
  private debugPanelText?: Phaser.GameObjects.Text;
  private generationDebugKey?: Phaser.Input.Keyboard.Key;
  private freeCameraKey?: Phaser.Input.Keyboard.Key;
  private generationGridKey?: Phaser.Input.Keyboard.Key;
  private windDebugKey?: Phaser.Input.Keyboard.Key;
  private poiDebugKey?: Phaser.Input.Keyboard.Key;
  private detailDebugKey?: Phaser.Input.Keyboard.Key;
  private freeCameraResetKey?: Phaser.Input.Keyboard.Key;
  private freeCameraZoomInKey?: Phaser.Input.Keyboard.Key;
  private freeCameraZoomOutKey?: Phaser.Input.Keyboard.Key;
  private freeCameraPanKeys?: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private freeCameraCursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  private debugPanelEnabled = false;
  private freeCameraEnabled = false;
  private generationGridDebugEnabled = false;
  private windDebugEnabled = false;
  private poiDebugEnabled = false;
  private detailDebugEnabled = false;
  private windStreaks?: WindStreaks;
  private oceanTileSprite?: Phaser.GameObjects.TileSprite;
  private currentDockingPointId?: string;
  private lastMinimapPosePublishedAt = 0;
  private lastMinimapPlayerPose?: MinimapPlayerPose;
  private readonly wind = new Wind(0, 0);

  constructor() {
    super('GameScene');
  }

  init(data: GameSceneData) {
    if (!data.build) {
      throw new Error('GameScene requires a ship build from WorldGenerationScene.');
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
    for (const texture of Object.values(WATER_ENCOUNTER_TEXTURES)) {
      if (!this.textures.exists(texture.key)) {
        this.load.image(texture.key, texture.path);
      }
    }
    for (const texture of Object.values(WORLD_MODULE_TEXTURES)) {
      if (!this.textures.exists(texture.key)) {
        this.load.image(texture.key, texture.path);
      }
    }
    Ship.preload(this);
    CannonBall.preload(this);
    ModularShip.preload(this);
  }

  create() {
    if (!this.build) {
      throw new Error('GameScene cannot create without a ship build.');
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeOceanToCamera, this);
    this.archipelago = generateArchipelago(this.seed, DEFAULT_ARCHIPELAGO_CONFIG);
    createBlobTerrainAtlas(this, TERRAIN_MATERIAL_KEY);

    const worldWidth = this.archipelago.width * TERRAIN_TILE_SIZE;
    const worldHeight = this.archipelago.height * TERRAIN_TILE_SIZE;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main
      .setBackgroundColor('#082f49')
      .setBounds(0, 0, worldWidth, worldHeight);

    this.oceanTileSprite = this.add.tileSprite(
      this.cameras.main.x,
      this.cameras.main.y,
      this.cameras.main.width,
      this.cameras.main.height,
      TERRAIN_MATERIAL_KEY,
      OCEAN_FRAME,
    ).setOrigin(0).setScrollFactor(0).setDepth(-30);
    this.syncOceanToCamera();

    const map = this.make.tilemap({
      data: buildTerrainTileIndices(this.archipelago),
      tileWidth: TERRAIN_TILE_SIZE,
      tileHeight: TERRAIN_TILE_SIZE,
      insertNull: true,
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
    this.createWorldDecorationVisuals();

    this.collisionDebugGraphics = this.add.graphics()
      .setDepth(COLLISION_DEBUG_DEPTH)
      .setVisible(false);
    this.shipHullDebugGraphics = this.add.graphics()
      .setDepth(COLLISION_DEBUG_DEPTH + 1)
      .setVisible(false);
    this.createGenerationDebugVisuals();

    const spawn = findOpenWaterSpawn(this.archipelago, SPAWN_CLEARANCE_TILES);
    this.playerShip = new Ship(
      this,
      spawn.x,
      spawn.y,
      'pirate',
      this.build.size,
      createPlayerCannonDefinitions(this.build),
    );
    this.playerShip.sailState = SAIL_STATES.indexOf(this.build.sailState) as SailState;
    this.playerCombat = new PlayerCombatController(this, this.playerShip);
    this.playerShip.on(
      SHIP_CREW_DEFEATED_EVENT,
      this.handlePlayerCrewDefeated,
      this,
    );
    const initialMinimapPlayerPose = this.createMinimapPlayerPose();
    initializeGameHud({
      rudder: 0,
      sailState: this.playerShip.sailState,
      anchored: this.playerShip.anchored,
      resources: this.playerShip.resourceSnapshot,
      minimapWorld: createMinimapWorldSnapshot(this.archipelago),
      minimapPlayerPose: initialMinimapPlayerPose,
    });
    this.lastMinimapPlayerPose = initialMinimapPlayerPose;
    this.lastMinimapPosePublishedAt = this.time.now;
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
    const keyboard = this.input.keyboard;
    this.escapeKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.collisionDebugKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    this.generationDebugKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    this.freeCameraKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.generationGridKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.windDebugKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.poiDebugKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
    this.detailDebugKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);
    this.freeCameraResetKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.freeCameraZoomInKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.freeCameraZoomOutKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    if (keyboard) {
      this.freeCameraCursorKeys = keyboard.createCursorKeys();
      this.freeCameraPanKeys = keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
      }) as typeof this.freeCameraPanKeys;
    }
    this.windStreaks = new WindStreaks(
      this,
      this.wind,
      () => ({
        x: this.playerShip?.x ?? 0,
        y: this.playerShip?.y ?? 0,
      }),
    );
    this.windPathGuides = new WindPathGuides(
      this,
      this.archipelago.wind,
      TERRAIN_TILE_SIZE,
    );
    this.syncShipVisual();
    this.cameras.main.startFollow(
      this.playerShip,
      true,
      CAMERA_FOLLOW_LERP,
      CAMERA_FOLLOW_LERP,
    );

    this.add.text(16, 16, `GAME WORLD  seed ${this.seed}`, {
      color: '#e0f2fe',
      fontFamily: 'monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      backgroundColor: '#071b28cc',
      padding: { x: 8, y: 5 },
    }).setScrollFactor(0).setDepth(100);
    this.add.text(16, 51, '[W/S] sails  [A/D] steer  [X] anchor  [B] hitboxes  [G] debug  [ESC] generation lab', {
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
    this.createGenerationDebugPanel();
    this.updateGenerationDebugPanel();
  }

  update(time: number, delta: number) {
    if (!this.playerShip || !this.controls) {
      return;
    }

    if (gameHudStore.getSnapshot().mapOpen) {
      this.controls.reset();
      this.playerCombat?.update(false);
      this.resetDebugKeys();
      this.playerShip.setVelocity(0, 0);
      return;
    }

    if (this.generationDebugKey && Phaser.Input.Keyboard.JustDown(this.generationDebugKey)) {
      this.setGenerationDebugPanelEnabled(!this.debugPanelEnabled);
    }
    if (this.escapeKey && Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      this.scene.start('WorldGenerationScene', { seed: this.seed, build: this.build });
      return;
    }
    if (this.collisionDebugKey && Phaser.Input.Keyboard.JustDown(this.collisionDebugKey)) {
      this.setCollisionDebugEnabled(!this.collisionDebugEnabled);
    }
    if (this.freeCameraKey && Phaser.Input.Keyboard.JustDown(this.freeCameraKey)) {
      this.setFreeCameraEnabled(!this.freeCameraEnabled);
    }
    if (this.generationGridKey && Phaser.Input.Keyboard.JustDown(this.generationGridKey)) {
      this.generationGridDebugEnabled = !this.generationGridDebugEnabled;
      this.syncGenerationDebugVisibility();
    }
    if (this.windDebugKey && Phaser.Input.Keyboard.JustDown(this.windDebugKey)) {
      this.windDebugEnabled = !this.windDebugEnabled;
      this.syncGenerationDebugVisibility();
    }
    if (this.poiDebugKey && Phaser.Input.Keyboard.JustDown(this.poiDebugKey)) {
      this.poiDebugEnabled = !this.poiDebugEnabled;
      this.syncGenerationDebugVisibility();
    }
    if (this.detailDebugKey && Phaser.Input.Keyboard.JustDown(this.detailDebugKey)) {
      this.detailDebugEnabled = !this.detailDebugEnabled;
      this.syncGenerationDebugVisibility();
    }
    if (this.freeCameraEnabled) {
      if (this.freeCameraResetKey && Phaser.Input.Keyboard.JustDown(this.freeCameraResetKey)) {
        this.resetFreeCameraPosition();
      }
      this.updateFreeCamera(delta);
      this.playerShip.setVelocity(0, 0);
      this.playerCombat?.update(false);
      this.drawTerrainCollisionDebug();
      this.drawShipHullDebug();
      this.syncOceanToCamera();
      this.updateGenerationDebugPanel();
      return;
    }
    if (this.controls.isSailUpJustPressed()) this.playerShip.raiseSail();
    if (this.controls.isSailDownJustPressed()) this.playerShip.lowerSail();
    if (this.controls.isAnchorTogglePressed()) this.playerShip.toggleAnchor();

    const rudder = this.controls.getRudder();
    this.movePlayerShip(rudder, delta);
    this.playerCombat?.update();
    this.updateDocking();
    syncGameHudControls(rudder, this.playerShip.sailState, this.playerShip.anchored);
    syncGameHudResources(this.playerShip.resourceSnapshot);
    this.publishMinimapPlayerPose(time);
    this.syncShipVisual();
    this.drawTerrainCollisionDebug();
    this.drawShipHullDebug();
    this.windStreaks?.update();
    this.syncOceanToCamera();
    this.updateGenerationDebugPanel();
  }

  private syncOceanToCamera() {
    const ocean = this.oceanTileSprite;
    if (!ocean) {
      return;
    }

    const worldView = this.cameras.main.worldView;
    ocean.setTilePosition(worldView.left, worldView.top);
  }

  private createGenerationDebugVisuals() {
    if (!this.archipelago) {
      return;
    }

    this.generationGridDebugGraphics = this.add.graphics()
      .setDepth(GENERATION_DEBUG_DEPTH)
      .setVisible(this.generationGridDebugEnabled);
    this.windDebugGraphics = this.add.graphics()
      .setDepth(GENERATION_DEBUG_DEPTH)
      .setVisible(this.windDebugEnabled);
    this.poiDebugGraphics = this.add.graphics()
      .setDepth(GENERATION_DEBUG_DEPTH)
      .setVisible(this.poiDebugEnabled);
    this.detailDebugGraphics = this.add.graphics()
      .setDepth(GENERATION_DEBUG_DEPTH)
      .setVisible(this.detailDebugEnabled);

    this.drawGenerationGridDebug();
    this.drawWindDebug();
    this.drawPoiDebug();
    this.drawGenerationDetailsDebug();
    this.syncGenerationDebugVisibility();
  }

  private drawGenerationGridDebug() {
    const graphics = this.generationGridDebugGraphics;
    if (!graphics || !this.archipelago) {
      return;
    }

    graphics.lineStyle(1, 0x93c5fd, 0.38);
    for (let y = 0; y < this.archipelago.height; y += 1) {
      for (let x = 0; x < this.archipelago.width; x += 1) {
        if (!this.archipelago.landMask[y * this.archipelago.width + x]) {
          continue;
        }
        graphics.strokeRect(
          x * TERRAIN_TILE_SIZE,
          y * TERRAIN_TILE_SIZE,
          TERRAIN_TILE_SIZE,
          TERRAIN_TILE_SIZE,
        );
      }
    }
  }

  private drawWindDebug() {
    const graphics = this.windDebugGraphics;
    if (!graphics || !this.archipelago) {
      return;
    }

    this.archipelago.wind.loops.forEach((loop) => {
      if (loop.points.length < 2) {
        return;
      }

      // Runtime sampling measures distance to each loop segment. Render the
      // same corridor as thick translucent segment capsules so the debug view
      // does not imply that wind exists only around its waypoint anchors.
      const corridorRadius = loop.corridorRadius * TERRAIN_TILE_SIZE;
      graphics.lineStyle(corridorRadius * 2, 0xfef08a, 0.12);
      graphics.fillStyle(0xfef08a, 0.12);
      loop.points.forEach((point, index) => {
        const next = loop.points[(index + 1) % loop.points.length];
        const startX = point.x * TERRAIN_TILE_SIZE;
        const startY = point.y * TERRAIN_TILE_SIZE;
        const endX = next.x * TERRAIN_TILE_SIZE;
        const endY = next.y * TERRAIN_TILE_SIZE;
        graphics.lineBetween(startX, startY, endX, endY);
        graphics.fillCircle(startX, startY, corridorRadius);
      });

      graphics.lineStyle(3, 0xfef08a, 0.8);
      graphics.fillStyle(0xfef08a, 0.9);
      loop.points.forEach((point, index) => {
        const next = loop.points[(index + 1) % loop.points.length];
        const startX = point.x * TERRAIN_TILE_SIZE;
        const startY = point.y * TERRAIN_TILE_SIZE;
        const endX = next.x * TERRAIN_TILE_SIZE;
        const endY = next.y * TERRAIN_TILE_SIZE;
        graphics.lineBetween(startX, startY, endX, endY);

        const midpointX = (startX + endX) / 2;
        const midpointY = (startY + endY) / 2;
        const direction = Math.atan2(endY - startY, endX - startX);
        const arrowX = midpointX + Math.cos(direction) * 28;
        const arrowY = midpointY + Math.sin(direction) * 28;
        graphics.lineBetween(midpointX, midpointY, arrowX, arrowY);
        graphics.lineBetween(
          arrowX,
          arrowY,
          arrowX - Math.cos(direction - 0.55) * 10,
          arrowY - Math.sin(direction - 0.55) * 10,
        );
        graphics.lineBetween(
          arrowX,
          arrowY,
          arrowX - Math.cos(direction + 0.55) * 10,
          arrowY - Math.sin(direction + 0.55) * 10,
        );
      });
      loop.points.forEach((point, pointIndex) => {
        const next = loop.points[(pointIndex + 1) % loop.points.length];
        const direction = Math.atan2(next.y - point.y, next.x - point.x);
        graphics.fillCircle(
          point.x * TERRAIN_TILE_SIZE,
          point.y * TERRAIN_TILE_SIZE,
          7,
        );
        const label = this.add.text(
          point.x * TERRAIN_TILE_SIZE + 10,
          point.y * TERRAIN_TILE_SIZE - 18,
          `${loop.id}  ${Math.round(loop.strength * 100)}%  dir ${direction.toFixed(2)}`,
          {
            color: '#fef08a',
            fontFamily: 'monospace',
            fontSize: '11px',
            backgroundColor: '#422006cc',
            padding: { x: 3, y: 2 },
          },
        ).setDepth(GENERATION_DEBUG_DEPTH + 1);
        this.windDebugLabels.push(label);
      });
    });
  }

  private drawPoiDebug() {
    const graphics = this.poiDebugGraphics;
    if (!graphics || !this.archipelago) {
      return;
    }

    this.archipelago.pointsOfInterest.forEach((point) => {
      const color = point.environment === 'land'
        ? DEBUG_DETAIL_COLORS.landPoi
        : DEBUG_DETAIL_COLORS.waterPoi;
      graphics.fillStyle(color, 0.24);
      point.occupiedCells.forEach((cell) => {
        graphics.fillRect(
          cell.x * TERRAIN_TILE_SIZE,
          cell.y * TERRAIN_TILE_SIZE,
          TERRAIN_TILE_SIZE,
          TERRAIN_TILE_SIZE,
        );
      });
      graphics.lineStyle(2, color, 0.9);
      graphics.strokeCircle(
        (point.x + 0.5) * TERRAIN_TILE_SIZE,
        (point.y + 0.5) * TERRAIN_TILE_SIZE,
        point.size === 'big' ? 16 : point.size === 'medium' ? 11 : 7,
      );
      const label = this.add.text(
        (point.x + 0.5) * TERRAIN_TILE_SIZE + 9,
        (point.y + 0.5) * TERRAIN_TILE_SIZE + 8,
        `${point.id} ${point.kind}`,
        {
          color: point.environment === 'land' ? '#fbbf24' : '#60a5fa',
          fontFamily: 'monospace',
          fontSize: '10px',
          backgroundColor: '#020617cc',
          padding: { x: 3, y: 2 },
        },
      ).setDepth(GENERATION_DEBUG_DEPTH + 1);
      this.poiDebugLabels.push(label);
    });
  }

  private drawGenerationDetailsDebug() {
    const graphics = this.detailDebugGraphics;
    if (!graphics || !this.archipelago) {
      return;
    }

    graphics.lineStyle(2, DEBUG_DETAIL_COLORS.settlement, 0.85);
    this.archipelago.settlementModules.forEach((module) => {
      module.occupiedCells.forEach((cell) => {
        graphics.strokeRect(
          cell.x * TERRAIN_TILE_SIZE + 4,
          cell.y * TERRAIN_TILE_SIZE + 4,
          TERRAIN_TILE_SIZE - 8,
          TERRAIN_TILE_SIZE - 8,
        );
      });
    });
    graphics.lineStyle(2, DEBUG_DETAIL_COLORS.natural, 0.85);
    this.archipelago.naturalFeatures.forEach((feature) => {
      feature.occupiedCells.forEach((cell) => {
        graphics.strokeCircle(
          (cell.x + 0.5) * TERRAIN_TILE_SIZE,
          (cell.y + 0.5) * TERRAIN_TILE_SIZE,
          9,
        );
      });
    });

    const moduleLabel = this.add.text(
      8,
      8,
      `modules ${this.archipelago.settlementModules.length}  natural ${this.archipelago.naturalFeatures.length}`,
      {
        color: '#86efac',
        fontFamily: 'monospace',
        fontSize: '11px',
        backgroundColor: '#052e16cc',
        padding: { x: 4, y: 3 },
      },
    ).setDepth(GENERATION_DEBUG_DEPTH + 1);
    this.detailDebugLabels.push(moduleLabel);
  }

  private syncGenerationDebugVisibility() {
    this.generationGridDebugGraphics?.setVisible(this.generationGridDebugEnabled);
    this.windDebugGraphics?.setVisible(this.windDebugEnabled);
    this.poiDebugGraphics?.setVisible(this.poiDebugEnabled);
    this.detailDebugGraphics?.setVisible(this.detailDebugEnabled);
    this.windDebugLabels.forEach((label) => label.setVisible(this.windDebugEnabled));
    this.poiDebugLabels.forEach((label) => label.setVisible(this.poiDebugEnabled));
    this.detailDebugLabels.forEach((label) => label.setVisible(this.detailDebugEnabled));
    this.updateGenerationDebugPanel();
  }

  private createGenerationDebugPanel() {
    const background = this.add.rectangle(0, 0, DEBUG_PANEL_WIDTH, DEBUG_PANEL_HEIGHT, 0x020617, 0.94)
      .setOrigin(0)
      .setStrokeStyle(2, 0x38bdf8, 0.85);
    this.debugPanelBackground = background;
    this.debugPanelText = this.add.text(0, 0, '', {
      color: '#dbeafe',
      fontFamily: 'monospace',
      fontSize: '11px',
      lineSpacing: 4,
      padding: { x: 12, y: 10 },
    });
    this.debugPanel = this.add.container(0, 0, [background, this.debugPanelText])
      .setScrollFactor(0)
      .setDepth(120)
      .setVisible(false);
    this.resizeDebugPanel();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeDebugPanel, this);
  }

  private resizeDebugPanel() {
    const panelX = Math.max(
      DEBUG_PANEL_MARGIN,
      this.scale.width - DEBUG_PANEL_WIDTH - DEBUG_PANEL_MARGIN,
    );
    this.debugPanelBackground?.setPosition(panelX, DEBUG_PANEL_MARGIN);
    this.debugPanelText?.setPosition(panelX, DEBUG_PANEL_MARGIN);
  }

  private setGenerationDebugPanelEnabled(enabled: boolean) {
    this.debugPanelEnabled = enabled;
    this.debugPanel?.setVisible(enabled);
    this.updateGenerationDebugPanel();
  }

  private updateGenerationDebugPanel() {
    if (!this.debugPanelText || !this.archipelago) {
      return;
    }
    const landPointCount = this.archipelago.pointsOfInterest
      .filter((point) => point.environment === 'land').length;
    const waterPointCount = this.archipelago.pointsOfInterest.length - landPointCount;
    const camera = this.cameras.main;
    this.debugPanelText.setText([
      'GENERATION DEBUG',
      `MAP ${this.archipelago.width}x${this.archipelago.height}  CELLS ${this.archipelago.width * this.archipelago.height}`,
      `ISLANDS ${getGeneratedIslandCount(this.archipelago)}  LAND ${landPointCount}  WATER ${waterPointCount}`,
      `MODULES ${this.archipelago.settlementModules.length}  NATURAL ${this.archipelago.naturalFeatures.length}`,
      `WIND LOOPS ${this.archipelago.wind.loops.length}  AMBIENT ${this.archipelago.wind.ambientDirectionRad.toFixed(2)}rad`,
      '',
      `B hitboxes       ${this.collisionDebugEnabled ? 'ON' : 'OFF'}`,
      `F free camera    ${this.freeCameraEnabled ? 'ON' : 'OFF'}`,
      `1 terrain grid   ${this.generationGridDebugEnabled ? 'ON' : 'OFF'}`,
      `2 wind corridors ${this.windDebugEnabled ? 'ON' : 'OFF'}`,
      `3 POI cells      ${this.poiDebugEnabled ? 'ON' : 'OFF'}`,
      `4 world details  ${this.detailDebugEnabled ? 'ON' : 'OFF'}`,
      '',
      `CAM ${Math.round(camera.scrollX)},${Math.round(camera.scrollY)}  ZOOM ${camera.zoom.toFixed(2)}`,
      'G panel  F free view  R reset camera',
      'WASD/arrows pan  Q/E zoom',
    ]);
  }

  private setFreeCameraEnabled(enabled: boolean) {
    if (!this.playerShip) {
      return;
    }
    this.freeCameraEnabled = enabled;
    const camera = this.cameras.main;
    this.playerShip.setVelocity(0, 0);
    if (enabled) {
      camera.stopFollow();
      this.resetFreeCameraPosition();
    } else {
      camera.setZoom(1);
      camera.startFollow(this.playerShip, true, CAMERA_FOLLOW_LERP, CAMERA_FOLLOW_LERP);
      this.controls?.reset();
    }
    this.updateGenerationDebugPanel();
  }

  private updateFreeCamera(delta: number) {
    const keys = this.freeCameraPanKeys;
    if (!keys || !this.archipelago) {
      return;
    }
    const cursors = this.freeCameraCursorKeys;
    const horizontal = Number(keys.right.isDown || cursors?.right.isDown)
      - Number(keys.left.isDown || cursors?.left.isDown);
    const vertical = Number(keys.down.isDown || cursors?.down.isDown)
      - Number(keys.up.isDown || cursors?.up.isDown);
    const speed = FREE_CAMERA_SPEED * Math.min(delta, 50) / 1000 / this.cameras.main.zoom;
    this.setFreeCameraScroll(
      this.cameras.main.scrollX + horizontal * speed,
      this.cameras.main.scrollY + vertical * speed,
    );
    if (this.freeCameraZoomOutKey?.isDown) {
      this.cameras.main.setZoom(Phaser.Math.Clamp(
        this.cameras.main.zoom - 0.015,
        FREE_CAMERA_MIN_ZOOM,
        FREE_CAMERA_MAX_ZOOM,
      ));
    }
    if (this.freeCameraZoomInKey?.isDown) {
      this.cameras.main.setZoom(Phaser.Math.Clamp(
        this.cameras.main.zoom + 0.015,
        FREE_CAMERA_MIN_ZOOM,
        FREE_CAMERA_MAX_ZOOM,
      ));
    }
  }

  private resetFreeCameraPosition() {
    if (!this.playerShip) {
      return;
    }
    const camera = this.cameras.main;
    this.setFreeCameraScroll(
      this.playerShip.x - camera.width / camera.zoom / 2,
      this.playerShip.y - camera.height / camera.zoom / 2,
    );
  }

  private setFreeCameraScroll(scrollX: number, scrollY: number) {
    if (!this.archipelago) {
      return;
    }
    const camera = this.cameras.main;
    const worldWidth = this.archipelago.width * TERRAIN_TILE_SIZE;
    const worldHeight = this.archipelago.height * TERRAIN_TILE_SIZE;
    const maxScrollX = Math.max(0, worldWidth - camera.width / camera.zoom);
    const maxScrollY = Math.max(0, worldHeight - camera.height / camera.zoom);
    camera.setScroll(
      Phaser.Math.Clamp(scrollX, 0, maxScrollX),
      Phaser.Math.Clamp(scrollY, 0, maxScrollY),
    );
  }

  private resetDebugKeys() {
    this.escapeKey?.reset();
    this.collisionDebugKey?.reset();
    this.generationDebugKey?.reset();
    this.freeCameraKey?.reset();
    this.generationGridKey?.reset();
    this.windDebugKey?.reset();
    this.poiDebugKey?.reset();
    this.detailDebugKey?.reset();
    this.freeCameraResetKey?.reset();
    this.freeCameraZoomInKey?.reset();
    this.freeCameraZoomOutKey?.reset();
    Object.values(this.freeCameraPanKeys ?? {}).forEach((key) => key.reset());
    this.freeCameraCursorKeys?.up.reset();
    this.freeCameraCursorKeys?.down.reset();
    this.freeCameraCursorKeys?.left.reset();
    this.freeCameraCursorKeys?.right.reset();
  }

  private createWorldDecorationVisuals() {
    if (!this.archipelago) {
      return;
    }

    for (const point of this.archipelago.pointsOfInterest) {
      if (point.environment !== 'water') {
        continue;
      }
      const texture = WATER_ENCOUNTER_TEXTURES[point.kind];
      const displaySize = WATER_ENCOUNTER_DISPLAY_SIZES[point.size];
      this.add.image(
        (point.x + 0.5) * TERRAIN_TILE_SIZE,
        (point.y + 0.5) * TERRAIN_TILE_SIZE,
        texture.key,
      )
        .setDisplaySize(displaySize, displaySize)
        .setDepth(0);
    }

    this.archipelago.settlementModules.forEach((module) => {
      this.addWorldModuleImage(module);
    });
    this.archipelago.naturalFeatures.forEach((feature) => {
      this.addWorldModuleImage(feature);
    });
  }

  private addWorldModuleImage(
    decoration: GeneratedSettlementModule | GeneratedNaturalFeature,
  ) {
    const texture = WORLD_MODULE_TEXTURES[decoration.kind];
    this.add.image(
      (decoration.x + 0.5) * TERRAIN_TILE_SIZE,
      (decoration.y + 0.5) * TERRAIN_TILE_SIZE,
      texture.key,
    )
      .setDisplaySize(texture.displaySize, texture.displaySize)
      .setDepth(0);
  }

  private resizeOceanToCamera() {
    const ocean = this.oceanTileSprite;
    if (!ocean) {
      return;
    }

    const camera = this.cameras.main;
    ocean
      .setPosition(camera.x, camera.y)
      .setSize(camera.width, camera.height);
    this.syncOceanToCamera();
  }

  private movePlayerShip(rudder: -1 | 0 | 1, delta: number) {
    if (!this.playerShip || !this.archipelago || !this.build) {
      return;
    }

    const generatedWind = sampleGeneratedWind(
      this.archipelago.wind,
      this.playerShip.x,
      this.playerShip.y,
      TERRAIN_TILE_SIZE,
    );
    this.wind.directionRad = generatedWind.directionRad;
    this.wind.strength = generatedWind.strength;

    const previousPose = this.getPlayerHullPose();
    const footprint = SHIP_HULL_FOOTPRINTS[this.build.size];
    this.playerShip.sail(this.wind, rudder, delta);

    const canRecoverBlockedTurn = !this.playerShip.anchored && this.playerShip.sailState > 0;
    if (canRecoverBlockedTurn) {
      const turnResolution = resolveOrientedHullTurn(
        previousPose,
        this.playerShip.rotation,
        footprint,
        this.getCollisionGrid(),
      );
      if (turnResolution.backstep > 0) {
        this.playerShip.setPosition(turnResolution.pose.x, turnResolution.pose.y);
        this.playerShip.rotation = turnResolution.pose.rotation;
        this.playerShip.sail(this.wind, 0, 0);
      } else if (turnResolution.pose.rotation === previousPose.rotation) {
        this.playerShip.rotation = previousPose.rotation;
        // Recalculate the sailing vector for the accepted heading.
        this.playerShip.sail(this.wind, 0, 0);
      }
    } else if (this.hullOverlapsLand(this.getPlayerHullPose(), footprint)) {
      this.playerShip.rotation = previousPose.rotation;
      // Recalculate the sailing vector for the accepted heading.
      this.playerShip.sail(this.wind, 0, 0);
    }

    const body = this.playerShip.body;
    if (!(body instanceof Phaser.Physics.Arcade.Body)) {
      return;
    }

    const seconds = Math.min(delta, 50) / 1000;
    const movementStartPose = this.getPlayerHullPose();
    const targetX = movementStartPose.x + body.velocity.x * seconds;
    const targetY = movementStartPose.y + body.velocity.y * seconds;
    const rotation = this.playerShip.rotation;

    if (!this.hullOverlapsLand({ x: targetX, y: targetY, rotation }, footprint)) {
      this.playerShip.setPosition(targetX, targetY);
    } else {
      // Resolve each axis independently so the ship can slide along a coast.
      if (!this.hullOverlapsLand({ x: targetX, y: movementStartPose.y, rotation }, footprint)) {
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

    const acceptedDistance = Math.hypot(
      this.playerShip.x - previousPose.x,
      this.playerShip.y - previousPose.y,
    );
    this.playerShip.consumeSuppliesForDistance(acceptedDistance);
  }

  private updateDocking() {
    if (!this.playerShip || !this.archipelago) {
      return;
    }

    const dockingPoint = findDockingLandPoint(
      this.archipelago,
      this.playerShip.x,
      this.playerShip.y,
      DOCKING_RANGE_TILES * TERRAIN_TILE_SIZE,
    );
    if (!dockingPoint) {
      this.currentDockingPointId = undefined;
      return;
    }
    if (dockingPoint.id === this.currentDockingPointId) {
      return;
    }

    this.currentDockingPointId = dockingPoint.id;
    this.playerShip.restoreResources();
  }

  private handlePlayerCrewDefeated() {
    if (!this.playerShip || !this.archipelago) {
      return;
    }

    const respawn = findCrewDefeatRespawn(
      this.archipelago,
      this.playerShip.x,
      this.playerShip.y,
      SPAWN_CLEARANCE_TILES,
    );
    this.playerShip
      .setPosition(respawn.x, respawn.y)
      .setRotation(0)
      .setVelocity(0, 0);
    this.playerShip.anchored = false;
    this.playerShip.restore();
    this.currentDockingPointId = undefined;
    syncGameHudControls(0, this.playerShip.sailState, this.playerShip.anchored);
    syncGameHudResources(this.playerShip.resourceSnapshot);

    const minimapPose = this.createMinimapPlayerPose();
    syncMinimapPlayerPose(minimapPose);
    this.lastMinimapPlayerPose = minimapPose;
    this.lastMinimapPosePublishedAt = this.time.now;
    this.syncShipVisual();
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

  private createMinimapPlayerPose(): MinimapPlayerPose {
    if (!this.playerShip) {
      throw new Error('Cannot publish a minimap pose without a player ship.');
    }
    return Object.freeze({
      x: this.playerShip.x,
      y: this.playerShip.y,
      rotation: this.playerShip.rotation,
    });
  }

  private publishMinimapPlayerPose(time: number) {
    if (time - this.lastMinimapPosePublishedAt < MINIMAP_POSE_INTERVAL_MS) {
      return;
    }
    this.lastMinimapPosePublishedAt = time;

    const nextPose = this.createMinimapPlayerPose();
    const previousPose = this.lastMinimapPlayerPose;
    if (previousPose) {
      const positionDelta = Math.hypot(
        nextPose.x - previousPose.x,
        nextPose.y - previousPose.y,
      );
      const rotationDelta = Math.abs(Phaser.Math.Angle.Wrap(
        nextPose.rotation - previousPose.rotation,
      ));
      if (
        positionDelta < MINIMAP_POSITION_EPSILON
        && rotationDelta < MINIMAP_ROTATION_EPSILON
      ) {
        return;
      }
    }

    syncMinimapPlayerPose(nextPose);
    this.lastMinimapPlayerPose = nextPose;
  }

  private hullOverlapsLand(pose: OrientedHullPose, footprint: OrientedHullFootprint) {
    if (!this.archipelago) {
      return false;
    }
    return orientedHullOverlapsLand(pose, footprint, this.getCollisionGrid());
  }

  private getCollisionGrid() {
    if (!this.archipelago) {
      throw new Error('GameScene collision grid is unavailable before world creation.');
    }
    return {
      width: this.archipelago.width,
      height: this.archipelago.height,
      tileSize: TERRAIN_TILE_SIZE,
      landMask: this.archipelago.landMask,
    };
  }

  private syncShipVisual() {
    if (!this.playerShip || !this.playerShipVisual) {
      return;
    }
    this.playerShipVisual
      .setPosition(this.playerShip.x, this.playerShip.y)
      .setRotation(this.playerShip.rotation);
    if (this.playerShipVisual.damageState !== this.playerShip.damageState) {
      this.playerShipVisual.setDamageState(this.playerShip.damageState);
    }
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
    this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeOceanToCamera, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeDebugPanel, this);
    hideGameHud();
    this.cameras.main.stopFollow().setZoom(1);
    this.freeCameraEnabled = false;
    this.debugPanelEnabled = false;
    this.generationGridDebugGraphics?.clear();
    this.windDebugGraphics?.clear();
    this.poiDebugGraphics?.clear();
    this.detailDebugGraphics?.clear();
    this.windDebugLabels.forEach((label) => label.destroy());
    this.poiDebugLabels.forEach((label) => label.destroy());
    this.detailDebugLabels.forEach((label) => label.destroy());
    this.windDebugLabels = [];
    this.poiDebugLabels = [];
    this.detailDebugLabels = [];
    this.playerCombat?.destroy();
    this.playerShip?.off(
      SHIP_CREW_DEFEATED_EVENT,
      this.handlePlayerCrewDefeated,
      this,
    );
    this.currentDockingPointId = undefined;
    this.lastMinimapPosePublishedAt = 0;
    this.lastMinimapPlayerPose = undefined;
    this.collisionDebugGraphics?.clear();
    this.shipHullDebugGraphics?.clear();
    this.archipelago = undefined;
    this.playerShip = undefined;
    this.playerCombat = undefined;
    this.playerShipVisual = undefined;
    this.controls = undefined;
    this.escapeKey = undefined;
    this.collisionDebugKey = undefined;
    this.collisionDebugEnabled = false;
    this.collisionDebugGraphics = undefined;
    this.shipHullDebugGraphics = undefined;
    this.collisionDebugStatus = undefined;
    this.generationGridDebugGraphics = undefined;
    this.windDebugGraphics = undefined;
    this.poiDebugGraphics = undefined;
    this.detailDebugGraphics = undefined;
    this.debugPanel?.destroy();
    this.debugPanel = undefined;
    this.debugPanelBackground = undefined;
    this.debugPanelText = undefined;
    this.generationDebugKey = undefined;
    this.freeCameraKey = undefined;
    this.generationGridKey = undefined;
    this.windDebugKey = undefined;
    this.poiDebugKey = undefined;
    this.detailDebugKey = undefined;
    this.freeCameraResetKey = undefined;
    this.freeCameraZoomInKey = undefined;
    this.freeCameraZoomOutKey = undefined;
    this.freeCameraPanKeys = undefined;
    this.freeCameraCursorKeys = undefined;
    this.windStreaks = undefined;
    this.windPathGuides?.destroy();
    this.windPathGuides = undefined;
    this.oceanTileSprite = undefined;
    if (this.textures.exists(BLOB_TERRAIN_TEXTURE_KEY)) {
      this.textures.remove(BLOB_TERRAIN_TEXTURE_KEY);
    }
  }
}

function createMinimapWorldSnapshot(
  archipelago: GeneratedArchipelago,
): MinimapWorldSnapshot {
  const pointsOfInterest = archipelago.pointsOfInterest.map(
    (point): MinimapPointOfInterest => Object.freeze({
      id: point.id,
      environment: point.environment,
      size: point.size,
      tileX: point.x,
      tileY: point.y,
      occupiedCells: Object.freeze(point.occupiedCells.map((cell) => Object.freeze({
        tileX: cell.x,
        tileY: cell.y,
      }))),
    }),
  );

  return Object.freeze({
    seed: archipelago.seed,
    widthInTiles: archipelago.width,
    heightInTiles: archipelago.height,
    tileSize: TERRAIN_TILE_SIZE,
    landMask: Object.freeze([...archipelago.landMask]),
    pointsOfInterest: Object.freeze(pointsOfInterest),
  });
}

function getGeneratedIslandCount(archipelago: GeneratedArchipelago) {
  return new Set(archipelago.islandIds.filter((islandId) => islandId !== 0)).size;
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

function findDockingLandPoint(
  archipelago: GeneratedArchipelago,
  worldX: number,
  worldY: number,
  dockingRange: number,
): LandPointOfInterest | undefined {
  const dockingRangeSquared = dockingRange * dockingRange;
  let nearestPoint: LandPointOfInterest | undefined;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const point of archipelago.pointsOfInterest) {
    if (point.environment !== 'land') {
      continue;
    }
    const pointWorldX = (point.x + 0.5) * TERRAIN_TILE_SIZE;
    const pointWorldY = (point.y + 0.5) * TERRAIN_TILE_SIZE;
    const distanceSquared = (pointWorldX - worldX) ** 2 + (pointWorldY - worldY) ** 2;
    if (
      distanceSquared <= dockingRangeSquared
      && (
        distanceSquared < nearestDistanceSquared
        || (
          distanceSquared === nearestDistanceSquared
          && point.id < (nearestPoint?.id ?? '')
        )
      )
    ) {
      nearestPoint = point;
      nearestDistanceSquared = distanceSquared;
    }
  }

  return nearestPoint;
}

function findCrewDefeatRespawn(
  archipelago: GeneratedArchipelago,
  worldX: number,
  worldY: number,
  clearance: number,
): Readonly<{ x: number; y: number }> {
  const nearestLandPoint = archipelago.pointsOfInterest
    .filter((point): point is LandPointOfInterest => point.environment === 'land')
    .reduce<LandPointOfInterest | undefined>((nearestPoint, point) => {
      if (!nearestPoint) {
        return point;
      }
      const pointDistance = distanceSquaredToWorldPoint(point, worldX, worldY);
      const nearestDistance = distanceSquaredToWorldPoint(nearestPoint, worldX, worldY);
      return pointDistance < nearestDistance
        || (pointDistance === nearestDistance && point.id < nearestPoint.id)
        ? point
        : nearestPoint;
    }, undefined);

  if (!nearestLandPoint) {
    return findOpenWaterSpawn(archipelago, clearance);
  }

  let nearestWaterIndex = -1;
  let nearestWaterDistanceSquared = Number.POSITIVE_INFINITY;
  for (let y = clearance; y < archipelago.height - clearance; y += 1) {
    for (let x = clearance; x < archipelago.width - clearance; x += 1) {
      if (!hasWaterClearance(archipelago, x, y, clearance)) {
        continue;
      }
      const distanceSquared = (x - nearestLandPoint.x) ** 2 + (y - nearestLandPoint.y) ** 2;
      const cellIndex = y * archipelago.width + x;
      if (
        distanceSquared < nearestWaterDistanceSquared
        || (distanceSquared === nearestWaterDistanceSquared && cellIndex < nearestWaterIndex)
      ) {
        nearestWaterIndex = cellIndex;
        nearestWaterDistanceSquared = distanceSquared;
      }
    }
  }

  if (nearestWaterIndex < 0) {
    throw new Error('Generated archipelago has no safe crew-defeat respawn.');
  }

  return {
    x: (nearestWaterIndex % archipelago.width + 0.5) * TERRAIN_TILE_SIZE,
    y: (Math.floor(nearestWaterIndex / archipelago.width) + 0.5) * TERRAIN_TILE_SIZE,
  };
}

function distanceSquaredToWorldPoint(
  point: LandPointOfInterest,
  worldX: number,
  worldY: number,
) {
  const pointWorldX = (point.x + 0.5) * TERRAIN_TILE_SIZE;
  const pointWorldY = (point.y + 0.5) * TERRAIN_TILE_SIZE;
  return (pointWorldX - worldX) ** 2 + (pointWorldY - worldY) ** 2;
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
