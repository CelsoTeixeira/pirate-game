import Phaser from 'phaser';
import type { ShipBuild } from '../entities/ModularShip';
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
import type { GeneratedWind } from '../world/generation/wind';

const TERRAIN_ATLAS_KEY = 'terrain-atlas-64';
const TERRAIN_ATLAS_PATH = 'assets/terrain/terrain-atlas-64.png';
const TILE_SOURCE_SIZE = 64;
const HEIGHT_MAP_TEXTURE_KEY = 'world-generation-height-map';
const TERRAIN_TEXTURE_KEY = 'world-generation-terrain';
const TERRAIN_FRAMES = [0, 1, 4, 7, 11] as const;
const PANEL_SIZE = 400;
const LEFT_PANEL_X = 24;
const RIGHT_PANEL_X = 536;
const PANEL_Y = 82;
const INITIAL_SEED = 0x51a7d;

type LandPointOfInterest = Extract<GeneratedPointOfInterest, { environment: 'land' }>;
type WaterPointOfInterest = Extract<GeneratedPointOfInterest, { environment: 'water' }>;
type PointOfInterestKind = GeneratedPointOfInterest['kind'];

const POI_MARKER_SIZES: Readonly<Record<PoiSize, number>> = {
  small: 3,
  medium: 5,
  big: 7,
};

const POI_KIND_COLORS: Readonly<Record<PointOfInterestKind, number>> = {
  city: 0x22d3ee,
  'trading-post': 0xfbbf24,
  fortress: 0xe2e8f0,
  'pirate-hub': 0xfb7185,
  'merchant-ship': 0x4ade80,
  'navy-patrol': 0x60a5fa,
  'pirate-ship': 0xfb923c,
  kraken: 0xc084fc,
  'ghost-ship': 0xa5f3fc,
  'siren-waters': 0xf472b6,
};
const SETTLEMENT_MODULE_COLORS: Readonly<Record<SettlementModuleKind, number>> = {
  house: 0xf8fafc,
  market: 0xfacc15,
  tower: 0xcbd5e1,
  'fortress-keep': 0xe2e8f0,
  'pirate-hideout': 0xfb7185,
  dock: 0x67e8f9,
  warehouse: 0xf59e0b,
};
const NATURAL_FEATURE_COLORS: Readonly<Record<NaturalFeatureKind, number>> = {
  'tree-cluster': 0x166534,
  'palm-cluster': 0x65a30d,
  mountain: 0x64748b,
  'rock-cluster': 0x78716c,
  ruins: 0xa78bfa,
  'treasure-shrine': 0xfbbf24,
};

const LAND_POI_LEGEND: ReadonlyArray<Readonly<{
  kind: LandPointOfInterest['kind'];
  label: string;
}>> = [
  { kind: 'city', label: 'city' },
  { kind: 'trading-post', label: 'trading post' },
  { kind: 'fortress', label: 'fortress' },
  { kind: 'pirate-hub', label: 'pirate hub' },
];

const WATER_POI_LEGEND: ReadonlyArray<Readonly<{
  kind: WaterPointOfInterest['kind'];
  label: string;
}>> = [
  { kind: 'merchant-ship', label: 'merchant ship' },
  { kind: 'navy-patrol', label: 'navy patrol' },
  { kind: 'pirate-ship', label: 'pirate ship' },
  { kind: 'kraken', label: 'kraken' },
  { kind: 'ghost-ship', label: 'ghost ship' },
  { kind: 'siren-waters', label: 'siren waters' },
];

type RgbColor = Readonly<{
  red: number;
  green: number;
  blue: number;
}>;

type TerrainFrame = typeof TERRAIN_FRAMES[number];
type TerrainPalette = ReadonlyMap<TerrainFrame, RgbColor>;

// Used only if browser security prevents reading pixels from the same-origin atlas.
// These values are matched to the approved first-pass terrain art.
const FALLBACK_TERRAIN_PALETTE: TerrainPalette = new Map([
  [0, { red: 20, green: 80, blue: 108 }],
  [1, { red: 47, green: 132, blue: 151 }],
  [4, { red: 197, green: 164, blue: 103 }],
  [7, { red: 74, green: 111, blue: 62 }],
  [11, { red: 104, green: 101, blue: 91 }],
]);

