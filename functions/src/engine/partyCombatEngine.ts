// Party/PvP combat resolution for the Multiplayer Battle System (NewClaudeAsk.txt's "Multiplayer
// Battle System Design" - Endless Battle and casual PvP). A PARALLEL engine to combatEngine.ts,
// not a rewrite of it - solo quest combat never routes through here. The two engines share their
// core damage/ailment math via combatMath.ts so they can't silently drift on how a hit is computed
// (see that file's own doc comment); everything specific to "more than one player" lives only
// here, since combatEngine.ts's RoundInput/RoundResult are hardcoded to exactly one player and
// were never actually generic (see src/multiplayer/party.ts's comment claiming otherwise - that
// claim was wrong, this file is the real generalization).
//
// Resolution is deliberately SEQUENTIAL, one player at a time, not a single batch given every
// player's pre-chosen action at once: resolvePartyPlayerTurn is called once per alive party
// member, in turn order, threading each call's updated enemy board into the next player's call.
// That's what stops two players from both targeting an enemy the first one's hit already
// defeated (a real bug in an earlier "collect everyone's action, then resolve all at once"
// design - a second player's attack would land on an enemy that had already vanished from the
// first player's hit). Enemies only act once every party member has had their turn this round -
// see resolvePartyEnemyPhase, called separately by the caller after the last player's turn.

import { ENEMIES, type EnemyDefinition } from '../data/enemies';
import { SKILLS, type DamageType } from '../data/skills';
import { ITEMS } from '../data/items';
import { AILMENTS } from '../data/ailments';
import { LANTERN_ABILITIES } from '../data/lanternAbilities';
import { scaledEnemyStats, type RoundEnemyInput } from './combatEngine';
import {
  ailmentAttackMultiplier,
  applyAilmentTickDamage,
  blindMissChance,
  computeDamage,
  expireAilments,
  inflictAilment,
  isStunned,
  pickEnemyMove,
} from './combatMath';
import type { ActiveAilment, CombatAction, Stats } from '../shared-types';

export interface PartyPlayerInput {
  uid: string;
  action: CombatAction;
  stats: Stats;
  inventory: { itemId: string; quantity: number }[];
  ailments: ActiveAilment[];
}

export interface PartyCombatHitResult {
  uid: string;
  targetIndex: number;
  damage: number;
  missed: boolean;
  defeated: boolean;
}

const TARGET_ALL_MISS_CHANCE = 0.15;
const TARGET_ALL_DAMAGE_FACTOR = 0.6;

function weaknessMultiplier(enemy: EnemyDefinition, damageType: DamageType): number {
  return enemy.weaknessDamageType === damageType ? 1.5 : 1;
}

export interface PartyPlayerTurnResult {
  log: string[];
  /** The enemy board after this player's turn - feed this into the next player's
   *  resolvePartyPlayerTurn call (or into resolvePartyEnemyPhase, if this was the last player). */
  enemyHp: number[];
  hits: PartyCombatHitResult[];
  hp: number;
  spirit: number;
  lanternOil: number;
  ailments: ActiveAilment[];
  itemConsumedIds: string[];
  /** Whether this player chose Defend (or fled, treated the same way - see the 'flee' case below)
   *  this turn - the enemy phase halves an attack against a defending player. Decided from the
   *  action alone, the same "up front, not mid-resolution" reasoning solo combat's own
   *  playerDefending has, just per-player instead of per-round. */
  defending: boolean;
}

/** Resolves exactly one player's turn (item use, then their primary action) against the given
 *  live enemy board - callers advance through every alive party member this way, one at a time,
 *  each call's `enemyHp` feeding the next player's `enemies` input (see this file's own top
 *  comment for why). A stunned player's turn is a no-op regardless of what action they submitted
 *  (or didn't get to, if the caller auto-skips a stunned player's action-selection entirely) -
 *  ailment tick damage still applies either way, matching solo combat's own per-turn timing. */
