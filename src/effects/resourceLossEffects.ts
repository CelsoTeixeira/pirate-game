import Phaser from 'phaser';

const CREW_LOSS_TEXTURE = 'crew-overboard';
const SUPPLIES_LOSS_TEXTURE = 'supplies-overboard';
const RESOURCE_LOSS_DEPTH = 7;
const RESOURCE_LOSS_LIFESPAN_MIN_MS = 6_000;
const RESOURCE_LOSS_LIFESPAN_MAX_MS = 8_000;
const RESOURCE_LOSS_DISPLAY_SIZE = 56;

export type ResourceLossKind = 'crew' | 'supplies';

export function preloadResourceLossEffectTextures(scene: Phaser.Scene) {
  scene.load.image(CREW_LOSS_TEXTURE, 'assets/gameplay/crew-overboard.png');
  scene.load.image(SUPPLIES_LOSS_TEXTURE, 'assets/gameplay/supplies-overboard.png');
}

export function playResourceLossEffect(
  scene: Phaser.Scene,
  x: number,
  y: number,
  kind: ResourceLossKind,
) {
  const texture = kind === 'crew' ? CREW_LOSS_TEXTURE : SUPPLIES_LOSS_TEXTURE;
  const image = scene.add
    .image(
      x + Phaser.Math.Between(-28, 28),
      y + Phaser.Math.Between(-20, 20),
      texture,
    )
    .setDisplaySize(RESOURCE_LOSS_DISPLAY_SIZE, RESOURCE_LOSS_DISPLAY_SIZE)
    .setDepth(RESOURCE_LOSS_DEPTH)
    .setRotation(Phaser.Math.FloatBetween(-0.2, 0.2));
  const lifespan = Phaser.Math.Between(
    RESOURCE_LOSS_LIFESPAN_MIN_MS,
    RESOURCE_LOSS_LIFESPAN_MAX_MS,
  );

  const bobTween = scene.tweens.add({
    targets: image,
    y: image.y - 12,
    duration: 900,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
  });
  scene.tweens.add({
    targets: image,
    x: image.x + Phaser.Math.Between(-18, 18),
    rotation: image.rotation + Phaser.Math.FloatBetween(-0.25, 0.25),
    alpha: 0,
    duration: lifespan,
    ease: 'Sine.easeInOut',
    onComplete: () => {
      bobTween.stop();
      image.destroy();
    },
  });
}
