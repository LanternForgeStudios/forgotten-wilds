import { describe, expect, it, vi, afterEach } from 'vitest';
import { resolvePartyRound, type PartyPlayerInput, type PartyRoundInput } from './partyCombatEngine';
import type { RoundEnemyInput } from './combatEngine';
import type { Stats, ActiveAilment } from '../shared-types';

function stats(overrides: Partial<Stats> = {}): Stats {
  return {
    hp: 60,
    maxHp: 60,
    spirit: 30,
    maxSpirit: 30,
    lanternOil: 20,
    maxLanternOil: 20,
    stamina: 0,
    maxStamina: 0,
    attack: 8,
    defense: 5,
    speed: 6,
    ...overrides,
  };
}

function player(uid: string, overrides: Partial<PartyPlayerInput> = {}): PartyPlayerInput {
  return {
    uid,
    action: { type: 'attack' },
    stats: stats(),
    inventory: [],
    ailments: [],
    ...overrides,
  };
}

function mothling(overrides: Partial<RoundEnemyInput> = {}): RoundEnemyInput {
  return { enemyId: 'mothling', level: 1, hp: 28, ...overrides };
}

describe('resolvePartyRound', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lets multiple players damage the same enemy in one round', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // avoids every miss/ailment-chance check
    const input: PartyRoundInput = {
      players: [
        player('p1', { stats: stats({ speed: 999 }) }),
        player('p2', { stats: stats({ speed: 998 }) }),
      ],
      enemies: [mothling({ hp: 1000 })], // survives the round so its own turn still fires
    };
    const result = resolvePartyRound(input);
    const hitsOnEnemy = result.hits.filter((h) => h.targetIndex === 0 && !h.missed);
    expect(hitsOnEnemy.map((h) => h.uid).sort()).toEqual(['p1', 'p2']);
    expect(result.enemyHp[0]).toBeLessThan(1000);
    expect(result.phase).toBe('continue');
  });

  it('halves damage taken by a defending player', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const attacking = resolvePartyRound({
      players: [player('solo', { action: { type: 'attack' }, stats: stats({ speed: 1 }) })],
      enemies: [mothling({ hp: 1000 })],
    });
    const defending = resolvePartyRound({
      players: [player('solo', { action: { type: 'defend' }, stats: stats({ speed: 1 }) })],
      enemies: [mothling({ hp: 1000 })],
    });
    const attackingHit = attacking.enemyHits.find((h) => !h.missed)!;
    const defendingHit = defending.enemyHits.find((h) => !h.missed)!;
    expect(defendingHit.wasDefended).toBe(true);
    expect(attackingHit.wasDefended).toBe(false);
    expect(defendingHit.damage).toBe(Math.round(attackingHit.damage / 2));
  });

  it('never lets a downed player act or be targeted', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const input: PartyRoundInput = {
      players: [
        player('downed', { stats: stats({ hp: 0, speed: 999 }) }),
        player('standing', { stats: stats({ speed: 998 }) }),
      ],
      enemies: [mothling({ hp: 1000 })],
    };
    const result = resolvePartyRound(input);
    expect(result.hits.some((h) => h.uid === 'downed')).toBe(false);
    expect(result.enemyHits.every((h) => h.targetUid === 'standing')).toBe(true);
    const downedResult = result.players.find((p) => p.uid === 'downed')!;
    expect(downedResult.hp).toBe(0);
  });

  it('reports victory once every enemy is defeated, and partyDefeated once every player is down', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const victory = resolvePartyRound({
      players: [player('p1', { stats: stats({ speed: 999, attack: 999 }) })],
      enemies: [mothling({ hp: 1 })],
    });
    expect(victory.phase).toBe('victory');

    const defeat = resolvePartyRound({
      players: [player('p1', { stats: stats({ hp: 1, speed: 1 }) })],
      enemies: [mothling({ hp: 1000, level: 50 })],
    });
    expect(defeat.phase).toBe('partyDefeated');
    expect(defeat.players[0].hp).toBe(0);
  });

  it('distributes enemy attacks across every alive player over many rounds, not just one', () => {
    const targeted = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const result = resolvePartyRound({
        players: [
          player('p1', { action: { type: 'defend' }, stats: stats({ speed: 1 }) }),
          player('p2', { action: { type: 'defend' }, stats: stats({ speed: 1 }) }),
        ],
        enemies: [mothling({ hp: 1000 })],
      });
      for (const hit of result.enemyHits) targeted.add(hit.targetUid);
    }
    expect(targeted.has('p1')).toBe(true);
    expect(targeted.has('p2')).toBe(true);
  });

  it('only inflicts an ailment on the player the attack actually landed on', () => {
    // mothling-dustwing (weight 1 of 4) inflicts Blind at a 0.3 chance - run enough rounds that a
    // real inflict is overwhelmingly likely, then confirm it never lands on the untargeted player.
    for (let i = 0; i < 60; i++) {
      const result = resolvePartyRound({
        players: [
          player('p1', { action: { type: 'defend' }, stats: stats({ speed: 1 }) }),
          player('p2', { action: { type: 'defend' }, stats: stats({ speed: 1 }) }),
        ],
        enemies: [mothling({ hp: 1000 })],
      });
      for (const hit of result.enemyHits) {
        const untargeted = hit.targetUid === 'p1' ? 'p2' : 'p1';
        const untargetedAilments = result.players.find((p) => p.uid === untargeted)!.ailments;
        expect(untargetedAilments.some((a: ActiveAilment) => a.ailmentId === 'blind')).toBe(false);
      }
    }
  });

  it('applies a targeted skill only against the shared enemy roster, not other players', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = resolvePartyRound({
      players: [
        player('p1', { action: { type: 'skill', skillId: 'keepers-strike', targetIndex: 1 }, stats: stats({ speed: 999 }) }),
      ],
      enemies: [mothling({ hp: 1000 }), mothling({ hp: 1000 })],
    });
    const hit = result.hits.find((h) => h.uid === 'p1' && !h.missed)!;
    expect(hit.targetIndex).toBe(1);
    expect(result.enemyHp[0]).toBe(1000); // untouched - only index 1 was targeted
    expect(result.enemyHp[1]).toBeLessThan(1000);
  });
});