export function resolvePartyPlayerTurn(player: PartyPlayerInput, enemies: RoundEnemyInput[]): PartyPlayerTurnResult {
  const log: string[] = [];
  const enemyHp = enemies.map((e) => e.hp);
  const enemyDefs = enemies.map((e) => ENEMIES[e.enemyId]);
  const enemyStats = enemies.map((e, i) => scaledEnemyStats(enemyDefs[i], e.level));
  const isEnemyAlive = (i: number) => enemyHp[i] > 0;
  const aliveEnemyIndices = () => enemyHp.map((_, i) => i).filter(isEnemyAlive);

  let hp = player.stats.hp;
  let spirit = player.stats.spirit;
  let lanternOil = player.stats.lanternOil;
  let ailments = player.ailments.map((a) => ({ ...a }));
  const inflictedThisTurn = new Set<string>();
  const itemConsumedIds: string[] = [];
  const hits: PartyCombatHitResult[] = [];
  const isDefensiveLanternAbility =
    player.action.type === 'lanternAbility' &&
    !!player.action.abilityId &&
    LANTERN_ABILITIES[player.action.abilityId]?.category === 'defensive';
  const defending = player.action.type === 'defend' || player.action.type === 'flee' || isDefensiveLanternAbility;

  function damageEnemy(i: number, dmg: number, verb: string): boolean {
    const before = enemyHp[i];
    enemyHp[i] = Math.max(0, before - dmg);
    log.push(`${verb} ${enemyDefs[i].name} for ${dmg} damage.`);
    const defeated = before > 0 && enemyHp[i] <= 0;
    if (defeated) log.push(`${enemyDefs[i].name} is defeated!`);
    return defeated;
  }

  function resolveTargetIndex(requested: number | undefined): number | undefined {
    const alive = aliveEnemyIndices();
    if (alive.length === 0) return undefined;
    if (requested !== undefined && isEnemyAlive(requested)) return requested;
    return alive[0];
  }

  function resolveOffensiveHits(power: number, verb: string, bonusMultiplier: (i: number) => number, damageType: DamageType) {
    const attackMultiplier = ailmentAttackMultiplier(ailments);
    const blindChance = damageType === 'physical' ? blindMissChance(ailments) : 0;
    const alive = aliveEnemyIndices();
    const useAll = !!player.action.targetAll && alive.length > 1;
    const targets = useAll ? alive : [resolveTargetIndex(player.action.targetIndex)].filter((i): i is number => i !== undefined);

    for (const i of targets) {
      const missedTargetAll = useAll && Math.random() < TARGET_ALL_MISS_CHANCE;
      const missedBlind = blindChance > 0 && Math.random() < blindChance;
      if (missedTargetAll || missedBlind) {
        log.push(`Your attack on ${enemyDefs[i].name} goes wide - miss!`);
        hits.push({ uid: player.uid, targetIndex: i, damage: 0, missed: true, defeated: false });
        continue;
      }
      let dmg = Math.round(computeDamage(power, player.stats.attack * attackMultiplier, enemyStats[i].defense) * bonusMultiplier(i));
      if (useAll) dmg = Math.max(1, Math.round(dmg * TARGET_ALL_DAMAGE_FACTOR));
      const defeated = damageEnemy(i, dmg, verb);
      hits.push({ uid: player.uid, targetIndex: i, damage: dmg, missed: false, defeated });
    }
  }

  function consumeItems() {
    const itemIds = player.action.itemIds ?? [];
    const counts = new Map<string, number>();
    for (const id of itemIds.slice(0, 3)) counts.set(id, (counts.get(id) ?? 0) + 1);

    for (const [itemId, count] of counts) {
      const def = ITEMS[itemId];
      if (!def?.effect) continue;
      for (let n = 0; n < count; n++) itemConsumedIds.push(itemId);

      if (def.effect.cureAilmentId) {
        const idx = ailments.findIndex((a) => a.ailmentId === def.effect!.cureAilmentId);
        if (idx >= 0) {
          const curedName = AILMENTS[def.effect.cureAilmentId]?.name ?? def.effect.cureAilmentId;
          ailments = ailments.filter((_, i) => i !== idx);
          log.push(`You use ${itemId.replace(/-/g, ' ')} and cure ${curedName}.`);
        }
      }
      for (let n = 0; n < count; n++) {
        if (def.effect.healHpPercent) hp = Math.min(player.stats.maxHp, hp + Math.round(player.stats.maxHp * def.effect.healHpPercent));
        if (def.effect.healSpiritPercent) {
          spirit = Math.min(player.stats.maxSpirit, spirit + Math.round(player.stats.maxSpirit * def.effect.healSpiritPercent));
        }
        if (def.effect.restoreOilPercent) {
          lanternOil = Math.min(player.stats.maxLanternOil, lanternOil + Math.round(player.stats.maxLanternOil * def.effect.restoreOilPercent));
        }
      }
    }
  }

  if (isStunned(ailments)) {
    log.push(`${player.uid} is stunned and cannot act!`);
  } else {
    consumeItems();
    switch (player.action.type) {
      case 'attack':
        resolveOffensiveHits(SKILLS.attack.power, 'You strike', (i) => weaknessMultiplier(enemyDefs[i], 'physical'), 'physical');
        break;
      case 'skill': {
        const skill = SKILLS[player.action.skillId ?? 'keepers-strike'] ?? SKILLS['keepers-strike'];
        spirit = Math.max(0, spirit - skill.spiritCost);
        resolveOffensiveHits(skill.power, "Keeper's Strike hits", (i) => weaknessMultiplier(enemyDefs[i], skill.damageType), skill.damageType);
        break;
      }
      case 'item':
        break; // fully handled by consumeItems() above
      case 'defend':
        log.push(`${player.uid} braces, ready to absorb the next blow.`);
        break;
      case 'flee':
        // Individual flee has no defined meaning in a party fight yet (Endless Battle uses a group
        // continue/withdraw vote instead; PvP forfeit is Phase D's own concern) - treated as
        // Defend for now rather than inventing solo-flee semantics that don't fit a shared-enemy-
        // roster fight.
        log.push(`${player.uid} has nowhere to flee to and braces instead.`);
        break;
      case 'lanternAbility': {
        // Ownership/oil-sufficiency is validated by the caller (submitPartyBattleAction) before
        // this ever gets called - abilityId resolving to nothing here would mean that check was
        // skipped, not a real in-game case, so this is just a defensive no-op rather than a log
        // line a player could ever actually see.
        const ability = player.action.abilityId ? LANTERN_ABILITIES[player.action.abilityId] : undefined;
        if (!ability) break;
        lanternOil = Math.max(0, lanternOil - ability.oilCost);
        if (ability.category === 'offensive') {
          resolveOffensiveHits(
            ability.power ?? 0,
            `${ability.name} sears`,
            (i) => (ability.effectiveAgainstFamilies?.includes(enemyDefs[i].family) ? 1.5 : 1) * weaknessMultiplier(enemyDefs[i], 'lantern'),
            'lantern',
          );
        } else if (ability.category === 'healing') {
          const healed = Math.min(player.stats.maxHp - hp, ability.healHp ?? 0);
          hp = Math.min(player.stats.maxHp, hp + (ability.healHp ?? 0));
          log.push(`${ability.name} draws on the lantern's warmth, restoring ${healed} HP.`);
        } else {
          log.push(`${ability.name} wraps ${player.uid} in the lantern's glow, ready to blunt the next blow.`);
        }
        break;
      }
    }
  }

  hp = applyAilmentTickDamage(hp, player.stats.maxHp, ailments, log);
  ailments = expireAilments(ailments, inflictedThisTurn);

  return { log, enemyHp, hits, hp, spirit, lanternOil, ailments, itemConsumedIds, defending };
}

