import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Phaser from 'phaser';
import { ArchipelagoScene } from './scenes/ArchipelagoScene';
import { GameScene } from './scenes/GameScene';
import { ModularShipScene } from './scenes/ModularShipScene';
import { WorldGenerationScene } from './scenes/WorldGenerationScene';
import { GameHudOverlay } from './ui/GameHudOverlay';
import './ui/gameHud.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  pixelArt: true,
  backgroundColor: '#082f49',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [ModularShipScene, WorldGenerationScene, ArchipelagoScene, GameScene],
};

const gameUiRoot = document.getElementById('game-ui');
if (!gameUiRoot) {
  throw new Error('Game UI root was not found.');
}

createRoot(gameUiRoot).render(
  <StrictMode>
    <GameHudOverlay />
  </StrictMode>,
);

const game = new Phaser.Game(config);

declare global {
  interface Window {
    game: Phaser.Game;
  }
}

window.game = game;