type GenerationKeys = Readonly<{
  randomize: Phaser.Input.Keyboard.Key;
  regenerate: Phaser.Input.Keyboard.Key;
  launchWorld: Phaser.Input.Keyboard.Key;
  returnToBuilder: Phaser.Input.Keyboard.Key;
}>;

export class WorldGenerationScene extends Phaser.Scene {
  private seed = INITIAL_SEED;
  private build?: ShipBuild;
  private heightMap?: GeneratedArchipelago;
  private heightMapTexture?: Phaser.Textures.CanvasTexture;
  private terrainTexture?: Phaser.Textures.CanvasTexture;
  private heightMapPreview?: Phaser.GameObjects.Image;
  private terrainPreview?: Phaser.GameObjects.Image;
  private terrainPalette: TerrainPalette = FALLBACK_TERRAIN_PALETTE;
  private statusText?: Phaser.GameObjects.Text;
  private keys?: GenerationKeys;

  constructor() {
    super('WorldGenerationScene');
  }

  init(data: { seed?: number; build?: ShipBuild }) {
    this.build = data.build;
    if (data.seed !== undefined) this.seed = data.seed >>> 0;
  }

  preload() {
    if (!this.textures.exists(TERRAIN_ATLAS_KEY)) {
      this.load.spritesheet(TERRAIN_ATLAS_KEY, TERRAIN_ATLAS_PATH, {
        frameWidth: TILE_SOURCE_SIZE,
        frameHeight: TILE_SOURCE_SIZE,
      });
    }
  }

  create() {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroyPreviewTextures, this);
    this.cameras.main.setBackgroundColor('#071b28').setZoom(1).setScroll(0, 0);
    this.add.text(24, 10, 'WORLD GENERATION LAB', {
      color: '#e0f2fe',
      fontFamily: 'monospace',
      fontSize: '22px',
      fontStyle: 'bold',
    });
    this.statusText = this.add.text(24, 39, '', {
      color: '#7dd3fc',
      fontFamily: 'monospace',
      fontSize: '13px',
    });

    this.add.text(LEFT_PANEL_X + PANEL_SIZE / 2, 67, 'HEIGHT MAP (SCALAR ELEVATION)', {
      color: '#e0f2fe',
      fontFamily: 'monospace',
      fontSize: '13px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(RIGHT_PANEL_X + PANEL_SIZE / 2, 67, 'TERRAIN + POINTS OF INTEREST', {
      color: '#e0f2fe',
      fontFamily: 'monospace',
      fontSize: '13px',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.rectangle(
      LEFT_PANEL_X + PANEL_SIZE / 2,
      PANEL_Y + PANEL_SIZE / 2,
      PANEL_SIZE + 4,
      PANEL_SIZE + 4,
      0x020617,
      1,
    ).setStrokeStyle(2, 0x38bdf8, 0.55);
    this.add.rectangle(
      RIGHT_PANEL_X + PANEL_SIZE / 2,
      PANEL_Y + PANEL_SIZE / 2,
      PANEL_SIZE + 4,
      PANEL_SIZE + 4,
      0x020617,
      1,
    ).setStrokeStyle(2, 0x38bdf8, 0.55);

    this.createPreviewTextures();
    this.terrainPalette = this.createTerrainPalette();

    this.createPointOfInterestLegend();
    this.add.text(
      480,
      531,
      '[R] new seed   [SPACE] regenerate   [ENTER] navigate world   [ESC] ship builder',
      {
        color: '#7dd3fc',
        fontFamily: 'monospace',
        fontSize: '11px',
      },
    ).setOrigin(0.5);

    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keys = {
        randomize: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
        regenerate: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        launchWorld: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
        returnToBuilder: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      };
    }

    this.regenerateHeightMap();
  }

