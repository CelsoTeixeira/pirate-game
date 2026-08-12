import Phaser from 'phaser';

export type WindSample = Readonly<{
  directionRad: number;
  strength: number;
}>;

export class Wind {
  public directionRad: number;
  public strength: number;

  constructor(directionRad: number, strength: number) {
    this.directionRad = Phaser.Math.Angle.Normalize(directionRad);
    this.strength = Phaser.Math.Clamp(strength, 0, 1);
  }

  get vector() {
    return new Phaser.Math.Vector2(Math.cos(this.directionRad), Math.sin(this.directionRad)).scale(this.strength);
  }

  rotate(deltaRad: number) {
    this.directionRad = Phaser.Math.Angle.Normalize(this.directionRad + deltaRad);
  }

  adjustStrength(delta: number) {
    this.strength = Phaser.Math.Clamp(this.strength + delta, 0, 1);
  }
}
