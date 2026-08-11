import Phaser from 'phaser';
import { BLOB_NEIGHBOR, VALID_BLOB_MASKS } from './blobAutotile';

export const BLOB_TERRAIN_TEXTURE_KEY = 'runtime-blob-terrain-atlas';
export const TERRAIN_TILE_SIZE = 64;

const ATLAS_COLUMNS = 8;
const ATLAS_ROWS = 6;
const WATER_FRAME = 1;
const SAND_FRAME = 4;
const GRASS_FRAME = 7;

export function createBlobTerrainAtlas(
  scene: Phaser.Scene,
  materialTextureKey: string,
): Phaser.Textures.CanvasTexture {
  if (scene.textures.exists(BLOB_TERRAIN_TEXTURE_KEY)) {
    scene.textures.remove(BLOB_TERRAIN_TEXTURE_KEY);
  }

  const texture = scene.textures.createCanvas(
    BLOB_TERRAIN_TEXTURE_KEY,
    ATLAS_COLUMNS * TERRAIN_TILE_SIZE,
    ATLAS_ROWS * TERRAIN_TILE_SIZE,
  );
  if (!texture) {
    throw new Error('Unable to allocate the runtime blob terrain atlas.');
  }

  const water = copyMaterialFrame(scene, materialTextureKey, WATER_FRAME);
  const sand = copyMaterialFrame(scene, materialTextureKey, SAND_FRAME);
  const grass = copyMaterialFrame(scene, materialTextureKey, GRASS_FRAME);
  texture.context.imageSmoothingEnabled = false;

  VALID_BLOB_MASKS.forEach((mask, frameIndex) => {
    const frameX = (frameIndex % ATLAS_COLUMNS) * TERRAIN_TILE_SIZE;
    const frameY = Math.floor(frameIndex / ATLAS_COLUMNS) * TERRAIN_TILE_SIZE;
    texture.context.drawImage(water, frameX, frameY);
    drawClippedMaterial(texture.context, sand, createLandPath(mask, 5, 13, 14), frameX, frameY);
    drawClippedMaterial(texture.context, grass, createLandPath(mask, 13, 19, 11), frameX, frameY);
    texture.add(String(frameIndex), 0, frameX, frameY, TERRAIN_TILE_SIZE, TERRAIN_TILE_SIZE);
  });

  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  texture.refresh();
  return texture;
}

function copyMaterialFrame(
  scene: Phaser.Scene,
  textureKey: string,
  frameIndex: number,
): HTMLCanvasElement {
  const frame = scene.textures.getFrame(textureKey, frameIndex);
  if (!frame) {
    throw new Error(`Terrain material frame ${frameIndex} is unavailable.`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = TERRAIN_TILE_SIZE;
  canvas.height = TERRAIN_TILE_SIZE;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create a canvas context for terrain material sampling.');
  }
  context.imageSmoothingEnabled = false;
  context.drawImage(
    frame.source.image as CanvasImageSource,
    frame.cutX,
    frame.cutY,
    frame.cutWidth,
    frame.cutHeight,
    0,
    0,
    TERRAIN_TILE_SIZE,
    TERRAIN_TILE_SIZE,
  );
  return canvas;
}

function drawClippedMaterial(
  context: CanvasRenderingContext2D,
  material: HTMLCanvasElement,
  path: Path2D,
  x: number,
  y: number,
) {
  context.save();
  context.translate(x, y);
  context.clip(path);
  context.drawImage(material, 0, 0);
  context.restore();
}

function createLandPath(mask: number, inset: number, armInset: number, radius: number): Path2D {
  const path = new Path2D();
  const size = TERRAIN_TILE_SIZE;
  const centerSize = size - inset * 2;
  addRoundedRectangle(path, inset, inset, centerSize, centerSize, radius);

  if (mask & BLOB_NEIGHBOR.north) path.rect(armInset, 0, size - armInset * 2, size / 2);
  if (mask & BLOB_NEIGHBOR.east) path.rect(size / 2, armInset, size / 2, size - armInset * 2);
  if (mask & BLOB_NEIGHBOR.south) path.rect(armInset, size / 2, size - armInset * 2, size / 2);
  if (mask & BLOB_NEIGHBOR.west) path.rect(0, armInset, size / 2, size - armInset * 2);

  if (mask & BLOB_NEIGHBOR.northEast) path.rect(size / 2, 0, size / 2, size / 2);
  if (mask & BLOB_NEIGHBOR.southEast) path.rect(size / 2, size / 2, size / 2, size / 2);
  if (mask & BLOB_NEIGHBOR.southWest) path.rect(0, size / 2, size / 2, size / 2);
  if (mask & BLOB_NEIGHBOR.northWest) path.rect(0, 0, size / 2, size / 2);

  return path;
}

function addRoundedRectangle(
  path: Path2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const right = x + width;
  const bottom = y + height;
  path.moveTo(x + radius, y);
  path.lineTo(right - radius, y);
  path.quadraticCurveTo(right, y, right, y + radius);
  path.lineTo(right, bottom - radius);
  path.quadraticCurveTo(right, bottom, right - radius, bottom);
  path.lineTo(x + radius, bottom);
  path.quadraticCurveTo(x, bottom, x, bottom - radius);
  path.lineTo(x, y + radius);
  path.quadraticCurveTo(x, y, x + radius, y);
  path.closePath();
}