export interface PvpDefenderInput {
  hp: number;
  maxHp: number;
  defense: number;
}

/** PvP only ever has one possible target, so this is singular where the party engine's
 *  PartyCombatHitResult carries a targetIndex - the client's hit-animation wiring (Phase F of the
 *  Multiplayer Battle System plan) always plays this against the sole opponent slot. */
export interface PvpHitResult {
  damage: number;
  missed: boolean;
  defeated: boolean;
}

export interface PvpTurnResult {
  log: string[];
  hp: number;
  spirit: number;
  lanternOil: number;
  ailments: ActiveAilment[];
  itemConsumedIds: string[];
  defending: boolean;
  /** The opponent's hp after this turn's attack - unchanged from `defender.hp` on a Defend/item/
   *  forfeit turn, since only an offensive action ever touches the opponent. */
  defenderHp: number;
  /** Structured record of the offensive swing this turn, if any - null on Defend/item/forfeit/
   *  stunned turns (nothing was thrown at the opponent to animate). */
  hit: PvpHitResult | null;
  /** True only for a 'flee' action - PvP is 1-on-1, so unlike a party fight against shared enemies
   *  (where individual flee has no defined meaning - see resolvePartyPlayerTurn's 'flee' case),
   *  forfeiting here has a real, immediate effect: the match ends in the opponent's favor. */
  forfeited: boolean;
}

