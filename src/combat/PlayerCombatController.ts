import Phaser from 'phaser';
import { CannonBall } from '../entities/CannonBall';
import { Ship } from '../entities/Ship';
import { playShipImpact } from '../effects/effects';
import { TargetReticle } from '../entities/TargetReticle';

const CANNON_ARC_COLOR = 0xff4444;
const CANNON_ARC_DISABLED_COLOR = 0x888888;
const CANNON_ARC_FILL_ALPHA = 0.08;
const CANNON_ARC_DISABLED_FILL_ALPHA = 0.04;
const CANNON_ARC_STROKE_ALPHA = 0.25;
const CANNON_ARC_DISABLED_STROKE_ALPHA = 0.15;
const CANNON_ARC_STROKE_WIDTH = 1;
const CANNON_ARC_DEPTH = -10;

/** Composes player aim input, firing, projectile handling, and optional ship targets. */
export class PlayerCombatController {
  private readonly targetReticle: TargetReticle;
  private readonly cannonArcGraphics: Phaser.GameObjects.Graphics;
  private readonly aimToggleKey?: Phaser.Input.Keyboard.Key;
  private damageableShips: Ship[];
  private aimMode = false;
  private enabled = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly playerShip: Ship,
    damageableShips: readonly Ship[] = [],
  ) {
    this.damageableShips = [...damageableShips];
    this.aimToggleKey = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.targetReticle = new TargetReticle(scene);
    this.cannonArcGraphics = scene.add.graphics()
      .setDepth(CANNON_ARC_DEPTH)
      .setVisible(false);

    this.scene.input.on('pointerdown', this.handlePointerDown, this);
    this.playerShip.on('cannonball-fired', this.handleCannonBallFired, this);
  }

  setDamageableShips(damageableShips: readonly Ship[]) {
    this.damageableShips = [...damageableShips];
  }

  update(enabled = true) {
    this.setEnabled(enabled);
    if (!this.enabled) {
      return;
    }

    if (this.aimToggleKey && Phaser.Input.Keyboard.JustDown(this.aimToggleKey)) {
      this.aimMode = !this.aimMode;
      this.targetReticle.setVisible(this.aimMode);
      this.cannonArcGraphics.setVisible(this.aimMode);

      if (!this.aimMode) {
        this.cannonArcGraphics.clear();
      }
    }

    if (this.aimMode) {
      const pointer = this.scene.input.activePointer;
      this.targetReticle.setPosition(pointer.worldX, pointer.worldY);
      this.targetReticle.setValid(
        this.playerShip.canFireNowAt(this.targetReticle.x, this.targetReticle.y),
      );
      this.drawCannonArcs();
    }
  }

  destroy() {
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.playerShip.off('cannonball-fired', this.handleCannonBallFired, this);
    this.targetReticle.destroy();
    this.cannonArcGraphics.destroy();
    this.aimToggleKey?.reset();
    this.damageableShips = [];
    this.aimMode = false;
    this.enabled = false;
  }

  private setEnabled(enabled: boolean) {
    if (this.enabled === enabled) {
      return;
    }

    this.enabled = enabled;
    if (!enabled) {
      this.aimMode = false;
      this.targetReticle.setVisible(false);
      this.cannonArcGraphics.setVisible(false).clear();
      this.aimToggleKey?.reset();
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    if (
      !this.enabled
      || !this.aimMode
      || this.playerShip.isDestroyed
      || !pointer.leftButtonDown()
    ) {
      return;
    }

    this.playerShip.fireAt(this.targetReticle.x, this.targetReticle.y);
  }

  private handleCannonBallFired(ball: CannonBall) {
    for (const ship of this.damageableShips) {
      this.scene.physics.add.overlap(ball, ship, (ballObject, shipObject) => {
        const cannonBall = ballObject as CannonBall;
        const damageableShip = shipObject as Ship;

        if (damageableShip === cannonBall.owner || !cannonBall.active) {
          return;
        }

        cannonBall.markHit();
        playShipImpact(this.scene, cannonBall.x, cannonBall.y);
        damageableShip.takeDamage(cannonBall.damage);
        cannonBall.destroy();
      });
    }
  }

  private drawCannonArcs() {
    this.cannonArcGraphics.clear();

    for (const arc of this.playerShip.cannonArcs) {
      const isReady = arc.state === 'ready';
      this.cannonArcGraphics.fillStyle(
        isReady ? CANNON_ARC_COLOR : CANNON_ARC_DISABLED_COLOR,
        isReady ? CANNON_ARC_FILL_ALPHA : CANNON_ARC_DISABLED_FILL_ALPHA,
      );
      this.cannonArcGraphics.slice(
        this.playerShip.x,
        this.playerShip.y,
        arc.range,
        arc.centerAngle - arc.halfAngle,
        arc.centerAngle + arc.halfAngle,
      );
      this.cannonArcGraphics.fillPath();
    }

    for (const arc of this.playerShip.cannonArcs) {
      const isReady = arc.state === 'ready';
      this.cannonArcGraphics.lineStyle(
        CANNON_ARC_STROKE_WIDTH,
        isReady ? CANNON_ARC_COLOR : CANNON_ARC_DISABLED_COLOR,
        isReady ? CANNON_ARC_STROKE_ALPHA : CANNON_ARC_DISABLED_STROKE_ALPHA,
      );
      this.cannonArcGraphics.slice(
        this.playerShip.x,
        this.playerShip.y,
        arc.range,
        arc.centerAngle - arc.halfAngle,
        arc.centerAngle + arc.halfAngle,
      );
      this.cannonArcGraphics.strokePath();
    }
  }
}
