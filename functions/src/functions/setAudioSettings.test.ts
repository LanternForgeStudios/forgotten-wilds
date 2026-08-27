import { describe, expect, it } from 'vitest';
import { callAs, readPlayer, seedPlayer } from '../testUtils/firestoreTestEnv';
import { setAudioSettings } from './setAudioSettings';

describe('setAudioSettings', () => {
  it('rejects an unauthenticated request', async () => {
    await expect(
      setAudioSettings.run({
        data: { musicEnabled: false, sfxEnabled: false, musicVolume: 0.2, sfxVolume: 0.2 },
        auth: undefined,
      }),
    ).rejects.toThrow();
  });

  it('rejects non-boolean mute flags', async () => {
    const uid = 'u-audio-bad-bool';
    await seedPlayer(uid);
    await expect(
      callAs(setAudioSettings, uid, { musicEnabled: 'no' as never, sfxEnabled: true, musicVolume: 0.5, sfxVolume: 0.5 }),
    ).rejects.toThrow();
  });

  it('rejects a volume outside 0-1', async () => {
    const uid = 'u-audio-bad-volume';
    await seedPlayer(uid);
    await expect(
      callAs(setAudioSettings, uid, { musicEnabled: true, sfxEnabled: true, musicVolume: 1.5, sfxVolume: 0.5 }),
    ).rejects.toThrow();
  });

  it('persists mute state and volume so they survive a fresh read (e.g. a login on another device)', async () => {
    const uid = 'u-audio-persist';
    await seedPlayer(uid);
    const result = await callAs(setAudioSettings, uid, {
      musicEnabled: false,
      sfxEnabled: true,
      musicVolume: 0.1,
      sfxVolume: 0.9,
    });
    expect(result).toEqual({ musicEnabled: false, sfxEnabled: true, musicVolume: 0.1, sfxVolume: 0.9 });

    const persisted = await readPlayer(uid);
    expect(persisted.player.audioSettings).toEqual({
      musicEnabled: false,
      sfxEnabled: true,
      musicVolume: 0.1,
      sfxVolume: 0.9,
    });
  });
});
