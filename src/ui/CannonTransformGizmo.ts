import Phaser from 'phaser';
import { ModularShip } from '../entities/ModularShip';

type AxisDragSnapshot = {
  cannonX: number;
  cannonY: number;
  grabOffsetX: number;
  grabOffsetY: number;
};

const AXIS_LENGTH = 54;
const ROTATION_RADIUS = 42;
const AXIS_HIT_WIDTH = 18;
const KNOB_RADIUS = 7;
const DELETE_X = -52;
const DELETE_Y = 52;

export class CannonTransformGizmo {
  private readonly container: Phaser.GameObjects.Container;
  private readonly rotationKnob: Phaser.GameObjects.Arc;
  private ship?: ModularShip;
  private cannon?: Phaser.GameObjects.Image;
  private axisDrag?: AxisDragSnapshot;
  private previousPointerAngle?: number;

  constructor(
    scene: Phaser.Scene,
    private readonly onRemove: (cannon: Phaser.GameObjects.Image) => void,
  ) {
    this.container = new Phaser.GameObjects.Container(scene, 0, 0).setDepth(1000).setVisible(false);

    const artwork = new Phaser.GameObjects.Graphics(scene);
    artwork.lineStyle(2, 0xf43f5e, 1);
    artwork.lineBetween(0, 0, AXIS_LENGTH, 0);
    artwork.fillStyle(0xf43f5e, 1);
    artwork.fillTriangle(AXIS_LENGTH + 7, 0, AXIS_LENGTH - 2, -6, AXIS_LENGTH - 2, 6);

    artwork.lineStyle(2, 0x22c55e, 1);
    artwork.lineBetween(0, 0, 0, -AXIS_LENGTH);
    artwork.fillStyle(0x22c55e, 1);
    artwork.fillTriangle(0, -AXIS_LENGTH - 7, -6, -AXIS_LENGTH + 2, 6, -AXIS_LENGTH + 2);

    artwork.lineStyle(2, 0xfacc15, 0.95);
    artwork.strokeCircle(0, 0, ROTATION_RADIUS);
    artwork.fillStyle(0xe2e8f0, 0.95);
    artwork.fillCircle(0, 0, 4);

    const xHitTarget = new Phaser.GameObjects.Rectangle(
      scene,
      AXIS_LENGTH / 2,
      0,
      AXIS_LENGTH + 20,
      AXIS_HIT_WIDTH,
      0xf43f5e,
      0.001,
    ).setInteractive({ useHandCursor: true });
    const yHitTarget = new Phaser.GameObjects.Rectangle(
      scene,
      0,
      -AXIS_LENGTH / 2,
      AXIS_HIT_WIDTH,
      AXIS_LENGTH + 20,
      0x22c55e,
      0.001,
    ).setInteractive({ useHandCursor: true });

    this.rotationKnob = new Phaser.GameObjects.Arc(
      scene,
      ROTATION_RADIUS,
      0,
      KNOB_RADIUS,
      0,
      360,
      false,
      0xfacc15,
      1,
    )
      .setStrokeStyle(2, 0xfef9c3, 1)
      .setInteractive({
        hitArea: new Phaser.Geom.Circle(KNOB_RADIUS, KNOB_RADIUS, KNOB_RADIUS + 6),
        hitAreaCallback: Phaser.Geom.Circle.Contains,
        useHandCursor: true,
      });

    const deleteHandle = new Phaser.GameObjects.Arc(
      scene,
      DELETE_X,
      DELETE_Y,
      10,
      0,
      360,
      false,
      0xb91c1c,
      1,
    )
      .setStrokeStyle(2, 0xfca5a5, 1)
      .setInteractive({
        hitArea: new Phaser.Geom.Circle(10, 10, 15),
        hitAreaCallback: Phaser.Geom.Circle.Contains,
        useHandCursor: true,
      });
    const deleteArtwork = new Phaser.GameObjects.Graphics(scene);
    deleteArtwork.lineStyle(2, 0xffffff, 1);
    deleteArtwork.lineBetween(DELETE_X - 4, DELETE_Y - 4, DELETE_X + 4, DELETE_Y + 4);
    deleteArtwork.lineBetween(DELETE_X + 4, DELETE_Y - 4, DELETE_X - 4, DELETE_Y + 4);

    this.container.add([
      artwork,
      xHitTarget,
      yHitTarget,
      this.rotationKnob,
      deleteHandle,
      deleteArtwork,
    ]);
    scene.add.existing(this.container);

    scene.input.setDraggable(xHitTarget);
    scene.input.setDraggable(yHitTarget);
    scene.input.setDraggable(this.rotationKnob);

    this.configureAxisDrag(xHitTarget, 'x');
    this.configureAxisDrag(yHitTarget, 'y');
    this.configureRotationDrag();

    deleteHandle.on(
      Phaser.Input.Events.POINTER_DOWN,
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        if (this.cannon) {
          this.onRemove(this.cannon);
        }
      },
    );
  }

  select(ship: ModularShip, cannon: Phaser.GameObjects.Image) {
    this.ship = ship;
    this.cannon = cannon;
    this.container.setVisible(true);
    this.sync();
  }

  clear() {
    this.ship = undefined;
    this.cannon = undefined;
    this.axisDrag = undefined;
    this.previousPointerAngle = undefined;
    this.container.setVisible(false);
  }

  sync() {
    if (!this.ship || !this.cannon || !this.cannon.active) {
      this.clear();
      return;
    }

    const center = this.cannon.getWorldTransformMatrix().transformPoint(0, 0);
    const shipRotation = this.ship.getWorldTransformMatrix().rotation;

    this.container.setPosition(center.x, center.y).setRotation(shipRotation);
    this.rotationKnob.setPosition(
      Math.cos(this.cannon.rotation) * ROTATION_RADIUS,
      Math.sin(this.cannon.rotation) * ROTATION_RADIUS,
    );
  }

  private configureAxisDrag(
    handle: Phaser.GameObjects.Rectangle,
    axis: 'x' | 'y',
  ) {
    handle.on(
      Phaser.Input.Events.POINTER_DOWN,
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => event.stopPropagation(),
    );
    handle.on(Phaser.Input.Events.DRAG_START, (pointer: Phaser.Input.Pointer) => {
      if (!this.ship || !this.cannon) {
        return;
      }

      const localPointer = this.ship.pointToContainer({ x: pointer.worldX, y: pointer.worldY });
      this.axisDrag = {
        cannonX: this.cannon.x,
        cannonY: this.cannon.y,
        grabOffsetX: localPointer.x - this.cannon.x,
        grabOffsetY: localPointer.y - this.cannon.y,
      };
    });
    handle.on(Phaser.Input.Events.DRAG, (pointer: Phaser.Input.Pointer) => {
      if (!this.ship || !this.cannon || !this.axisDrag) {
        return;
      }

      const localPointer = this.ship.pointToContainer({ x: pointer.worldX, y: pointer.worldY });
      const x = axis === 'x'
        ? localPointer.x - this.axisDrag.grabOffsetX
        : this.axisDrag.cannonX;
      const y = axis === 'y'
        ? localPointer.y - this.axisDrag.grabOffsetY
        : this.axisDrag.cannonY;

      this.ship.moveCannon(this.cannon, x, y);
      this.sync();
    });
    handle.on(Phaser.Input.Events.DRAG_END, () => {
      this.axisDrag = undefined;
    });
  }

  private configureRotationDrag() {
    this.rotationKnob.on(
      Phaser.Input.Events.POINTER_DOWN,
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => event.stopPropagation(),
    );
    this.rotationKnob.on(Phaser.Input.Events.DRAG_START, (pointer: Phaser.Input.Pointer) => {
      this.previousPointerAngle = this.pointerAngleAroundCannon(pointer);
    });
    this.rotationKnob.on(Phaser.Input.Events.DRAG, (pointer: Phaser.Input.Pointer) => {
      if (!this.cannon || this.previousPointerAngle === undefined) {
        return;
      }

      const pointerAngle = this.pointerAngleAroundCannon(pointer);
      if (pointerAngle === undefined) {
        return;
      }

      const delta = Phaser.Math.Angle.Wrap(pointerAngle - this.previousPointerAngle);
      this.cannon.setRotation(Phaser.Math.Angle.Wrap(this.cannon.rotation + delta));
      this.previousPointerAngle = pointerAngle;
      this.sync();
    });
    this.rotationKnob.on(Phaser.Input.Events.DRAG_END, () => {
      this.previousPointerAngle = undefined;
    });
  }

  private pointerAngleAroundCannon(pointer: Phaser.Input.Pointer) {
    if (!this.ship || !this.cannon) {
      return undefined;
    }

    const localPointer = this.ship.pointToContainer({ x: pointer.worldX, y: pointer.worldY });
    return Phaser.Math.Angle.Between(
      this.cannon.x,
      this.cannon.y,
      localPointer.x,
      localPointer.y,
    );
  }
}
