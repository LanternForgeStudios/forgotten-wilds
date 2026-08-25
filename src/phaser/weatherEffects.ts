import Phaser from 'phaser';
import type { TimePhase, WeatherKind } from '@/types';

/** Depth for the weather layer - must render above every tile layer/entity, matching
 *  ExplorationScene's OVERHANG_DEPTH (1000, "always renders above every tile layer and every
 *  entity/player sprite"), but below its debug graphics (OVERHANG_DEPTH + 100). Kept as its own
 *  constant here rather than importing from ExplorationScene, same as battleEffects.ts's
 *  FX_EMITTER_DEPTH not importing from BattleScene - avoids a circular import between the Scene
 *  and its effects module. */
export const WEATHER_DEPTH = 1050;

const STREAK_KEY = 'fx-weather-streak';
const SAND_STREAK_KEY = 'fx-weather-sand-streak';
const SOFT_CIRCLE_KEY = 'fx-weather-soft-circle';
const SNOWFLAKE_KEY = 'fx-weather-snowflake';

/** Thin vertical streak - rain falling. Same "generate a plain white texture once, tint per-use"
 *  approach as battleEffects.ts. */
function ensureStreakTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(STREAK_KEY)) return;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, 3, 18);
  g.generateTexture(STREAK_KEY, 3, 18);
  g.destroy();
}

/** A long, thin *horizontal* streak - sandstorm grit, deliberately its own texture rather than
 *  the vertical rain streak rotated 90 degrees, so it reads as long wind-blown grit ("sideways
 *  rain, but longer") rather than a rotated raindrop. */
function ensureSandStreakTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SAND_STREAK_KEY)) return;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, 46, 3);
  g.generateTexture(SAND_STREAK_KEY, 46, 3);
  g.destroy();
}

/** A soft/blurred-looking circle - fog wisps and (tinted) sandstorm haze. Phaser's
 *  fillGradientStyle doesn't survive generateTexture (corner-gradient fills are dropped from the
 *  baked texture), so the blur is faked the standard way: several concentric circles, largest and
 *  most transparent first, smallest and most opaque last, approximating a radial falloff. */
function ensureSoftCircleTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SOFT_CIRCLE_KEY)) return;
  const size = 40;
  const center = size / 2;
  const g = scene.add.graphics();
  const rings = [
    { r: 20, a: 0.25 },
    { r: 15, a: 0.35 },
    { r: 10, a: 0.5 },
    { r: 5, a: 0.7 },
  ];
  for (const ring of rings) {
    g.fillStyle(0xffffff, ring.a);
    g.fillCircle(center, center, ring.r);
  }
  g.generateTexture(SOFT_CIRCLE_KEY, size, size);
  g.destroy();
}

/** A small, crisp (not blurred) circle - individual snowflakes. */
function ensureSnowflakeTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SNOWFLAKE_KEY)) return;
  const size = 6;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(size / 2, size / 2, size / 2);
  g.generateTexture(SNOWFLAKE_KEY, size, size);
  g.destroy();
}

export function ensureWeatherTextures(scene: Phaser.Scene): void {
  ensureStreakTexture(scene);
  ensureSandStreakTexture(scene);
  ensureSoftCircleTexture(scene);
  ensureSnowflakeTexture(scene);
}

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/** Owns whichever weather particle emitter(s) are currently active for one Scene - at most one
 *  emitter for rain/snow/fog, two for sandstorm (grit + haze layered together). Screen-space
 *  fixed (scrollFactor 0) and zoned to the live camera viewport, not the world/map size, so
 *  weather always covers exactly what's on screen regardless of map size or camera position.
 *  This is the first *continuous* emitter in this codebase (battleEffects.ts's are one-shot
 *  explode()-then-destroy() bursts) - lifecycle here is "replace on kind change" instead. */
export class WeatherLayer {
  private readonly scene: Phaser.Scene;
  private kind: WeatherKind | null = null;
  private emitters: Emitter[] = [];
  private currentPhase: TimePhase = 'day';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Called from ExplorationScene.setTimePhase alongside the lighting update - fog's own particle
   *  haze stacks with night's dark ambient (reported live as "barely visible"), so fog needs to
   *  know the current phase to back off at night. Every other weather kind ignores this; only fog
   *  reads currentPhase. Forces a rebuild if fog is the active kind and the phase actually
   *  changed, same "null out kind, replay setWeather" trick handleResize uses below. */
  setPhaseHint(phase: TimePhase): void {
    if (phase === this.currentPhase) return;
    this.currentPhase = phase;
    if (this.kind === 'fog') {
      const kind = this.kind;
      this.kind = null;
      this.setWeather(kind);
    }
  }

