#!/usr/bin/env node
// Generates every placeholder audio file registered in src/assets/registry.ts's 'audio' category -
// the sonic equivalent of the existing "Generated SVG placeholder" convention for visual assets
// (see public/CREDITS.md's "Generated placeholders" section): crude but real, audible, distinct
// procedural tones, not silence. NOT shipped game code, not imported by the app - a committed,
// re-runnable dev tool (same role as genMap.mjs/genMapRicher.mjs), in case more placeholder ids get
// added before real music/SFX replaces them.
//
// Usage: node scripts/genPlaceholderAudio.mjs
// (no arguments - writes every definition below to public/assets/audio/{sfx,music}/*.wav)
//
// All files are 22050Hz mono 16-bit PCM WAV - plain synthesized sine tones/noise bursts with a
// short attack/release envelope on every segment (avoids audible clicks at segment boundaries),
// written with nothing but Node's built-in fs/Buffer - no audio-encoding dependency needed for a
// placeholder this simple. Final art should replace these with real recordings/compositions
// (mp3/ogg is fine and much smaller for the ~60-120s music loops - see each registry entry's notes
// for the intended final length/mood).

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = join(__dirname, '..', 'public', 'assets', 'audio');
const SAMPLE_RATE = 22050;

/** One tone segment: a sine wave at `freq` (optionally sweeping to `sweepTo`) for `dur` seconds,
 *  with a short attack/release envelope so consecutive segments never click at the seam. */
function toneSegment(freq, dur, gain = 0.3, sweepTo = null) {
  const n = Math.max(1, Math.floor(dur * SAMPLE_RATE));
  const out = new Float32Array(n);
  const attack = Math.min(0.015, dur * 0.25);
  const release = Math.min(0.04, dur * 0.4);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const f = sweepTo === null ? freq : freq + (sweepTo - freq) * (t / dur);
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    let env = 1;
    if (t < attack) env = t / attack;
    else if (t > dur - release) env = Math.max(0, (dur - t) / release);
    out[i] = Math.sin(phase) * gain * env;
  }
  return out;
}

/** A short burst of white noise with the same attack/release envelope shape - used for
 *  whoosh/impact-style cues where a pure tone reads as too musical. */
function noiseSegment(dur, gain = 0.3) {
  const n = Math.max(1, Math.floor(dur * SAMPLE_RATE));
  const out = new Float32Array(n);
  const attack = Math.min(0.01, dur * 0.2);
  const release = Math.min(0.05, dur * 0.5);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let env = 1;
    if (t < attack) env = t / attack;
    else if (t > dur - release) env = Math.max(0, (dur - t) / release);
    out[i] = (Math.random() * 2 - 1) * gain * env;
  }
  return out;
}

/** A silent gap between segments, in case a cue wants a distinct rhythmic pause. */
function silence(dur) {
  return new Float32Array(Math.max(0, Math.floor(dur * SAMPLE_RATE)));
}

function concat(segments) {
  const total = segments.reduce((sum, s) => sum + s.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const s of segments) {
    out.set(s, offset);
    offset += s.length;
  }
  return out;
}

/** Repeats a short musical "cell" (array of segments) enough times to fill roughly `targetSec`
 *  seconds - used for the looping music beds, so a 4-note pattern becomes a ~6s file Phaser can
 *  then loop indefinitely via sound.play({ loop: true }). */
function repeatToFill(cellBuilder, targetSec) {
  const cell = concat(cellBuilder());
  const cellSec = cell.length / SAMPLE_RATE;
  const repeats = Math.max(1, Math.round(targetSec / cellSec));
  const parts = [];
  for (let i = 0; i < repeats; i++) parts.push(cell);
  return concat(parts);
}

function floatTo16BitPCM(float32) {
  const buffer = Buffer.alloc(float32.length * 2);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    buffer.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, i * 2);
  }
  return buffer;
}

function writeWav(relativePath, float32Samples) {
  const pcm = floatTo16BitPCM(float32Samples);
  const byteRate = SAMPLE_RATE * 2;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  const outPath = join(OUT_ROOT, relativePath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, Buffer.concat([header, pcm]));
  console.log('wrote', outPath, `(${(pcm.length / byteRate).toFixed(2)}s)`);
}

// --- SFX: short one-shot cues -----------------------------------------------------------------

