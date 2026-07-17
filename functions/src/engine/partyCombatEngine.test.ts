import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  resolvePartyPlayerTurn,
  resolvePartyEnemyPhase,
  resolvePvpTurn,
  type PartyPlayerInput,
  type PartyEnemyPhasePlayerState,
  type PvpDefenderInput,
} from './partyCombatEngine';
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

describe('resolvePartyPlayerTurn', () => {
  afterEach(() => vi.restoreAllMocks());

  it('damages the targeted enemy and returns the updated board', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // avoids miss/ailment chances
    const result = resolvePartyPlayerTurn(player('p1'), [mothling({ hp: 1000 })]);
    expect(result.enemyHp[0]).toBeLessThan(1000);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].uid).toBe('p1');
  });

  it("a second player's turn sees the first player's damage already applied - can't hit a dead enemy twice", () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const first = resolvePartyPlayerTurn(player('p1', { stats: stats({ attack: 999 }) }), [mothling({ hp: 20 })]);
    expect(first.enemyHp[0]).toBe(0); // one-shot with attack: 999
    expect(first.hits[0].defeated).toBe(true);

    // p2's turn receives the already-updated board (enemyHp: [0]), not the original hp: 20 -
    // exactly the bug this sequential design fixes (a second player's attack landing on an enemy
    // the first player's hit had already defeated).
    const second = resolvePartyPlayerTurn(player('p2'), [{ enemyId: 'mothling', level: 1, hp: first.enemyHp[0] }]);
    expect(second.hits).toHaveLength(0); // no alive enemy to target - resolveTargetIndex returns undefined
  });

  it('sets defending true only for a Defend (or flee) action, not attack/skill/item', () => {
    expect(resolvePartyPlayerTurn(player('p1', { action: { type: 'defend' } }), [mothling()]).defending).toBe(true);
    expect(resolvePartyPlayerTurn(player('p1', { action: { type: 'flee' } }), [mothling()]).defending).toBe(true);
    expect(resolvePartyPlayerTurn(player('p1', { action: { type: 'attack' } }), [mothling()]).defending).toBe(false);
  });

  it('a stunned player skips their action entirely but still takes ailment tick damage', () => {
    const stunnedAndPoisoned: ActiveAilment[] = [{ ailmentId: 'stun' }, { ailmentId: 'poison' }];
    const result = resolvePartyPlayerTurn(
      player('p1', { action: { type: 'attack' }, ailments: stunnedAndPoisoned, stats: stats({ hp: 60, maxHp: 60 }) }),
      [mothling({ hp: 1000 })],
    );
    expect(result.hits).toHaveLength(0); // never got to attack
    expect(result.enemyHp[0]).toBe(1000); // untouched
    expect(result.hp).toBeLessThan(60); // poison still ticked
  });

  it('an offensive lanternAbility damages the enemy and deducts oil', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = resolvePartyPlayerTurn(
      player('p1', { action: { type: 'lanternAbility', abilityId: 'lantern-flame' }, stats: stats({ lanternOil: 20 }) }),
      [mothling({ hp: 1000 })],
    );
    expect(result.enemyHp[0]).toBeLessThan(1000);
    expect(result.hits).toHaveLength(1);
    expect(result.lanternOil).toBe(12); // 20 - lantern-flame's 8 oil cost
  });

  it('a healing lanternAbility restores hp and never touches the enemy board', () => {
    const result = resolvePartyPlayerTurn(
      player('p1', { action: { type: 'lanternAbility', abilityId: 'steadfast-ember' }, stats: stats({ hp: 20, maxHp: 60, lanternOil: 20 }) }),
      [mothling({ hp: 1000 })],
    );
    expect(result.hp).toBe(45); // 20 + steadfast-ember's 25 healHp
    expect(result.enemyHp[0]).toBe(1000);
    expect(result.hits).toHaveLength(0);
    expect(result.lanternOil).toBe(10); // 20 - steadfast-ember's 10 oil cost
  });
});

