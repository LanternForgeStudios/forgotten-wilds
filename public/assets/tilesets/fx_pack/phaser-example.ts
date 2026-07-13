import Phaser from "phaser";

export function preloadFx(scene: Phaser.Scene): void {
  const names = [
    "shadow_moth","ash","smoke_puff","magic_spark","ember",
    "poison_cloud","healing_sparkle","holy_light","blood_splatter",
    "bone_fragment","ice_shard","water_drop","earth_chip","wind_swirl","dark_energy"
  ];

  for (const name of names) {
    scene.load.spritesheet(
      `fx-${name.replaceAll("_", "-")}`,
      `/assets/fx/sheets/${name}.png`,
      { frameWidth: 16, frameHeight: 16 }
    );
  }
}

export function burstFx(
  scene: Phaser.Scene,
  x: number,
  y: number,
  textureKey: string,
  quantity = 12
): Phaser.GameObjects.Particles.ParticleEmitter {
  const emitter = scene.add.particles(x, y, textureKey, {
    frame: [0, 1, 2, 3],
    lifespan: { min: 500, max: 900 },
    speed: { min: 25, max: 85 },
    angle: { min: 200, max: 340 },
    alpha: { start: 1, end: 0 },
    scale: { start: 1, end: 0.2 },
    rotate: { min: -180, max: 180 },
    emitting: false
  });

  emitter.explode(quantity);
  scene.time.delayedCall(1100, () => emitter.destroy());
  return emitter;
}
