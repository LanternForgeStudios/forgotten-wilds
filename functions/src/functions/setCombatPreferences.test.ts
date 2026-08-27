import { describe, expect, it } from 'vitest';
import { callAs, readPlayer, seedPlayer } from '../testUtils/firestoreTestEnv';
import { setCombatPreferences } from './setCombatPreferences';

describe('setCombatPreferences', () => {
  it('rejects an unauthenticated request', async () => {
    await expect(
      setCombatPreferences.run({ data: { fastRounds: true, targetAll: true }, auth: undefined }),
    ).rejects.toThrow();
  });

  it('rejects non-boolean values', async () => {
    const uid = 'u-combat-prefs-bad-input';
    await seedPlayer(uid);
    await expect(callAs(setCombatPreferences, uid, { fastRounds: 'yes' as never, targetAll: true })).rejects.toThrow();
  });

  it('persists both toggles so they survive a fresh read (e.g. a login on another device)', async () => {
    const uid = 'u-combat-prefs-persist';
    await seedPlayer(uid);
    const result = await callAs(setCombatPreferences, uid, { fastRounds: true, targetAll: true });
    expect(result).toEqual({ fastRounds: true, targetAll: true });

    const persisted = await readPlayer(uid);
    expect(persisted.player.combatPreferences).toEqual({ fastRounds: true, targetAll: true });
  });

  it('can flip a preference back off independently of the other', async () => {
    const uid = 'u-combat-prefs-flip';
    await seedPlayer(uid);
    await callAs(setCombatPreferences, uid, { fastRounds: true, targetAll: true });
    const result = await callAs(setCombatPreferences, uid, { fastRounds: false, targetAll: true });
    expect(result).toEqual({ fastRounds: false, targetAll: true });
  });
});