/** Resolves exactly one player's turn in a 1-on-1 PvP duel against the given live opponent (hp/
 *  defense snapshotted onto the battle doc, same as every other participant - see
 *  PartyBattleParticipantStats). Deliberately its own function rather than a thin wrapper around
 *  resolvePartyPlayerTurn: that function's damage math targets an *enemy* board (stats derived
 *  from scaledEnemyStats/ENEMIES data), where a PvP opponent is a real player with their own
 *  attack/defense - the two aren't interchangeable inputs. Mirrors resolvePartyPlayerTurn's
 *  item/attack/skill/defend structure closely (including its own consumeItems), the same
 *  parallel-structure tradeoff this file's top comment already accepts between this engine and
 *  combatEngine.ts, rather than forcing a shared helper through both single-target and
 *  enemy-board shapes. */
export function resolvePvpTurn(player: PartyPlayerInput, defender: PvpDefenderInput): PvpTurnResult {
  const log: string[] = [];
  let hp = player.stats.hp;
  let spirit = player.stats.spirit;
  let lanternOil = player.stats.lanternOil;
  let ailments = player.ailments.map((a) => ({ ...a }));
  const inflictedThisTurn = new Set<string>();
  const itemConsumedIds: string[] = [];
  const isDefensiveLanternAbility =
    player.action.type === 'lanternAbility' &&
    !!player.action.abilityId &&
    LANTERN_ABILITIES[player.action.abilityId]?.category === 'defensive';
  const defending = player.action.type === 'defend' || isDefensiveLanternAbility;
  let forfeited = false;
  let defenderHp = defender.hp;
  let hit: PvpHitResult | null = null;

  function damageDefender(dmg: number, verb: string): void {
    defenderHp = Math.max(0, defenderHp - dmg);
    const defeated = defenderHp <= 0;
    log.push(`${verb} your opponent for ${dmg} damage.`);
    if (defeated) log.push('Your opponent is defeated!');
    hit = { damage: dmg, missed: false, defeated };
  }

  function resolveOffensiveHit(power: number, verb: string, damageType: DamageType) {
    const attackMultiplier = ailmentAttackMultiplier(ailments);
    const blindChance = damageType === 'physical' ? blindMissChance(ailments) : 0;
    if (blindChance > 0 && Math.random() < blindChance) {
      log.push('Your attack goes wide - miss!');
      hit = { damage: 0, missed: true, defeated: false };
      return;
    }
    const dmg = Math.round(computeDamage(power, player.stats.attack * attackMultiplier, defender.defense));
    damageDefender(dmg, verb);
  }

  function consumeItems() {
    const itemIds = player.action.itemIds ?? [];
    const counts = new Map<string, number>();
    for (const id of itemIds.slice(0, 3)) counts.set(id, (counts.get(id) ?? 0) + 1);

    for (const [itemId, count] of counts) {
      const def = ITEMS[itemId];
      if (!def?.effect) continue;
      for (let n = 0; n < count; n++) itemConsumedIds.push(itemId);

      if (def.effect.cureAilmentId) {
        const idx = ailments.findIndex((a) => a.ailmentId === def.effect!.cureAilmentId);
        if (idx >= 0) {
          const curedName = AILMENTS[def.effect.cureAilmentId]?.name ?? def.effect.cureAilmentId;
          ailments = ailments.filter((_, i) => i !== idx);
          log.push(`You use ${itemId.replace(/-/g, ' ')} and cure ${curedName}.`);
        }
      }
      for (let n = 0; n < count; n++) {
        if (def.effect.healHpPercent) hp = Math.min(player.stats.maxHp, hp + Math.round(player.stats.maxHp * def.effect.healHpPercent));
        if (def.effect.healSpiritPercent) {
          spirit = Math.min(player.stats.maxSpirit, spirit + Math.round(player.stats.maxSpirit * def.effect.healSpiritPercent));
        }
        if (def.effect.restoreOilPercent) {
          lanternOil = Math.min(player.stats.maxLanternOil, lanternOil + Math.round(player.stats.maxLanternOil * def.effect.restoreOilPercent));
        }
      }
    }
  }

  if (isStunned(ailments)) {
    log.push('You are stunned and cannot act!');
  } else {
    consumeItems();
    switch (player.action.type) {
      case 'attack':
        resolveOffensiveHit(SKILLS.attack.power, 'You strike', 'physical');
        break;
      case 'skill': {
        const skill = SKILLS[player.action.skillId ?? 'keepers-strike'] ?? SKILLS['keepers-strike'];
        spirit = Math.max(0, spirit - skill.spiritCost);
        resolveOffensiveHit(skill.power, "Keeper's Strike hits", skill.damageType);
        break;
      }
      case 'item':
        break; // fully handled by consumeItems() above
      case 'defend':
        log.push('You brace, ready to absorb the next blow.');
        break;
      case 'flee':
        forfeited = true;
        log.push('You forfeit the match.');
        break;
      case 'lanternAbility': {
        // Ownership/oil-sufficiency is validated by the caller (submitPartyBattleAction) before
        // this ever gets called - see resolvePartyPlayerTurn's matching comment.
        const ability = player.action.abilityId ? LANTERN_ABILITIES[player.action.abilityId] : undefined;
        if (!ability) break;
        lanternOil = Math.max(0, lanternOil - ability.oilCost);
        if (ability.category === 'offensive') {
          // No family-effectiveness/weakness bonus here, unlike resolvePartyPlayerTurn's version -
          // those are enemy-def concepts (family, weaknessDamageType) that don't exist for a
          // player opponent.
          resolveOffensiveHit(ability.power ?? 0, `${ability.name} sears`, 'lantern');
        } else if (ability.category === 'healing') {
          const healed = Math.min(player.stats.maxHp - hp, ability.healHp ?? 0);
          hp = Math.min(player.stats.maxHp, hp + (ability.healHp ?? 0));
          log.push(`${ability.name} draws on the lantern's warmth, restoring ${healed} HP.`);
        } else {
          log.push(`${ability.name} wraps you in the lantern's glow, ready to blunt the next blow.`);
        }
        break;
      }
    }
  }

  hp = applyAilmentTickDamage(hp, player.stats.maxHp, ailments, log);
  ailments = expireAilments(ailments, inflictedThisTurn);

  return { log, hp, spirit, lanternOil, ailments, itemConsumedIds, defending, defenderHp, hit, forfeited };
}

