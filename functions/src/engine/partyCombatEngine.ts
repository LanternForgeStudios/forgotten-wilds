// Party/PvP combat resolution for the Multiplayer Battle System (NewClaudeAsk.txt's "Multiplayer
// Battle System Design" - Endless Battle and casual PvP). A PARALLEL engine to combatEngine.ts,
// not a rewrite of it - solo quest combat never routes through here. The two engines share their
// core damage/ailment math via combatMath.ts so they can't silently drift on how a hit is computed
// (see that file's own doc comment); everything specific to "more than one player" - turn order
// across N players, which player an enemy targets, per-player Defend, party-size-aware crowd
// damage - lives only here, since combatEngine.ts's RoundInput/RoundResult are hardcoded to
// exactly one player and were never actually generic (see src/multiplayer/party.ts's comment
// claiming otherwise - that claim was wrong, this file is the real generalization).

import { ENEMIES, type EnemyDefinition } from '../data/enemies';
import { SKILLS, type DamageType } from '../data/skills';
import { ITEMS } from '../data/items';
import { AILMENTS } from '../data/ailments';
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
  rollInitiative,
} from './combatMath';
import type { ActiveAilment, CombatAction, Stats } from '../shared-types';

export interface PartyPlayerInput {
  uid: string;
  action: CombatAction;
  stats: Stats;
  inventory: { itemId: string; quantity: number }[];
  ailments: ActiveAilment[];
}

export interface PartyRoundInput {
  /** Only players with hp > 0 take a turn or can be targeted by an enemy this round - a downed
   *  player stays in this array (so the caller can still render them) but is otherwise inert. */
  players: PartyPlayerInput[];
  enemies: RoundEnemyInput[];
}

export type PartyRoundPhase = 'continue' | 'victory' | 'partyDefeated';

export interface PartyCombatHitResult {
  uid: string;
  targetIndex: number;
  damage: number;
  missed: boolean;
  defeated: boolean;
}

export interface PartyEnemyHitResult {
  attackerIndex: number;
  targetUid: string;
  damage: number;
  missed: boolean;
  wasDefended: boolean;
  logLine: string;
}

export interface PartyPlayerResult {
  uid: string;
  hp: number;
  spirit: number;
  lanternOil: number;
  ailments: ActiveAilment[];
  itemConsumedIds: string[];
}

export interface PartyRoundResult {
  log: string[];
  players: PartyPlayerResult[];
  enemyHp: number[];
  phase: PartyRoundPhase;
  hits: PartyCombatHitResult[];
  enemyHits: PartyEnemyHitResult[];
}

const TARGET_ALL_MISS_CHANCE = 0.15;
const TARGET_ALL_DAMAGE_FACTOR = 0.6;
const ENEMY_MISS_CHANCE = 0.1;

/** combatEngine.ts's CROWD_DAMAGE_FACTOR dampens each non-boss enemy's damage because *one*
 *  player faces every alive enemy's attack every round. In a party, that same imbalance doesn't
 *  scale the same way - damage is already spread across whichever player each enemy happens to
 *  target (see pickEnemyTargetUid), so a party of P players facing E enemies isn't automatically
 *  P times harder the way a solo player facing E enemies is. Deliberately reusing the *same*
 *  per-enemy-count table (not inventing a second axis) for this reason - real balance tuning
 *  happens once Phase C's actual wave content exists to playtest against, not by guessing a
 *  party-size formula with nothing to verify it against yet. */
const CROWD_DAMAGE_FACTOR: Record<number, number> = { 1: 1, 2: 0.3, 3: 0.25, 4: 0.2, 5: 0.15, 6: 0.1 };

function weaknessMultiplier(enemy: EnemyDefinition, damageType: DamageType): number {
  return enemy.weaknessDamageType === damageType ? 1.5 : 1;
}