const SFX = {
  'ui-close': () => [toneSegment(500, 0.15, 0.25, 300)],
  'ui-error': () => [toneSegment(150, 0.1, 0.3), toneSegment(150, 0.1, 0.3)],
  purchase: () => [toneSegment(700, 0.08, 0.28), toneSegment(1000, 0.15, 0.28)],
  sell: () => [toneSegment(900, 0.08, 0.28), toneSegment(650, 0.15, 0.28)],
  rest: () => [toneSegment(440, 0.2, 0.25), toneSegment(554, 0.2, 0.25), toneSegment(659, 0.3, 0.28)],
  equip: () => [toneSegment(1200, 0.06, 0.3), toneSegment(800, 0.06, 0.3)],
  'item-use': () => [toneSegment(600, 0.15, 0.28, 900)],
  'craft-success': () => [toneSegment(523, 0.13, 0.26), toneSegment(659, 0.13, 0.26), toneSegment(784, 0.2, 0.28)],
  'chest-open': () => [toneSegment(200, 0.2, 0.25, 260), toneSegment(880, 0.2, 0.25)],
  shrine: () => [toneSegment(220, 0.6, 0.22), toneSegment(330, 0.4, 0.12)],
  'npc-talk': () => [toneSegment(700, 0.15, 0.25)],
  transition: () => [noiseSegment(0.3, 0.15), toneSegment(300, 0.3, 0.15, 900)],
  'combat-hit': () => [noiseSegment(0.15, 0.3), toneSegment(120, 0.15, 0.25)],
  'enemy-defeated': () => [toneSegment(500, 0.35, 0.28, 150)],
  victory: () => [toneSegment(523, 0.15, 0.28), toneSegment(659, 0.15, 0.28), toneSegment(784, 0.15, 0.28), toneSegment(1047, 0.3, 0.3)],
  'level-up': () => [toneSegment(784, 0.22, 0.28), toneSegment(988, 0.22, 0.28), toneSegment(1175, 0.35, 0.3)],
  defeat: () => [toneSegment(440, 0.25, 0.25), toneSegment(392, 0.25, 0.24), toneSegment(349, 0.4, 0.24)],
  'quest-started': () => [toneSegment(660, 0.25, 0.24)],
  'quest-progress': () => [toneSegment(660, 0.15, 0.24), toneSegment(784, 0.18, 0.24)],
  'quest-completed': () => [toneSegment(660, 0.18, 0.26), toneSegment(784, 0.18, 0.26), toneSegment(988, 0.3, 0.3)],
  'social-ping': () => [toneSegment(1000, 0.08, 0.26), silence(0.05), toneSegment(1200, 0.08, 0.26)],
};

// --- Music: looping beds, each a short repeating melodic cell filled out to ~6s ----------------

const MUSIC = {
  title: () => repeatToFill(() => [toneSegment(261, 0.375, 0.16), toneSegment(329, 0.375, 0.16), toneSegment(392, 0.375, 0.16), toneSegment(523, 0.375, 0.16)], 6),
  town: () => repeatToFill(() => [toneSegment(349, 0.4, 0.16), toneSegment(440, 0.4, 0.16), toneSegment(523, 0.4, 0.16), toneSegment(698, 0.4, 0.16)], 6),
  overworld: () => repeatToFill(() => [toneSegment(293, 0.35, 0.16), toneSegment(370, 0.35, 0.16), toneSegment(440, 0.35, 0.16), toneSegment(587, 0.35, 0.16)], 6),
  dungeon: () => repeatToFill(() => [toneSegment(147, 0.5, 0.18), toneSegment(155, 0.5, 0.16), toneSegment(147, 0.5, 0.18), toneSegment(131, 0.5, 0.16)], 6),
  combat: () => repeatToFill(() => [toneSegment(329, 0.25, 0.18), toneSegment(392, 0.25, 0.18), toneSegment(494, 0.25, 0.18), toneSegment(659, 0.25, 0.18)], 6),
  'combat-boss': () => repeatToFill(() => [toneSegment(165, 0.35, 0.2), toneSegment(196, 0.35, 0.18), toneSegment(247, 0.35, 0.18), toneSegment(329, 0.35, 0.2)], 6),
  defeat: () => repeatToFill(() => [toneSegment(220, 0.5, 0.14), toneSegment(196, 0.5, 0.13), toneSegment(175, 0.5, 0.13), toneSegment(165, 0.5, 0.12)], 6),
};

for (const [name, build] of Object.entries(SFX)) {
  writeWav(`sfx/${name}.wav`, concat(build()));
}
for (const [name, build] of Object.entries(MUSIC)) {
  writeWav(`music/${name}.wav`, build());
}