export interface PartyEnemyHitResult {
  attackerIndex: number;
  targetUid: string;
  damage: number;
  missed: boolean;
  wasDefended: boolean;
  logLine: string;
}

export interface PartyEnemyPhasePlayerState {
  uid: string;
  hp: number;
  maxHp: number;
  defense: number;
  ailments: ActiveAilment[];
  defending: boolean;
}

export interface PartyEnemyPhasePlayerResult {
  uid: string;
  hp: number;
  ailments: ActiveAilment[];
}

export interface PartyEnemyPhaseResult {
  log: string[];
  players: PartyEnemyPhasePlayerResult[];
  enemyHits: PartyEnemyHitResult[];
}

const ENEMY_MISS_CHANCE = 0.1;

/** combatEngine.ts's CROWD_DAMAGE_FACTOR dampens each non-boss enemy's damage because *one*
 *  player faces every alive enemy's attack every round. In a party, that same imbalance doesn't
 *  scale the same way - damage is already spread across whichever player each enemy happens to
 *  target, so a party of P players facing E enemies isn't automatically P times harder the way a
 *  solo player facing E enemies is. Deliberately reusing the *same* per-enemy-count table (not
 *  inventing a second axis) for this reason - real balance tuning happens once Endless Battle
 *  actually gets played, not by guessing a party-size formula with nothing to verify it against
 *  yet. */