  /** `'sun'` and `null` both mean "no visible effect" - sun is still a real resolved weather
   *  state (see src/utils/weather.ts), it just has no particle effect in this version. */
  setWeather(kind: WeatherKind | null): void {
    if (kind === this.kind) return;
    this.kind = kind;
    this.destroyEmitters();
    if (!kind || kind === 'sun') return;

    ensureWeatherTextures(this.scene);
    const { width, height } = this.viewportSize();

    switch (kind) {
      case 'rain':
        this.emitters.push(this.createFallingEmitter({ width, height, tint: 0x8899aa, speedY: [500, 700], speedX: [-40, 10], alpha: [0.55, 0.35], frequency: 12, textureKey: STREAK_KEY }));
        break;
      case 'snow':
        this.emitters.push(this.createFallingEmitter({ width, height, tint: 0xffffff, speedY: [40, 90], speedX: [-20, 20], alpha: [0.9, 0.7], frequency: 16, textureKey: SNOWFLAKE_KEY, scale: [0.5, 1.1] }));
        break;
      case 'fog': {
        // Night's own dark ambient (see lightingEffects.ts) already reduces visibility a lot -
        // stacking fog's normal daytime alpha on top of that made the screen barely visible
        // (reported live). Half the density at night; unchanged everywhere else.
        const fogAlpha = this.currentPhase === 'night' ? 0.1 : 0.4;
        this.emitters.push(this.createDriftEmitter({ width, height, tint: 0xd8dce0, alpha: fogAlpha, frequency: 60, speedX: [8, 22] }));
        break;
      }
      case 'sandstorm':
        // Its own long horizontal streak texture (not fog's soft-circle haze, not rain's vertical
        // streak rotated) - reads as fast wind-blown grit, "sideways rain, but longer and faster."
        this.emitters.push(this.createFallingEmitter({ width, height, tint: 0xc9955a, speedY: [-30, 30], speedX: [650, 900], alpha: [0.6, 0.4], frequency: 6, textureKey: SAND_STREAK_KEY }));
        break;
    }
  }

  /** Called whenever the camera's viewport is resized (see ExplorationScene.setCamera/
   *  setViewport) so a live emitter's zone stays matched to the new screen size instead of
   *  covering the old one. */
  handleResize(): void {
    if (!this.kind || this.kind === 'sun') return;
    const kind = this.kind;
    this.kind = null; // force setWeather to actually rebuild rather than no-op on the guard above
    this.setWeather(kind);
  }

  destroy(): void {
    this.destroyEmitters();
  }

  private destroyEmitters(): void {
    for (const emitter of this.emitters) emitter.destroy();
    this.emitters = [];
  }

  private viewportSize(): { width: number; height: number } {
    const camera = this.scene.cameras.main;
    return { width: camera.width, height: camera.height };
  }

  /** Rain/snow/sandstorm-grit: particles enter from a strip just outside one edge of the
   *  viewport and travel across/down it in a straight line (speedX/speedY), rather than the
   *  angle+speed form - direct velocity components give a cleaner "wind-blown" feel for both the
   *  mostly-vertical (rain/snow) and mostly-horizontal (sandstorm grit) cases. */
  private createFallingEmitter(opts: {
    width: number;
    height: number;
    tint: number;
    speedY: [number, number];
    speedX: [number, number];
    alpha: [number, number];
    frequency: number;
    textureKey: string;
    scale?: [number, number];
    angleOverride?: [number, number];
  }): Emitter {
    // A margin around the viewport so particles entering/exiting at an angle don't pop in/out
    // visibly at the screen edge.
    const margin = 80;
    const emitter = this.scene.add.particles(0, 0, opts.textureKey, {
      x: { min: -margin, max: opts.width + margin },
      y: { min: -margin, max: opts.height + margin },
      speedX: { min: opts.speedX[0], max: opts.speedX[1] },
      speedY: { min: opts.speedY[0], max: opts.speedY[1] },
      lifespan: 1400,
      alpha: { start: opts.alpha[0], end: opts.alpha[1] },
      scale: opts.scale ? { min: opts.scale[0], max: opts.scale[1] } : 1,
      angle: opts.angleOverride ? { min: opts.angleOverride[0], max: opts.angleOverride[1] } : 0,
      tint: opts.tint,
      frequency: opts.frequency,
      blendMode: Phaser.BlendModes.NORMAL,
    });
    emitter.setScrollFactor(0);
    emitter.setDepth(WEATHER_DEPTH);
    return emitter;
  }

  /** Fog/sandstorm-haze: soft particles scattered across the whole viewport, drifting slowly and
   *  purely horizontally ("drift horizontally across the screen simulating moving mist"), fading
   *  in and out over a long lifespan so overlapping particles build into a continuous haze rather
   *  than reading as distinct blobs. */
  private createDriftEmitter(opts: {
    width: number;
    height: number;
    tint: number;
    alpha: number;
    frequency: number;
    speedX: [number, number];
  }): Emitter {
    const margin = 60;
    const emitter = this.scene.add.particles(0, 0, SOFT_CIRCLE_KEY, {
      x: { min: -margin, max: opts.width + margin },
      y: { min: -margin, max: opts.height + margin },
      speedX: { min: opts.speedX[0], max: opts.speedX[1] },
      speedY: { min: -3, max: 3 },
      lifespan: { min: 6000, max: 9000 },
      // Full density from the moment a particle spawns, fading out only right at the end of its
      // life - a start->end ramp across the *entire* multi-second lifespan (the original
      // approach) meant most particles spent nearly their whole life well below the target
      // alpha, which read as thin/patchy instead of a real haze.
      alpha: { start: opts.alpha, end: 0 },
      scale: { min: 2.5, max: 4.5 },
      tint: opts.tint,
      frequency: opts.frequency,
      blendMode: Phaser.BlendModes.NORMAL,
    });
    emitter.setScrollFactor(0);
    emitter.setDepth(WEATHER_DEPTH);
    return emitter;
  }
}
