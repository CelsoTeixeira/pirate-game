import Phaser from 'phaser';
import { CannonBall } from '../entities/CannonBall';
import { ModularShip, type ModularShipSailState, type ShipBuild } from '../entities/ModularShip';
import { Ship, type SailState, type ShipCannonDefinition } from '../entities/Ship';
import shipTypes from '../entities/ship-types.json';
import { playShipImpact } from '../effects/effects';
import { WindStreaks } from '../effects/windStreaks';
import { TargetReticle } from '../entities/TargetReticle';
import { KeyboardControls } from '../input/KeyboardControls';
import { WindCompass } from '../ui/WindCompass';
import { Wind } from '../world/Wind';

const CANNON_ARC_COLOR = 0xff4444;
const CANNON_ARC_DISABLED_COLOR = 0x888888;
const CANNON_ARC_FILL_ALPHA = 0.08;
const CANNON_ARC_DISABLED_FILL_ALPHA = 0.04;
const CANNON_ARC_STROKE_ALPHA = 0.25;
const CANNON_ARC_DISABLED_STROKE_ALPHA = 0.15;
const CANNON_ARC_STROKE_WIDTH = 1;
const CANNON_ARC_DEPTH = -10;
const DEBUG_WIND_ROTATION_STEP = Phaser.Math.DegToRad(15);
const DEBUG_WIND_STRENGTH_STEP = 0.1;
const SAIL_STATE_NAMES = ['furled', 'half', 'full'] as const;
const GAME_SHIP_SCALES: Record<ShipBuild['size'], number> = {
  small: 0.33,
  medium: 0.15,
  big: 0.12,
};
const GAME_SAIL_STATES: readonly ModularShipSailState[] = ['closed', 'partial', 'open'];
const WORLD_BLOCK_SIZE = 512;
const WORLD_BLOCK_COUNT = 3;
const WORLD_SIZE = WORLD_BLOCK_SIZE * WORLD_BLOCK_COUNT;
const PLAYER_START = WORLD_SIZE / 2;
const ENEMY_OFFSET_X = 240;
const ENEMY_OFFSET_Y = -70;
const CAMERA_FOLLOW_LERP = 0.1;

export class GameScene extends Phaser.Scene {
  private playerShip?: Ship;
  private playerShipVisual?: ModularShip;
  private build?: ShipBuild;
  private enemyShip?: Ship;
  private damageableShips: Ship[] = [];
  private controls?: KeyboardControls;
  private damageKey?: Phaser.Input.Keyboard.Key;
  private windRotateLeftKey?: Phaser.Input.Keyboard.Key;
  private windRotateRightKey?: Phaser.Input.Keyboard.Key;
  private windDecreaseKey?: Phaser.Input.Keyboard.Key;
  private windIncreaseKey?: Phaser.Input.Keyboard.Key;
  private targetReticle?: TargetReticle;
  private cannonArcGraphics?: Phaser.GameObjects.Graphics;
  private debugReadout?: Phaser.GameObjects.Text;
  private windStreaks?: WindStreaks;
  private windCompass?: WindCompass;
  private wind = new Wind(0, 0.7);
  private aimMode = false;

  constructor() {
    super('GameScene');
  }

  preload() {
    Ship.preload(this);
    ModularShip.preload(this);
    CannonBall.preload(this);
  }

  init(data: { build?: ShipBuild }) {
    if (!data.build) {
      throw new Error('GameScene requires a ship build from ModularShipScene.');
    }

    this.build = data.build;
  }

  create() {
    this.physics.world.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
    this.cameras.main
      .setBackgroundColor('#082f49')
      .setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);

    this.add.text(16, 16, 'pirate-game', {
      color: '#e0f2fe',
      fontFamily: 'monospace',
      fontSize: '18px',
    }).setScrollFactor(0);
    this.debugReadout = this.add.text(16, 40, '', {
      color: '#bae6fd',
      fontFamily: 'monospace',
      fontSize: '12px',
    }).setScrollFactor(0);
    this.windStreaks = new WindStreaks(this, this.wind);
    this.windCompass = new WindCompass(this);