const CROWD_DAMAGE_FACTOR: Record<number, number> = { 1: 1, 2: 0.3, 3: 0.25, 4: 0.2, 5: 0.15, 6: 0.1 };

/** Resolves every alive enemy's attack once, called after every party member has had their turn
 *  this round (see this file's own top comment) - each enemy independently picks a random alive
 *  player to target (per the design doc's "naturally distribute attacks across the party"),
 *  applying that player's own Defend status and ailment tick damage the same way solo combat
 *  would. Only `players` passed in are eligible targets - a caller filters to alive party members
 *  before calling this. */
export function resolvePartyEnemyPhase(
  players: PartyEnemyPhasePlayerState[],
  enemies: RoundEnemyInput[],
): PartyEnemyPhaseResult {
  const log: string[] = [];
  const enemyHits: PartyEnemyHitResult[] = [];
  const enemyDefs = enemies.map((e) => ENEMIES[e.enemyId]);
  const enemyStats = enemies.map((e, i) => scaledEnemyStats(enemyDefs[i], e.level));
  const aliveNonBossEnemyCount = enemies.filter((e, i) => e.hp > 0 && enemyDefs[i].tier !== 'boss').length;

  const hpByUid = new Map(players.map((p) => [p.uid, p.hp]));
  const ailmentsByUid = new Map(players.map((p) => [p.uid, p.ailments.map((a) => ({ ...a }))]));
  const inflictedThisPhaseByUid = new Map(players.map((p) => [p.uid, new Set<string>()]));

  function pickTargetUid(): string | undefined {
    const alive = players.filter((p) => (hpByUid.get(p.uid) ?? 0) > 0);
    if (alive.length === 0) return undefined;
    return alive[Math.floor(Math.random() * alive.length)].uid;
  }

  enemies.forEach((enemy, i) => {
    if (enemy.hp <= 0) return;
    const targetUid = pickTargetUid();
    if (!targetUid) return;
    const def = enemyDefs[i];
    const stats = enemyStats[i];
    const target = players.find((p) => p.uid === targetUid)!;

    if (Math.random() < ENEMY_MISS_CHANCE) {
      const missLogLine = `${def.name}'s attack goes wide - miss!`;
      enemyHits.push({ attackerIndex: i, targetUid, damage: 0, missed: true, wasDefended: false, logLine: missLogLine });
      log.push(missLogLine);
      return;
    }

    const hpFraction = enemy.hp / stats.maxHp;
    const move = pickEnemyMove(def, hpFraction);
    const skill = SKILLS[move.skillId] ?? SKILLS.attack;
    let dmg = computeDamage(skill.power, stats.attack, target.defense);
    if (def.tier !== 'boss') {
      const crowdFactor = CROWD_DAMAGE_FACTOR[Math.min(6, aliveNonBossEnemyCount)] ?? 1;
      dmg = Math.max(1, Math.round(dmg * crowdFactor));
    }
    if (target.defending) dmg = Math.round(dmg / 2);
    hpByUid.set(targetUid, Math.max(0, hpByUid.get(targetUid)! - dmg));
    const attackLogLine = `${def.name} uses ${move.skillId.replace(/-/g, ' ')} on ${targetUid} for ${dmg} damage${
      target.defending ? ' (halved - defended)' : ''
    }.`;
    enemyHits.push({ attackerIndex: i, targetUid, damage: dmg, missed: false, wasDefended: target.defending, logLine: attackLogLine });
    log.push(attackLogLine);

    if (skill.inflictsAilmentId && Math.random() < (skill.inflictAilmentChance ?? 0)) {
      const ailments = ailmentsByUid.get(targetUid)!;
      ailmentsByUid.set(targetUid, inflictAilment(ailments, skill.inflictsAilmentId, log));
      inflictedThisPhaseByUid.get(targetUid)!.add(skill.inflictsAilmentId);
    }
  });

  return {
    log,
    players: players.map((p) => ({
      uid: p.uid,
      hp: hpByUid.get(p.uid)!,
      ailments: expireAilments(ailmentsByUid.get(p.uid)!, inflictedThisPhaseByUid.get(p.uid)!),
    })),
    enemyHits,
  };
}