export function resolvePartyRound(input: PartyRoundInput): PartyRoundResult {
  const log: string[] = [];

  const enemyHp = input.enemies.map((e) => e.hp);
  const enemyDefs = input.enemies.map((e) => ENEMIES[e.enemyId]);
  const enemyStats = input.enemies.map((e, i) => scaledEnemyStats(enemyDefs[i], e.level));
  const isEnemyAlive = (i: number) => enemyHp[i] > 0;
  const aliveEnemyIndices = () => enemyHp.map((_, i) => i).filter(isEnemyAlive);
  const aliveNonBossEnemyCount = () => aliveEnemyIndices().filter((i) => enemyDefs[i].tier !== 'boss').length;

  // Per-player working state, keyed by uid - each player's hp/spirit/oil/ailments/defending status
  // only ever affects hits ON that same player, unlike solo combat's single implicit "the player."
  const hpByUid = new Map(input.players.map((p) => [p.uid, p.stats.hp]));
  const spiritByUid = new Map(input.players.map((p) => [p.uid, p.stats.spirit]));
  const oilByUid = new Map(input.players.map((p) => [p.uid, p.stats.lanternOil]));
  const ailmentsByUid = new Map(input.players.map((p) => [p.uid, p.ailments.map((a) => ({ ...a }))]));
  const inflictedThisRoundByUid = new Map(input.players.map((p) => [p.uid, new Set<string>()]));
  const itemConsumedByUid = new Map<string, string[]>(input.players.map((p) => [p.uid, []]));
  // Decided up front, from each player's submitted action alone - NOT set mid-loop as each
  // player's own turn resolves - so a player's Defend this round halves an enemy's attack on them
  // consistently regardless of turn-order/speed (an enemy faster than every player would otherwise
  // attack before any player's turn had a chance to "activate" their own Defend). Mirrors
  // combatEngine.ts's resolveRound's own documented reasoning for playerDefending, generalized to
  // one flag per player instead of one flag for the whole round.
  // Individual flee has no defined meaning in a party fight yet (see the 'flee' case in
  // playerTurn) - treated as Defend here too, for the same reason.
  const defendingByUid = new Map(input.players.map((p) => [p.uid, p.action.type === 'defend' || p.action.type === 'flee']));
  const hits: PartyCombatHitResult[] = [];
  const enemyHits: PartyEnemyHitResult[] = [];

  const isPlayerAlive = (uid: string) => (hpByUid.get(uid) ?? 0) > 0;
  const alivePlayers = () => input.players.filter((p) => isPlayerAlive(p.uid));

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

  function resolveOffensiveHits(
    player: PartyPlayerInput,
    power: number,
    verb: string,
    bonusMultiplier: (enemyIdx: number) => number,
    damageType: DamageType,
  ) {
    const ailments = ailmentsByUid.get(player.uid)!;
    const attackMultiplier = ailmentAttackMultiplier(ailments);
    const blindChance = damageType === 'physical' ? blindMissChance(ailments) : 0;
    const alive = aliveEnemyIndices();
    const useAll = !!player.action.targetAll && alive.length > 1;
    const targets = useAll
      ? alive
      : [resolveTargetIndex(player.action.targetIndex)].filter((i): i is number => i !== undefined);

    for (const i of targets) {
      const missedTargetAll = useAll && Math.random() < TARGET_ALL_MISS_CHANCE;
      const missedBlind = blindChance > 0 && Math.random() < blindChance;
      if (missedTargetAll || missedBlind) {
        log.push(`${player.uid}'s attack on ${enemyDefs[i].name} goes wide - miss!`);
        hits.push({ uid: player.uid, targetIndex: i, damage: 0, missed: true, defeated: false });
        continue;
      }
      let dmg = Math.round(
        computeDamage(power, player.stats.attack * attackMultiplier, enemyStats[i].defense) * bonusMultiplier(i),
      );
      if (useAll) dmg = Math.max(1, Math.round(dmg * TARGET_ALL_DAMAGE_FACTOR));
      const defeated = damageEnemy(i, dmg, verb);
      hits.push({ uid: player.uid, targetIndex: i, damage: dmg, missed: false, defeated });
    }
  }

  function consumeItems(player: PartyPlayerInput) {
    const itemIds = player.action.itemIds ?? [];
    const counts = new Map<string, number>();
    for (const id of itemIds.slice(0, 3)) counts.set(id, (counts.get(id) ?? 0) + 1);
    const consumed = itemConsumedByUid.get(player.uid)!;

    for (const [itemId, count] of counts) {
      const def = ITEMS[itemId];
      if (!def?.effect) continue;
      for (let n = 0; n < count; n++) consumed.push(itemId);

      if (def.effect.cureAilmentId) {
        const ailments = ailmentsByUid.get(player.uid)!;
        const idx = ailments.findIndex((a) => a.ailmentId === def.effect!.cureAilmentId);
        if (idx >= 0) {
          const curedName = AILMENTS[def.effect.cureAilmentId]?.name ?? def.effect.cureAilmentId;
          ailmentsByUid.set(
            player.uid,
            ailments.filter((_, i) => i !== idx),
          );
          log.push(`${player.uid} uses ${itemId.replace(/-/g, ' ')} and cures ${curedName}.`);
        }
      }

      for (let n = 0; n < count; n++) {
        if (def.effect.healHpPercent) {
          const hp = hpByUid.get(player.uid)!;
          hpByUid.set(player.uid, Math.min(player.stats.maxHp, hp + Math.round(player.stats.maxHp * def.effect.healHpPercent)));
        }
        if (def.effect.healSpiritPercent) {
          const spirit = spiritByUid.get(player.uid)!;
          spiritByUid.set(
            player.uid,
            Math.min(player.stats.maxSpirit, spirit + Math.round(player.stats.maxSpirit * def.effect.healSpiritPercent)),
          );
        }
        if (def.effect.restoreOilPercent) {
          const oil = oilByUid.get(player.uid)!;
          oilByUid.set(
            player.uid,
            Math.min(player.stats.maxLanternOil, oil + Math.round(player.stats.maxLanternOil * def.effect.restoreOilPercent)),
          );
        }
      }
    }
  }

  function playerTurn(player: PartyPlayerInput) {
    const action = player.action;
    switch (action.type) {
      case 'attack':
        resolveOffensiveHits(player, SKILLS.attack.power, `${player.uid} strikes`, (i) => weaknessMultiplier(enemyDefs[i], 'physical'), 'physical');
        break;
      case 'skill': {
        const skill = SKILLS[action.skillId ?? 'keepers-strike'] ?? SKILLS['keepers-strike'];
        spiritByUid.set(player.uid, Math.max(0, spiritByUid.get(player.uid)! - skill.spiritCost));
        resolveOffensiveHits(
          player,
          skill.power,
          `${player.uid}'s ${skill.id} hits`,
          (i) => weaknessMultiplier(enemyDefs[i], skill.damageType),
          skill.damageType,
        );
        break;
      }
      case 'item':
        break; // fully handled by consumeItems(), called unconditionally before this switch
      case 'defend':
        log.push(`${player.uid} braces, ready to absorb the next blow.`);
        break;
      case 'flee':
        // Individual flee has no defined meaning in a party fight yet (Endless Battle uses a
        // group continue/withdraw vote instead - see the Phase C plan; PvP forfeit is Phase D's
        // own concern) - treated as Defend for now rather than inventing solo-flee semantics that
        // don't fit a shared-enemy-roster fight (see the up-front defendingByUid computation below).
        log.push(`${player.uid} has nowhere to flee to and braces instead.`);
        break;
      case 'lanternAbility':
        // Lantern abilities are deferred to whichever of Phase C/D first needs them in practice -
        // no current spec calls for them, and resolving one requires per-player lantern-equip
        // state this input doesn't carry yet.
        log.push(`${player.uid}'s lantern flickers, but its ability isn't usable in a party fight yet.`);
        break;
    }
  }

  function pickEnemyTargetUid(): string | undefined {
    // Naturally distributes attacks across the party (per the design doc) - uniform random choice
    // among currently-alive players, independently per attacking enemy. A future enemy-specific
    // "priority target" mechanic would override this per-enemy, not change the default here.
    const candidates = alivePlayers();
    if (candidates.length === 0) return undefined;
    return candidates[Math.floor(Math.random() * candidates.length)].uid;
  }

  function enemyAttack(i: number) {
    if (!isEnemyAlive(i)) return;
    const targetUid = pickEnemyTargetUid();
    if (!targetUid) return;
    const def = enemyDefs[i];
    const stats = enemyStats[i];

    if (Math.random() < ENEMY_MISS_CHANCE) {
      const missLogLine = `${def.name}'s attack goes wide - miss!`;
      enemyHits.push({ attackerIndex: i, targetUid, damage: 0, missed: true, wasDefended: false, logLine: missLogLine });
      log.push(missLogLine);
      return;
    }

    const hpFraction = enemyHp[i] / stats.maxHp;
    const move = pickEnemyMove(def, hpFraction);
    const skill = SKILLS[move.skillId] ?? SKILLS.attack;
    const targetDefense = input.players.find((p) => p.uid === targetUid)!.stats.defense;
    let dmg = computeDamage(skill.power, stats.attack, targetDefense);
    if (def.tier !== 'boss') {
      const crowdFactor = CROWD_DAMAGE_FACTOR[Math.min(6, aliveNonBossEnemyCount())] ?? 1;
      dmg = Math.max(1, Math.round(dmg * crowdFactor));
    }
    const targetDefending = defendingByUid.get(targetUid) ?? false;
    if (targetDefending) dmg = Math.round(dmg / 2);
    hpByUid.set(targetUid, Math.max(0, hpByUid.get(targetUid)! - dmg));
    const attackLogLine = `${def.name} uses ${move.skillId.replace(/-/g, ' ')} on ${targetUid} for ${dmg} damage${
      targetDefending ? ' (halved - defended)' : ''
    }.`;
    enemyHits.push({ attackerIndex: i, targetUid, damage: dmg, missed: false, wasDefended: targetDefending, logLine: attackLogLine });
    log.push(attackLogLine);

    if (skill.inflictsAilmentId && Math.random() < (skill.inflictAilmentChance ?? 0)) {
      const ailments = ailmentsByUid.get(targetUid)!;
      ailmentsByUid.set(targetUid, inflictAilment(ailments, skill.inflictsAilmentId, log));
      inflictedThisRoundByUid.get(targetUid)!.add(skill.inflictsAilmentId);
    }
  }

  // Turn order: every alive player + every alive enemy rolls initiative, sorted descending -
  // structurally identical to solo combat's own turn loop, just with N player entries instead of
  // exactly 1.
  type Turn = { kind: 'player'; player: PartyPlayerInput; roll: number } | { kind: 'enemy'; index: number; roll: number };
  const turns: Turn[] = [
    ...alivePlayers().map((p): Turn => ({ kind: 'player', player: p, roll: rollInitiative(p.stats.speed) })),
    ...aliveEnemyIndices().map((i): Turn => ({ kind: 'enemy', index: i, roll: rollInitiative(enemyStats[i].speed) })),
  ];
  turns.sort((a, b) => b.roll - a.roll);

  for (const turn of turns) {
    if (aliveEnemyIndices().length === 0) break;
    if (turn.kind === 'enemy') {
      if (isEnemyAlive(turn.index)) enemyAttack(turn.index);
      continue;
    }
    const { player } = turn;
    if (!isPlayerAlive(player.uid)) continue; // downed mid-round by an earlier enemy turn

    const ailments = ailmentsByUid.get(player.uid)!;
    if (isStunned(ailments)) {
      log.push(`${player.uid} is stunned and cannot act!`);
    } else {
      consumeItems(player);
      playerTurn(player);
    }
    const hp = hpByUid.get(player.uid)!;
    hpByUid.set(player.uid, applyAilmentTickDamage(hp, player.stats.maxHp, ailmentsByUid.get(player.uid)!, log));
  }

  const players: PartyPlayerResult[] = input.players.map((p) => ({
    uid: p.uid,
    hp: hpByUid.get(p.uid)!,
    spirit: spiritByUid.get(p.uid)!,
    lanternOil: oilByUid.get(p.uid)!,
    ailments: expireAilments(ailmentsByUid.get(p.uid)!, inflictedThisRoundByUid.get(p.uid)!),
    itemConsumedIds: itemConsumedByUid.get(p.uid)!,
  }));

  const allEnemiesDefeated = enemyHp.every((hp) => hp <= 0);
  const allPlayersDown = players.every((p) => p.hp <= 0);
  let phase: PartyRoundPhase = 'continue';
  if (allEnemiesDefeated) phase = 'victory';
  else if (allPlayersDown) phase = 'partyDefeated';

  return { log, players, enemyHp, phase, hits, enemyHits };
}