    this.controls = new KeyboardControls(this);
    if (!this.build) {
      throw new Error('GameScene cannot create without a ship build.');
    }

    this.playerShip = new Ship(
      this,
      PLAYER_START,
      PLAYER_START,
      'pirate',
      this.createPlayerCannonDefinitions(this.build),
    );
    this.playerShip.sailState = this.toGameSailState(this.build.sailState);
    this.playerShip.setVisible(false);
    this.playerShipVisual = new ModularShip(this, this.playerShip.x, this.playerShip.y, this.build)
      .applyBuild(this.build)
      .setScale(GAME_SHIP_SCALES[this.build.size])
      .setBuildInteractionEnabled(false);
    this.enemyShip = new Ship(
      this,
      PLAYER_START + ENEMY_OFFSET_X,
      PLAYER_START + ENEMY_OFFSET_Y,
      'white',
    );
    this.enemyShip.anchored = true;
    this.damageableShips = [this.enemyShip];
    this.playerShip.on('cannonball-fired', this.handlePlayerCannonBallFired, this);
    this.targetReticle = new TargetReticle(this);
    this.cannonArcGraphics = this.add.graphics();
    this.cannonArcGraphics.setDepth(CANNON_ARC_DEPTH);
    this.cannonArcGraphics.setVisible(false);
    this.damageKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.windRotateLeftKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.OPEN_BRACKET);
    this.windRotateRightKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.CLOSED_BRACKET);
    this.windDecreaseKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS);
    this.windIncreaseKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.syncPlayerShipVisual();
    this.cameras.main.startFollow(
      this.playerShip,
      true,
      CAMERA_FOLLOW_LERP,
      CAMERA_FOLLOW_LERP,
    );
  }

  update(_time: number, delta: number) {
    if (!this.playerShip || !this.controls) {
      return;
    }

    this.updateDebugWindControls();
    this.windStreaks?.update();
    this.windCompass?.update(this.wind);

    if (this.controls.isSailUpJustPressed()) {
      this.playerShip.raiseSail();
    }

    if (this.controls.isSailDownJustPressed()) {
      this.playerShip.lowerSail();
    }

    if (this.controls.isAnchorTogglePressed()) {
      this.playerShip.toggleAnchor();
    }

    this.playerShip.sail(this.wind, this.controls.getRudder(), delta);
    this.syncPlayerShipVisual();
    this.enemyShip?.sail(this.wind, 0, delta);
    this.updateDebugReadout();

    if (this.controls.isAimTogglePressed()) {
      this.aimMode = !this.aimMode;
      this.targetReticle?.setVisible(this.aimMode);
      this.cannonArcGraphics?.setVisible(this.aimMode);

      if (!this.aimMode) {
        this.cannonArcGraphics?.clear();
      }
    }

    if (this.aimMode && this.targetReticle) {
      const pointer = this.input.activePointer;

      this.targetReticle.setPosition(pointer.worldX, pointer.worldY);
      this.targetReticle.setValid(this.playerShip.canFireNowAt(this.targetReticle.x, this.targetReticle.y));
      this.drawCannonArcs(this.playerShip);
    }

    if (this.damageKey && Phaser.Input.Keyboard.JustDown(this.damageKey)) {
      this.enemyShip?.takeDamage(25);
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    if (!this.aimMode || !this.playerShip || !this.targetReticle || this.playerShip.isDestroyed) {
      return;
    }

    if (!pointer.leftButtonDown()) {
      return;
    }

    const targetX = this.targetReticle.x;
    const targetY = this.targetReticle.y;

    this.playerShip.fireAt(targetX, targetY);
  }

  private handlePlayerCannonBallFired(ball: CannonBall) {
    for (const ship of this.damageableShips) {
      this.physics.add.overlap(ball, ship, (ballObject, shipObject) => {
        const cannonBall = ballObject as CannonBall;
        const damageableShip = shipObject as Ship;

        if (damageableShip === cannonBall.owner) {
          return;
        }

        cannonBall.markHit();
        playShipImpact(this, cannonBall.x, cannonBall.y);
        damageableShip.takeDamage(cannonBall.damage);
        cannonBall.destroy();
      });
    }
  }

  private drawCannonArcs(ship: Ship) {
    if (!this.cannonArcGraphics) {
      return;
    }

    this.cannonArcGraphics.clear();

    for (const arc of ship.cannonArcs) {
      const isReady = arc.state === 'ready';
      this.cannonArcGraphics.fillStyle(
        isReady ? CANNON_ARC_COLOR : CANNON_ARC_DISABLED_COLOR,
        isReady ? CANNON_ARC_FILL_ALPHA : CANNON_ARC_DISABLED_FILL_ALPHA,
      );
      this.cannonArcGraphics.slice(
        ship.x,
        ship.y,
        arc.range,
        arc.centerAngle - arc.halfAngle,
        arc.centerAngle + arc.halfAngle,
      );
      this.cannonArcGraphics.fillPath();
    }

    for (const arc of ship.cannonArcs) {
      const isReady = arc.state === 'ready';
      this.cannonArcGraphics.lineStyle(
        CANNON_ARC_STROKE_WIDTH,
        isReady ? CANNON_ARC_COLOR : CANNON_ARC_DISABLED_COLOR,
        isReady ? CANNON_ARC_STROKE_ALPHA : CANNON_ARC_DISABLED_STROKE_ALPHA,
      );
      this.cannonArcGraphics.slice(
        ship.x,
        ship.y,
        arc.range,
        arc.centerAngle - arc.halfAngle,
        arc.centerAngle + arc.halfAngle,
      );
      this.cannonArcGraphics.strokePath();
    }
  }

  private updateDebugWindControls() {
    if (this.windRotateLeftKey && Phaser.Input.Keyboard.JustDown(this.windRotateLeftKey)) {
      this.wind.rotate(-DEBUG_WIND_ROTATION_STEP);
    }

    if (this.windRotateRightKey && Phaser.Input.Keyboard.JustDown(this.windRotateRightKey)) {
      this.wind.rotate(DEBUG_WIND_ROTATION_STEP);
    }

    if (this.windDecreaseKey && Phaser.Input.Keyboard.JustDown(this.windDecreaseKey)) {
      this.wind.adjustStrength(-DEBUG_WIND_STRENGTH_STEP);
    }

    if (this.windIncreaseKey && Phaser.Input.Keyboard.JustDown(this.windIncreaseKey)) {
      this.wind.adjustStrength(DEBUG_WIND_STRENGTH_STEP);
    }
  }

  private createPlayerCannonDefinitions(build: ShipBuild): ShipCannonDefinition[] {
    const pirateCannon = shipTypes.pirate.cannons[0];

    return build.cannons.map((cannon) => ({
      ...pirateCannon,
      direction: Phaser.Math.RadToDeg(
        cannon.rotation + (cannon.x < 0 ? Math.PI : 0) - Math.PI / 2,
      ),
    }));
  }

  private toGameSailState(state: ModularShipSailState): SailState {
    return GAME_SAIL_STATES.indexOf(state) as SailState;
  }

  private syncPlayerShipVisual() {
    if (!this.playerShip || !this.playerShipVisual) {
      return;
    }

    this.playerShipVisual
      .setPosition(this.playerShip.x, this.playerShip.y)
      .setRotation(this.playerShip.rotation);
    const sailState = GAME_SAIL_STATES[this.playerShip.sailState];
    if (this.playerShipVisual.config.sailState !== sailState) {
      this.playerShipVisual.setSailState(sailState);
    }
  }

  private updateDebugReadout() {
    if (!this.debugReadout || !this.playerShip) {
      return;
    }

    const body = this.playerShip.body;
    const currentSpeed = body instanceof Phaser.Physics.Arcade.Body ? body.velocity.length() : 0;
    const windDirectionDeg = Math.round(Phaser.Math.RadToDeg(this.wind.directionRad));

    this.debugReadout.setText(
      `wind ${windDirectionDeg}deg strength ${this.wind.strength.toFixed(1)} | sail ${
        SAIL_STATE_NAMES[this.playerShip.sailState]
      } | anchored ${this.playerShip.anchored ? 'yes' : 'no'} | speed ${currentSpeed.toFixed(0)} px/s`,
    );
  }
}
