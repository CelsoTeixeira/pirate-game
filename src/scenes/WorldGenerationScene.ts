import Phaser from 'phaser';
import {
  DEFAULT_HEIGHT_MAP_CONFIG,
  generateHeightMap,
  type HeightMap,
} from '../world/generation/heightMap';

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
const INITIAL_SEA_LEVEL = 0.38;
const MINIMUM_SEA_LEVEL = 0.2;
const MAXIMUM_SEA_LEVEL = 0.7;
const SEA_LEVEL_STEP = 0.02;

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
  raiseSeaLevel: Phaser.Input.Keyboard.Key;
  lowerSeaLevel: Phaser.Input.Keyboard.Key;
  returnToBuilder: Phaser.Input.Keyboard.Key;
}>;

export class WorldGenerationScene extends Phaser.Scene {
  private seed = INITIAL_SEED;
  private seaLevel = INITIAL_SEA_LEVEL;
  private heightMap?: HeightMap;
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
    this.add.text(RIGHT_PANEL_X + PANEL_SIZE / 2, 67, 'TERRAIN CLASSIFICATION', {
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

    this.add.text(736, 493, 'deep water / shallow water / sand / grass / rock', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '11px',
    }).setOrigin(0.5);
    this.add.text(
      480,
      512,
      '[R] new seed   [SPACE] regenerate same seed   [UP/DOWN] sea level +/- 0.02',
      {
        color: '#bae6fd',
        fontFamily: 'monospace',
        fontSize: '11px',
      },
    ).setOrigin(0.5);
    this.add.text(480, 529, '[ESC] return to ship builder', {
      color: '#7dd3fc',
      fontFamily: 'monospace',
      fontSize: '11px',
    }).setOrigin(0.5);

    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keys = {
        randomize: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
        regenerate: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        raiseSeaLevel: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        lowerSeaLevel: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
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

    if (Phaser.Input.Keyboard.JustDown(this.keys.raiseSeaLevel)) {
      this.adjustSeaLevel(SEA_LEVEL_STEP);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.lowerSeaLevel)) {
      this.adjustSeaLevel(-SEA_LEVEL_STEP);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.returnToBuilder)) {
      this.scene.start('ModularShipScene');
    }
  }

  private regenerateHeightMap() {
    this.heightMap = generateHeightMap(this.seed, DEFAULT_HEIGHT_MAP_CONFIG);
    this.renderPanels();
  }

  private adjustSeaLevel(amount: number) {
    const nextSeaLevel = Phaser.Math.Clamp(
      Math.round((this.seaLevel + amount) * 100) / 100,
      MINIMUM_SEA_LEVEL,
      MAXIMUM_SEA_LEVEL,
    );
    if (nextSeaLevel === this.seaLevel) {
      return;
    }

    this.seaLevel = nextSeaLevel;
    this.renderTerrainPanel();
    this.refreshStatus();
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
    this.heightMap.values.forEach((elevation, index) => {
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
    this.heightMap.values.forEach((elevation, index) => {
      const color = this.terrainPalette.get(getTerrainFrame(elevation, this.seaLevel));
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
    this.terrainTexture.refresh();
  }

  private refreshStatus() {
    this.statusText?.setText(
      `seed ${this.seed}  |  sea level threshold ${this.seaLevel.toFixed(2)}  |  ${
        DEFAULT_HEIGHT_MAP_CONFIG.width
      }x${DEFAULT_HEIGHT_MAP_CONFIG.height}`,
    );
  }

  private createPreviewTextures() {
    this.destroyPreviewTextures();

    const { width, height } = DEFAULT_HEIGHT_MAP_CONFIG;
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

function getTerrainFrame(elevation: number, seaLevel: number): TerrainFrame {
  if (elevation < seaLevel - 0.12) {
    return 0;
  }
  if (elevation < seaLevel) {
    return 1;
  }
  if (elevation < seaLevel + 0.08) {
    return 4;
  }
  if (elevation < seaLevel + 0.36) {
    return 7;
  }
  return 11;
}

function createRandomSeed(currentSeed: number): number {
  const candidate = Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
  return candidate === currentSeed ? (candidate + 1) >>> 0 : candidate;
}