describe('resolvePartyEnemyPhase', () => {
  afterEach(() => vi.restoreAllMocks());

  function playerState(uid: string, overrides: Partial<PartyEnemyPhasePlayerState> = {}): PartyEnemyPhasePlayerState {
    return { uid, hp: 999, maxHp: 999, defense: 5, ailments: [], defending: false, ...overrides };
  }

  it('halves damage against a defending player', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const attacking = resolvePartyEnemyPhase([playerState('solo', { defending: false })], [mothling()]);
    const defending = resolvePartyEnemyPhase([playerState('solo', { defending: true })], [mothling()]);
    const attackingHit = attacking.enemyHits.find((h) => !h.missed)!;
    const defendingHit = defending.enemyHits.find((h) => !h.missed)!;
    expect(defendingHit.damage).toBe(Math.round(attackingHit.damage / 2));
  });

  it('never targets a downed player', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = resolvePartyEnemyPhase(
      [playerState('downed', { hp: 0 }), playerState('standing')],
      [mothling({ hp: 1000 })],
    );
    expect(result.enemyHits.every((h) => h.targetUid === 'standing')).toBe(true);
  });

  it('distributes attacks across every alive player over many calls', () => {
    const targeted = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const result = resolvePartyEnemyPhase([playerState('p1'), playerState('p2')], [mothling({ hp: 1000 })]);
      for (const hit of result.enemyHits) targeted.add(hit.targetUid);
    }
    expect(targeted.has('p1')).toBe(true);
    expect(targeted.has('p2')).toBe(true);
  });

  it('a dead enemy in the roster never gets a turn', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = resolvePartyEnemyPhase([playerState('p1')], [mothling({ hp: 0 }), mothling({ hp: 1000 })]);
    expect(result.enemyHits.every((h) => h.attackerIndex === 1)).toBe(true);
  });
});

describe('resolvePvpTurn', () => {
  afterEach(() => vi.restoreAllMocks());

  function opponent(overrides: Partial<PvpDefenderInput> = {}): PvpDefenderInput {
    return { hp: 60, maxHp: 60, defense: 5, ...overrides };
  }

  it('damages the opponent directly, not an enemy board', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = resolvePvpTurn(player('p1'), opponent({ hp: 1000, maxHp: 1000 }));
    expect(result.defenderHp).toBeLessThan(1000);
  });

  it('defeats the opponent when damage brings their hp to 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = resolvePvpTurn(player('p1', { stats: stats({ attack: 999 }) }), opponent({ hp: 20 }));
    expect(result.defenderHp).toBe(0);
    expect(result.log.some((l) => l.includes('defeated'))).toBe(true);
  });

  it('a landed attack populates a structured hit, and a defeated opponent flags it', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = resolvePvpTurn(player('p1', { stats: stats({ attack: 999 }) }), opponent({ hp: 20 }));
    expect(result.hit).not.toBeNull();
    expect(result.hit?.missed).toBe(false);
    expect(result.hit?.defeated).toBe(true);
    expect(result.hit?.damage).toBeGreaterThan(0);
  });

  it('a Defend action never touches the opponent, sets defending true, and leaves hit null', () => {
    const result = resolvePvpTurn(player('p1', { action: { type: 'defend' } }), opponent());
    expect(result.defenderHp).toBe(opponent().hp);
    expect(result.defending).toBe(true);
    expect(result.forfeited).toBe(false);
    expect(result.hit).toBeNull();
  });

  it('a flee action forfeits the match without damaging anyone, and leaves hit null', () => {
    const result = resolvePvpTurn(player('p1', { action: { type: 'flee' } }), opponent());
    expect(result.forfeited).toBe(true);
    expect(result.defenderHp).toBe(opponent().hp);
    expect(result.hit).toBeNull();
  });

  it('an offensive lanternAbility damages the opponent and deducts oil', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = resolvePvpTurn(
      player('p1', { action: { type: 'lanternAbility', abilityId: 'lantern-flame' }, stats: stats({ lanternOil: 20 }) }),
      opponent({ hp: 1000, maxHp: 1000 }),
    );
    expect(result.defenderHp).toBeLessThan(1000);
    expect(result.hit).not.toBeNull();
    expect(result.lanternOil).toBe(12); // 20 - lantern-flame's 8 oil cost
  });

  it('a healing lanternAbility restores hp and never touches the opponent', () => {
    const result = resolvePvpTurn(
      player('p1', { action: { type: 'lanternAbility', abilityId: 'steadfast-ember' }, stats: stats({ hp: 20, maxHp: 60, lanternOil: 20 }) }),
      opponent(),
    );
    expect(result.hp).toBe(45); // 20 + steadfast-ember's 25 healHp
    expect(result.defenderHp).toBe(opponent().hp);
    expect(result.hit).toBeNull();
    expect(result.lanternOil).toBe(10); // 20 - steadfast-ember's 10 oil cost
  });

  it('a stunned player skips their action entirely but still takes ailment tick damage', () => {
    const stunnedAndPoisoned: ActiveAilment[] = [{ ailmentId: 'stun' }, { ailmentId: 'poison' }];
    const result = resolvePvpTurn(
      player('p1', { action: { type: 'attack' }, ailments: stunnedAndPoisoned, stats: stats({ hp: 60, maxHp: 60 }) }),
      opponent({ hp: 1000, maxHp: 1000 }),
    );
    expect(result.defenderHp).toBe(1000); // never got to attack
    expect(result.hp).toBeLessThan(60); // poison still ticked
  });
});
