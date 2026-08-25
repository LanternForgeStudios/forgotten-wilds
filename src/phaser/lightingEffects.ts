import Phaser from 'phaser';
import type { TimePhase } from '@/types';

const AMBIENT_BY_PHASE: Record<TimePhase, number> = {
  day: 0xffffff,
  sunrise: 0xffd9c2,
  sunset: 0xffb37a,
  night: 0x2b3550,
};

/** 0 at day (lights fully off), 1 everywhere else (lights at their configured peak intensity) -
 *  sunrise/sunset/night all keep registered lights fully lit; only the ambient tint distinguishes
 *  them from each other. */
const LIGHT_MULTIPLIER_BY_PHASE: Record<TimePhase, number> = {
  day: 0,
  sunrise: 1,
  sunset: 1,
  night: 1,
};

const TRANSITION_DURATION_MS = 3500;

function lerpColor(from: number, to: number, t: number): number {
  const fr = (from >> 16) & 0xff;
  const fg = (from >> 8) & 0xff;
  const fb = from & 0xff;
  const tr = (to >> 16) & 0xff;
  const tg = (to >> 8) & 0xff;
  const tb = to & 0xff;
  const r = Math.round(fr + (tr - fr) * t);
  const g = Math.round(fg + (tg - fg) * t);
  const b = Math.round(fb + (tb - fb) * t);
  return (r << 16) | (g << 8) | b;
}

export interface LightSpec {
  color: number;
  radius: number;
  intensity: number;
}

interface TrackedLight {
  light: Phaser.GameObjects.Light;
  peakIntensity: number;
}

/** Owns the scene's day/night ambient + registered point lights (glowing decor, hand-placed
 *  `type:"light"` map objects, the player's lantern). Mirrors weatherEffects.ts's WeatherLayer
 *  shape: one instance per ExplorationScene, constructed early (its own constructor touches no
 *  Phaser API, same reasoning as WeatherLayer - see ExplorationScene's constructor comment) so a
 *  method call arriving before Phaser's async boot completes can't hit an undefined field. The
 *  real Phaser lighting API only gets touched once `enable()` is called from `create()`, and
 *  every other method is only ever invoked after that (gated by PhaserExplorationCanvas's
 *  `sceneReady` checks on its prop-push effects). */
export class LightingLayer {
  private readonly scene: Phaser.Scene;
  private phase: TimePhase = 'day';
  private mapLights = new Map<string, TrackedLight>();
  private lanternLight: Phaser.GameObjects.Light | null = null;
  // 2x brighter than the original 0.8 (2026-08 owner ask - "twice as glowing").
  private lanternPeakIntensity = 1.6;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Call once from create() - after this, ambient starts neutral (day) and every Sprite/
   *  TilemapLayer that calls .setLighting(true) renders normally until setPhase darkens things. */
  enable(): void {
    this.scene.lights.enable();
    this.scene.lights.setAmbientColor(AMBIENT_BY_PHASE.day);
  }

  /** Upsert-or-remove a single tracked light by an arbitrary caller-chosen id (entity ids prefixed
   *  `entity:`, hand-placed `type:"light"` map objects prefixed `mapobj:` - see ExplorationScene).
   *  `spec: null` removes it - covers an entity retexturing away from a lit sprite (a chest being
   *  opened) or being destroyed outright (setEntities' stale-visual cleanup), not just creation. */
  setLight(id: string, x: number, y: number, spec: LightSpec | null): void {
    const existing = this.mapLights.get(id);
    if (!spec) {
      if (existing) {
        this.scene.lights.removeLight(existing.light);
        this.mapLights.delete(id);
      }
      return;
    }
    if (existing) {
      existing.light.x = x;
      existing.light.y = y;
      existing.light.setRadius(spec.radius).setColor(spec.color);
      existing.peakIntensity = spec.intensity;
      existing.light.setIntensity(spec.intensity * LIGHT_MULTIPLIER_BY_PHASE[this.phase]);
    } else {
      const light = this.scene.lights.addLight(x, y, spec.radius, spec.color, 0);
      this.mapLights.set(id, { light, peakIntensity: spec.intensity });
      light.setIntensity(spec.intensity * LIGHT_MULTIPLIER_BY_PHASE[this.phase]);
    }
  }

  /** Called once at the top of loadMap, before parsing the new map's entities/objects - wipes
   *  every tracked light from whichever location the player is leaving. */
  clearAllMapLights(): void {
    for (const tracked of this.mapLights.values()) this.scene.lights.removeLight(tracked.light);
    this.mapLights.clear();
  }

  /** Sunset/night only (not sunrise, not day) per the "lantern shines during sunset and night"
   *  ask - ExplorationScene decides *when* to call this (lantern equipped + right phase); this
   *  class only owns the Light object itself. Position is pushed every physics-sync tick via
   *  updateLanternPosition, same cadence as the equipment-layer sprite it tracks. */
  setLanternActive(active: boolean, x: number, y: number): void {
    if (active && !this.lanternLight) {
      const intensity = this.lanternPeakIntensity * LIGHT_MULTIPLIER_BY_PHASE[this.phase];
      this.lanternLight = this.scene.lights.addLight(x, y, 90, 0xffcd85, intensity);
    } else if (!active && this.lanternLight) {
      this.scene.lights.removeLight(this.lanternLight);
      this.lanternLight = null;
    }
  }

  updateLanternPosition(x: number, y: number): void {
    if (this.lanternLight) {
      this.lanternLight.x = x;
      this.lanternLight.y = y;
    }
  }

  /** Tweens ambient color and every tracked light's intensity toward the target phase's values
   *  over TRANSITION_DURATION_MS, rather than a hard cut. */
  setPhase(phase: TimePhase): void {
    if (phase === this.phase) return;
    const fromPhase = this.phase;
    this.phase = phase;
    const fromAmbient = AMBIENT_BY_PHASE[fromPhase];
    const toAmbient = AMBIENT_BY_PHASE[phase];
    const fromMultiplier = LIGHT_MULTIPLIER_BY_PHASE[fromPhase];
    const toMultiplier = LIGHT_MULTIPLIER_BY_PHASE[phase];
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: TRANSITION_DURATION_MS,
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        this.scene.lights.setAmbientColor(lerpColor(fromAmbient, toAmbient, t));
        const multiplier = fromMultiplier + (toMultiplier - fromMultiplier) * t;
        this.applyIntensityMultiplier(multiplier);
      },
    });
  }

  private applyIntensityMultiplier(multiplier: number): void {
    for (const tracked of this.mapLights.values()) tracked.light.setIntensity(tracked.peakIntensity * multiplier);
    if (this.lanternLight) this.lanternLight.setIntensity(this.lanternPeakIntensity * multiplier);
  }
}