  update() {
    if (!this.keys) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.randomize)) {
      this.seed = createRandomSeed(this.seed);
      this.regenerateHeightMap();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.regenerate)) {
      this.regenerateHeightMap();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.launchWorld) && this.build) {
      this.scene.start('GameScene', { seed: this.seed, build: this.build });
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.returnToBuilder)) {
      this.scene.start('ModularShipScene', { build: this.build });
    }
  }

  private regenerateHeightMap() {
    this.heightMap = generateArchipelago(this.seed, DEFAULT_ARCHIPELAGO_CONFIG);
    this.renderPanels();
  }

  private renderPanels() {
    this.renderHeightMapPanel();
    this.renderTerrainPanel();
    this.refreshStatus();
  }

  private renderHeightMapPanel() {
    if (!this.heightMap || !this.heightMapTexture) {
      return;
    }

    const imageData = this.heightMapTexture.context.createImageData(
      this.heightMap.width,
      this.heightMap.height,
    );
    this.heightMap.elevations.forEach((elevation, index) => {
      const channel = Math.round(elevation * 255);
      const offset = index * 4;
      imageData.data[offset] = channel;
      imageData.data[offset + 1] = channel;
      imageData.data[offset + 2] = channel;
      imageData.data[offset + 3] = 255;
    });
    this.heightMapTexture.context.putImageData(imageData, 0, 0);
    this.heightMapTexture.refresh();
  }

  private renderTerrainPanel() {
    if (!this.heightMap || !this.terrainTexture) {
      return;
    }

    const imageData = this.terrainTexture.context.createImageData(
      this.heightMap.width,
      this.heightMap.height,
    );
    this.heightMap.elevations.forEach((elevation, index) => {
      const color = this.terrainPalette.get(getTerrainFrame(
        elevation,
        this.heightMap?.landMask[index] === true,
      ));
      if (!color) {
        throw new Error('Terrain overview palette is missing a classification color.');
      }

      const offset = index * 4;
      imageData.data[offset] = color.red;
      imageData.data[offset + 1] = color.green;
      imageData.data[offset + 2] = color.blue;
      imageData.data[offset + 3] = 255;
    });
    this.terrainTexture.context.putImageData(imageData, 0, 0);
    this.drawNaturalFeatureMarkers(
      this.terrainTexture.context,
      this.heightMap.naturalFeatures,
    );
    this.drawWindLoops(this.terrainTexture.context, this.heightMap.wind);
    this.drawSettlementModuleMarkers(
      this.terrainTexture.context,
      this.heightMap.settlementModules,
    );
    this.drawPointOfInterestMarkers(
      this.terrainTexture.context,
      this.heightMap.pointsOfInterest,
    );
    this.terrainTexture.refresh();
  }

  private refreshStatus() {
    const islandCount = this.heightMap
      ? new Set(this.heightMap.islandIds.filter((islandId) => islandId !== 0)).size
      : 0;
    const landPointCount = this.heightMap?.pointsOfInterest
      .filter((point) => point.environment === 'land')
      .length ?? 0;
    const waterPointCount = this.heightMap?.pointsOfInterest.length
      ? this.heightMap.pointsOfInterest.length - landPointCount
      : 0;
    this.statusText?.setText(
      `seed ${this.seed}  |  islands ${islandCount}  |  land ${landPointCount}  |  water ${waterPointCount}`
        + `  |  modules ${this.heightMap?.settlementModules.length ?? 0}`
        + `  |  natural ${this.heightMap?.naturalFeatures.length ?? 0}`
        + `  |  wind loops ${this.heightMap?.wind.loops.length ?? 0}`
        + `  |  ${DEFAULT_ARCHIPELAGO_CONFIG.width}x${DEFAULT_ARCHIPELAGO_CONFIG.height}`,
    );
  }

  private drawWindLoops(context: CanvasRenderingContext2D, wind: GeneratedWind) {
    context.save();
    context.strokeStyle = '#fef08a';
    context.fillStyle = '#fef08a';
    context.lineWidth = 1.5;
    context.setLineDash([3, 2]);

    wind.loops.forEach((loop) => {
      if (loop.points.length < 2) {
        return;
      }
      context.beginPath();
      loop.points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.closePath();
      context.stroke();
      loop.points.forEach((point) => {
        context.beginPath();
        context.arc(point.x, point.y, 2, 0, Math.PI * 2);
        context.fill();
      });
    });

    context.restore();
  }

  private drawPointOfInterestMarkers(
    context: CanvasRenderingContext2D,
    pointsOfInterest: ReadonlyArray<GeneratedPointOfInterest>,
  ) {
    context.save();
    context.lineWidth = 1;
    context.strokeStyle = '#020617';

    pointsOfInterest.forEach((point) => {
      const markerSize = POI_MARKER_SIZES[point.size];
      const markerRadius = markerSize / 2;
      const color = POI_KIND_COLORS[point.kind];
      context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;

      if (point.environment === 'land') {
        context.globalAlpha = 0.34;
        point.occupiedCells.forEach((cell) => context.fillRect(cell.x, cell.y, 1, 1));
        context.globalAlpha = 1;
        context.strokeRect(
          point.x - Math.floor(markerSize / 2) + 0.5,
          point.y - Math.floor(markerSize / 2) + 0.5,
          markerSize - 1,
          markerSize - 1,
        );
        return;
      }

      context.globalAlpha = 0.2;
      point.occupiedCells.forEach((cell) => context.fillRect(cell.x, cell.y, 1, 1));
      context.globalAlpha = 1;
      context.beginPath();
      context.arc(point.x + 0.5, point.y + 0.5, markerRadius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    });

    context.restore();
  }

  private drawNaturalFeatureMarkers(
    context: CanvasRenderingContext2D,
    features: ReadonlyArray<GeneratedNaturalFeature>,
  ) {
    context.save();
    context.globalAlpha = 0.75;
    features.forEach((feature) => {
      context.fillStyle = `#${NATURAL_FEATURE_COLORS[feature.kind].toString(16).padStart(6, '0')}`;
      feature.occupiedCells.forEach((cell) => context.fillRect(cell.x, cell.y, 1, 1));
    });
    context.restore();
  }

  private drawSettlementModuleMarkers(
    context: CanvasRenderingContext2D,
    modules: ReadonlyArray<GeneratedSettlementModule>,
  ) {
    context.save();
    modules.forEach((module) => {
      context.fillStyle = `#${SETTLEMENT_MODULE_COLORS[module.kind].toString(16).padStart(6, '0')}`;
      module.occupiedCells.forEach((cell) => context.fillRect(cell.x, cell.y, 1, 1));
      context.strokeStyle = '#020617';
      context.strokeRect(module.x + 0.1, module.y + 0.1, 0.8, 0.8);
    });
    context.restore();
  }

  private createPointOfInterestLegend() {
    this.add.text(736, 487, 'deep / shallow / sand / grass / rock', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '8px',
    }).setOrigin(0.5);

    this.add.text(24, 499, 'FOOTPRINTS tinted; modules/features overlay cells', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '9px',
    }).setOrigin(0, 0.5);
    this.addPointOfInterestLegendItems(270, 499, LAND_POI_LEGEND, 'land');

    this.add.text(24, 514, 'WATER circle', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '9px',
    }).setOrigin(0, 0.5);
    this.addPointOfInterestLegendItems(108, 514, WATER_POI_LEGEND, 'water');
  }

  private addPointOfInterestLegendItems(
    startX: number,
    y: number,
    items: ReadonlyArray<Readonly<{ kind: PointOfInterestKind; label: string }>>,
    environment: GeneratedPointOfInterest['environment'],
  ) {
    let x = startX;

    items.forEach(({ kind, label }) => {
      if (environment === 'land') {
        this.add.rectangle(x + 4, y, 8, 8, POI_KIND_COLORS[kind])
          .setStrokeStyle(1, 0x020617);
      } else {
        this.add.circle(x + 4, y, 4, POI_KIND_COLORS[kind])
          .setStrokeStyle(1, 0x020617);
      }

      this.add.text(x + 11, y, label, {
        color: '#e0f2fe',
        fontFamily: 'monospace',
        fontSize: '9px',
      }).setOrigin(0, 0.5);
      x += 23 + label.length * 6;
    });
  }

  private createPreviewTextures() {
    this.destroyPreviewTextures();

    const { width, height } = DEFAULT_ARCHIPELAGO_CONFIG;
    const heightMapTexture = this.textures.createCanvas(HEIGHT_MAP_TEXTURE_KEY, width, height);
    const terrainTexture = this.textures.createCanvas(TERRAIN_TEXTURE_KEY, width, height);
    if (!heightMapTexture || !terrainTexture) {
      throw new Error('Unable to allocate world generation preview textures.');
    }

    heightMapTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    terrainTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.heightMapTexture = heightMapTexture;
    this.terrainTexture = terrainTexture;
    this.heightMapPreview = this.add.image(
      LEFT_PANEL_X,
      PANEL_Y,
      HEIGHT_MAP_TEXTURE_KEY,
    ).setOrigin(0).setDisplaySize(PANEL_SIZE, PANEL_SIZE);
    this.terrainPreview = this.add.image(
      RIGHT_PANEL_X,
      PANEL_Y,
      TERRAIN_TEXTURE_KEY,
    ).setOrigin(0).setDisplaySize(PANEL_SIZE, PANEL_SIZE);
  }

  private createTerrainPalette(): TerrainPalette {
    try {
      return new Map(TERRAIN_FRAMES.map((frame) => [
        frame,
        this.sampleAverageFrameColor(frame),
      ]));
    } catch (error) {
      console.warn('Using the terrain overview fallback palette.', error);
      return FALLBACK_TERRAIN_PALETTE;
    }
  }

  private sampleAverageFrameColor(frameIndex: TerrainFrame): RgbColor {
    const frame = this.textures.getFrame(TERRAIN_ATLAS_KEY, frameIndex);
    if (!frame) {
      throw new Error(`Terrain atlas frame ${frameIndex} is unavailable.`);
    }

    const canvas = document.createElement('canvas');
    canvas.width = frame.cutWidth;
    canvas.height = frame.cutHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Unable to create a canvas context for terrain palette sampling.');
    }

    context.drawImage(
      frame.source.image as CanvasImageSource,
      frame.cutX,
      frame.cutY,
      frame.cutWidth,
      frame.cutHeight,
      0,
      0,
      frame.cutWidth,
      frame.cutHeight,
    );
    const pixels = context.getImageData(0, 0, frame.cutWidth, frame.cutHeight).data;
    let totalRed = 0;
    let totalGreen = 0;
    let totalBlue = 0;
    let totalAlpha = 0;

    for (let offset = 0; offset < pixels.length; offset += 4) {
      const alpha = pixels[offset + 3] / 255;
      totalRed += pixels[offset] * alpha;
      totalGreen += pixels[offset + 1] * alpha;
      totalBlue += pixels[offset + 2] * alpha;
      totalAlpha += alpha;
    }

    if (totalAlpha === 0) {
      throw new Error(`Terrain atlas frame ${frameIndex} contains no visible pixels.`);
    }

    return {
      red: Math.round(totalRed / totalAlpha),
      green: Math.round(totalGreen / totalAlpha),
      blue: Math.round(totalBlue / totalAlpha),
    };
  }

  private destroyPreviewTextures() {
    this.heightMapPreview?.destroy();
    this.terrainPreview?.destroy();
    this.heightMapPreview = undefined;
    this.terrainPreview = undefined;
    this.heightMapTexture = undefined;
    this.terrainTexture = undefined;

    if (this.textures.exists(HEIGHT_MAP_TEXTURE_KEY)) {
      this.textures.remove(HEIGHT_MAP_TEXTURE_KEY);
    }
    if (this.textures.exists(TERRAIN_TEXTURE_KEY)) {
      this.textures.remove(TERRAIN_TEXTURE_KEY);
    }
  }
}

function getTerrainFrame(elevation: number, isLand: boolean): TerrainFrame {
  if (!isLand) return elevation < 0.26 ? 0 : 1;
  if (elevation < 0.48) return 4;
  if (elevation < 0.72) return 7;
  return 11;
}

function createRandomSeed(currentSeed: number): number {
  const candidate = Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
  return candidate === currentSeed ? (candidate + 1) >>> 0 : candidate;
}
