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
  applyAilmentResistance,
  applyAilmentTickDamage,
  blindMissChance,
  computeDamage,
  expireAilments,
  inflictAilment,
  isStunned,
  pickEnemyMove,
} from './combatMath';
import type { AilmentResistance, ActiveAilment, CombatAction, Stats } from '../shared-types';

export interface PartyPlayerInput {
  uid: string;
  /** Character display name - used only in log-line text (e.g. "Alys braces, ready to absorb the
   *  next blow."), never for game-logic identity (uid still owns that everywhere else). */
  name: string;
  action: CombatAction;
  stats: Stats;
  inventory: { itemId: string; quantity: number }[];
  ailments: ActiveAilment[];
  /** The equipped weapon's attack-ailment roll, already resolved by the caller (see
   *  equipmentEngine.ts's resolveWeaponAttackAilment) - mirrors RoundInput.attackAilment's solo
   *  equivalent. Stubbed: always undefined today. */
  attackAilment?: { id: string; chance: number };
}

export interface PartyCombatHitResult {
  uid: string;
  targetIndex: number;
  damage: number;
  missed: boolean;
  defeated: boolean;
  /** See combatEngine.ts's CombatHitResult.damageType - same generic-impact-FX purpose. */
  damageType: DamageType;
  /** See combatEngine.ts's CombatHitResult.ailmentInflicted. */
  ailmentInflicted?: string;
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
  /** Same as enemyHp - per-enemy ailments after this player's turn, same order/indices. */
  enemyAilments: ActiveAilment[][];
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

  // Per-enemy mirror of the player's own ailment tracking below - see combatEngine.ts's identical
  // inflictAilmentOnEnemy for the full reasoning (vulnerability-gated, never the ailment an enemy
  // inflicts on itself).
  const enemyAilments: ActiveAilment[][] = enemies.map((e) => e.ailments.map((a) => ({ ...a })));
  const inflictedThisTurnByEnemy: Set<string>[] = enemies.map(() => new Set());

  function inflictAilmentOnEnemy(i: number, ailmentId: string): boolean {
    if (!enemyDefs[i].vulnerableAilments.includes(ailmentId)) return false;
    const def = AILMENTS[ailmentId];
    if (!def) return false;
    const list = enemyAilments[i];
    const existingIndex = list.findIndex((a) => a.ailmentId === ailmentId);
    const entry: ActiveAilment =
      def.autoExpireAfterTurns === undefined ? { ailmentId } : { ailmentId, turnsRemaining: def.autoExpireAfterTurns };
    if (existingIndex >= 0) list[existingIndex] = entry;
    else list.push(entry);
    inflictedThisTurnByEnemy[i].add(ailmentId);
    log.push(`${enemyDefs[i].name} is afflicted with ${def.name}!`);
    return true;
  }

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

  function resolveOffensiveHits(
    power: number,
    verb: string,
    bonusMultiplier: (i: number) => number,
    damageType: DamageType,
    ailment?: { id: string; chance: number },
  ) {
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
        hits.push({ uid: player.uid, targetIndex: i, damage: 0, missed: true, defeated: false, damageType });
        continue;
      }
      let dmg = Math.round(computeDamage(power, player.stats.attack * attackMultiplier, enemyStats[i].defense) * bonusMultiplier(i));
      if (useAll) dmg = Math.max(1, Math.round(dmg * TARGET_ALL_DAMAGE_FACTOR));
      const defeated = damageEnemy(i, dmg, verb);
      const hit: PartyCombatHitResult = { uid: player.uid, targetIndex: i, damage: dmg, missed: false, defeated, damageType };
      hits.push(hit);
      if (ailment && !defeated && Math.random() < ailment.chance && inflictAilmentOnEnemy(i, ailment.id)) {
        hit.ailmentInflicted = ailment.id;
      }
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
    log.push(`${player.name} is stunned and cannot act!`);
  } else {
    consumeItems();
    switch (player.action.type) {
      case 'attack':
        resolveOffensiveHits(
          SKILLS.attack.power,
          'You strike',
          (i) => weaknessMultiplier(enemyDefs[i], 'physical'),
          'physical',
          player.attackAilment,
        );
        break;
      case 'skill': {
        const skill = SKILLS[player.action.skillId ?? 'keepers-strike'] ?? SKILLS['keepers-strike'];
        spirit = Math.max(0, spirit - skill.spiritCost);
        resolveOffensiveHits(
          skill.power,
          "Keeper's Strike hits",
          (i) => weaknessMultiplier(enemyDefs[i], skill.damageType),
          skill.damageType,
          skill.inflictsAilmentId ? { id: skill.inflictsAilmentId, chance: skill.inflictAilmentChance ?? 0 } : undefined,
        );
        break;
      }
      case 'item':
        break; // fully handled by consumeItems() above
      case 'defend':
        log.push(`${player.name} braces, ready to absorb the next blow.`);
        break;
      case 'flee':
        // Individual flee has no defined meaning in a party fight yet (Endless Battle uses a group
        // continue/withdraw vote instead; PvP forfeit is Phase D's own concern) - treated as
        // Defend for now rather than inventing solo-flee semantics that don't fit a shared-enemy-
        // roster fight.
        log.push(`${player.name} has nowhere to flee to and braces instead.`);
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
          log.push(`${ability.name} wraps ${player.name} in the lantern's glow, ready to blunt the next blow.`);
        }
        break;
      }
    }
  }

  hp = applyAilmentTickDamage(hp, player.stats.maxHp, ailments, log);
  ailments = expireAilments(ailments, inflictedThisTurn);
  const remainingEnemyAilments = enemyAilments.map((list, i) => expireAilments(list, inflictedThisTurnByEnemy[i]));

  return { log, enemyHp, enemyAilments: remainingEnemyAilments, hits, hp, spirit, lanternOil, ailments, itemConsumedIds, defending };
}

export interface PvpDefenderInput {
  hp: number;
  maxHp: number;
  defense: number;
  /** The opponent's ailments entering this turn - a landed Skill/weapon ailment roll (see
   *  resolveOffensiveHit's ailment param) is applied on top of these, same overwrite-on-reinflict
   *  semantics as everywhere else. */
  ailments: ActiveAilment[];
  /** The opponent's flattened equipped-item ailment resistance (see equipmentEngine.ts's
   *  computeAilmentResistances) - reduces the chance of a landed hit's ailment roll succeeding
   *  against them. Stubbed: always [] today. */
  ailmentResistances: AilmentResistance[];
}

/** PvP only ever has one possible target, so this is singular where the party engine's
 *  PartyCombatHitResult carries a targetIndex - the client's hit-animation wiring (Phase F of the
 *  Multiplayer Battle System plan) always plays this against the sole opponent slot. */
export interface PvpHitResult {
  damage: number;
  missed: boolean;
  defeated: boolean;
  /** See combatEngine.ts's CombatHitResult.damageType - same generic-impact-FX purpose. */
  damageType: DamageType;
  /** See combatEngine.ts's CombatHitResult.ailmentInflicted. */
  ailmentInflicted?: string;
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
  /** The opponent's ailments after this turn's attack (and their own tick/expiry - PvP has no
   *  separate "enemy phase" the way Endless Battle does, so a Skill/weapon landing an ailment and
   *  that opponent's own ailments ticking both happen relative to whichever player's turn this is
   *  - the tick itself is applied when it becomes *their* turn, via their own `ailments` input,
   *  same as any other participant). Unchanged from `defender.ailments` on a turn that never lands
   *  a new one. */
  defenderAilments: ActiveAilment[];
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
  // The opponent's ailment tracking - mirrors combatEngine.ts's/resolvePartyPlayerTurn's own
  // per-enemy inflictAilmentOnEnemy, just 3rd-person ("your opponent") and ungated by any
  // vulnerability allowlist (a human opponent has no EnemyDefinition.vulnerableAilments - only
  // their own equipped resistance can reduce the chance, see resolveOffensiveHit below).
  let defenderAilments = defender.ailments.map((a) => ({ ...a }));
  const inflictedThisTurnByDefender = new Set<string>();

  function inflictAilmentOnDefender(ailmentId: string): boolean {
    const def = AILMENTS[ailmentId];
    if (!def) return false;
    const existingIndex = defenderAilments.findIndex((a) => a.ailmentId === ailmentId);
    const entry: ActiveAilment =
      def.autoExpireAfterTurns === undefined ? { ailmentId } : { ailmentId, turnsRemaining: def.autoExpireAfterTurns };
    if (existingIndex >= 0) defenderAilments[existingIndex] = entry;
    else defenderAilments.push(entry);
    inflictedThisTurnByDefender.add(ailmentId);
    log.push(`Your opponent is afflicted with ${def.name}!`);
    return true;
  }

  function damageDefender(dmg: number, verb: string, damageType: DamageType): void {
    defenderHp = Math.max(0, defenderHp - dmg);
    const defeated = defenderHp <= 0;
    log.push(`${verb} your opponent for ${dmg} damage.`);
    if (defeated) log.push('Your opponent is defeated!');
    hit = { damage: dmg, missed: false, defeated, damageType };
  }

  // Mirrors resolveOffensiveHits'/resolveOffensiveHit's shared "ailment" param elsewhere - rolled
  // once per landed (non-missed), non-defeating hit, chance reduced by the opponent's own
  // equipped resistance (a no-op today, since no item sets ailmentResistance yet).
  function resolveOffensiveHit(power: number, verb: string, damageType: DamageType, ailment?: { id: string; chance: number }) {
    const attackMultiplier = ailmentAttackMultiplier(ailments);
    const blindChance = damageType === 'physical' ? blindMissChance(ailments) : 0;
    if (blindChance > 0 && Math.random() < blindChance) {
      log.push('Your attack goes wide - miss!');
      hit = { damage: 0, missed: true, defeated: false, damageType };
      return;
    }
    const dmg = Math.round(computeDamage(power, player.stats.attack * attackMultiplier, defender.defense));
    damageDefender(dmg, verb, damageType);
    if (
      ailment &&
      !hit?.defeated &&
      Math.random() < applyAilmentResistance(ailment.chance, ailment.id, defender.ailmentResistances) &&
      inflictAilmentOnDefender(ailment.id)
    ) {
      if (hit) hit.ailmentInflicted = ailment.id;
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
    log.push('You are stunned and cannot act!');
  } else {
    consumeItems();
    switch (player.action.type) {
      case 'attack':
        resolveOffensiveHit(SKILLS.attack.power, 'You strike', 'physical', player.attackAilment);
        break;
      case 'skill': {
        const skill = SKILLS[player.action.skillId ?? 'keepers-strike'] ?? SKILLS['keepers-strike'];
        spirit = Math.max(0, spirit - skill.spiritCost);
        resolveOffensiveHit(
          skill.power,
          "Keeper's Strike hits",
          skill.damageType,
          skill.inflictsAilmentId ? { id: skill.inflictsAilmentId, chance: skill.inflictAilmentChance ?? 0 } : undefined,
        );
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
  defenderAilments = expireAilments(defenderAilments, inflictedThisTurnByDefender);

  return { log, hp, spirit, lanternOil, ailments, itemConsumedIds, defending, defenderHp, defenderAilments, hit, forfeited };
}

export interface PartyEnemyHitResult {
  attackerIndex: number;
  targetUid: string;
  damage: number;
  missed: boolean;
  wasDefended: boolean;
  logLine: string;
  /** See combatEngine.ts's EnemyHitResult.damageType - same generic-impact-FX purpose. */
  damageType: DamageType;
  /** See combatEngine.ts's EnemyHitResult.ailmentInflicted. */
  ailmentInflicted?: string;
}

export interface PartyEnemyPhasePlayerState {
  uid: string;
  /** Character display name - used only in log-line text, same as PartyPlayerInput.name. */
  name: string;
  hp: number;
  maxHp: number;
  defense: number;
  ailments: ActiveAilment[];
  defending: boolean;
  /** This player's flattened equipped-item ailment resistance (see equipmentEngine.ts's
   *  computeAilmentResistances) - reduces the chance of an enemy's own move afflicting them.
   *  Stubbed: always [] today. */
  ailmentResistances: AilmentResistance[];
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
  /** Same as PartyPlayerTurnResult.enemyAilments - per-enemy ailments after this phase's own tick
   *  damage/expiry, same order/indices as the `enemies` input. */
  enemyAilments: ActiveAilment[][];
  /** Enemy hp after this phase's own ailment tick damage (Poison/Burn/Freeze can now defeat an
   *  enemy purely from ticking, independent of any player attack that round) - unchanged from the
   *  `enemies` input for an enemy with no damage-dealing ailment active. Same order/indices. */
  enemyHp: number[];
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

  // Per-enemy mirror of the above - an enemy's own ailments can now reduce its outgoing damage
  // (Burn), miss its own physical attack (Blind), skip its turn entirely (Stun), force it down to
  // its plain 'attack' move (Silence, same as it does to a player's Skill action), and tick real
  // damage against itself (Poison/Burn/Freeze) - matching combatEngine.ts's solo-fight parity.
  const enemyHp = enemies.map((e) => e.hp);
  const enemyAilmentsByIndex: ActiveAilment[][] = enemies.map((e) => e.ailments.map((a) => ({ ...a })));
  // Always stays empty in this function - nothing inflicts a *new* ailment on an enemy during the
  // enemy phase itself (that only happens on a player's own turn, see resolveOffensiveHits).
  // Threaded into expireAilments below anyway, for the same reason inflictedThisPhaseByUid is:
  // matching that helper's signature so a freshly-inflicted ailment (from the player phase just
  // before this one) isn't accidentally ticked down to 0 turns before it ever takes effect.
  const inflictedThisPhaseByEnemy: Set<string>[] = enemies.map(() => new Set());

  function pickTargetUid(): string | undefined {
    const alive = players.filter((p) => (hpByUid.get(p.uid) ?? 0) > 0);
    if (alive.length === 0) return undefined;
    return alive[Math.floor(Math.random() * alive.length)].uid;
  }

  enemies.forEach((_enemy, i) => {
    if (enemyHp[i] <= 0) return;
    const def = enemyDefs[i];
    const stats = enemyStats[i];

    if (enemyAilmentsByIndex[i].some((a) => a.ailmentId === 'stun')) {
      log.push(`${def.name} is stunned and cannot move!`);
    } else {
      const targetUid = pickTargetUid();
      if (targetUid) {
        const target = players.find((p) => p.uid === targetUid)!;
        const isSilenced = enemyAilmentsByIndex[i].some((a) => AILMENTS[a.ailmentId]?.effect.blocksSkill);
        const attackMultiplier = enemyAilmentsByIndex[i].reduce(
          (mult, a) => mult * (AILMENTS[a.ailmentId]?.effect.attackMultiplier ?? 1),
          1,
        );
        const blindChance = enemyAilmentsByIndex[i].some((a) => a.ailmentId === 'blind')
          ? 1 - (AILMENTS.blind.effect.physicalAccuracyMultiplier ?? 1)
          : 0;

        if (blindChance > 0 && Math.random() < blindChance) {
          const missLogLine = `${def.name}'s attack goes wide - miss! (Blind)`;
          enemyHits.push({ attackerIndex: i, targetUid, damage: 0, missed: true, wasDefended: false, logLine: missLogLine, damageType: 'physical' });
          log.push(missLogLine);
        } else if (Math.random() < ENEMY_MISS_CHANCE) {
          const missLogLine = `${def.name}'s attack goes wide - miss!`;
          enemyHits.push({ attackerIndex: i, targetUid, damage: 0, missed: true, wasDefended: false, logLine: missLogLine, damageType: 'physical' });
          log.push(missLogLine);
        } else {
          const hpFraction = enemyHp[i] / stats.maxHp;
          const moveSource = isSilenced ? { ...def, moves: def.moves.filter((m) => m.skillId === 'attack') } : def;
          const move = pickEnemyMove(moveSource.moves.length > 0 ? moveSource : def, hpFraction);
          const skill = SKILLS[move.skillId] ?? SKILLS.attack;
          let dmg = computeDamage(skill.power, stats.attack * attackMultiplier, target.defense);
          if (def.tier !== 'boss') {
            const crowdFactor = CROWD_DAMAGE_FACTOR[Math.min(6, aliveNonBossEnemyCount)] ?? 1;
            dmg = Math.max(1, Math.round(dmg * crowdFactor));
          }
          if (target.defending) dmg = Math.round(dmg / 2);
          hpByUid.set(targetUid, Math.max(0, hpByUid.get(targetUid)! - dmg));
          const attackLogLine = `${def.name} uses ${move.skillId.replace(/-/g, ' ')} on ${target.name} for ${dmg} damage${
            target.defending ? ' (halved - defended)' : ''
          }.`;
          const enemyHit: PartyEnemyHitResult = {
            attackerIndex: i,
            targetUid,
            damage: dmg,
            missed: false,
            wasDefended: target.defending,
            logLine: attackLogLine,
            damageType: skill.damageType,
          };
          enemyHits.push(enemyHit);
          log.push(attackLogLine);

          // target's own equipped-item resistance (see equipmentEngine.ts's
          // computeAilmentResistances) reduces the effective chance - a no-op today since no
          // authored item sets it yet.
          if (
            skill.inflictsAilmentId &&
            Math.random() < applyAilmentResistance(skill.inflictAilmentChance ?? 0, skill.inflictsAilmentId, target.ailmentResistances)
          ) {
            const ailments = ailmentsByUid.get(targetUid)!;
            ailmentsByUid.set(targetUid, inflictAilment(ailments, skill.inflictsAilmentId, log));
            inflictedThisPhaseByUid.get(targetUid)!.add(skill.inflictsAilmentId);
            enemyHit.ailmentInflicted = skill.inflictsAilmentId;
          }
        }
      }
    }

    for (const active of enemyAilmentsByIndex[i]) {
      if (enemyHp[i] <= 0) break;
      const tickDef = AILMENTS[active.ailmentId];
      if (!tickDef?.effect.damagePercentPerTurn) continue;
      const tickDmg = Math.max(1, Math.round(stats.maxHp * tickDef.effect.damagePercentPerTurn));
      enemyHp[i] = Math.max(0, enemyHp[i] - tickDmg);
      log.push(`${tickDef.name} deals ${tickDmg} damage to ${def.name}.`);
      if (enemyHp[i] <= 0) log.push(`${def.name} is defeated!`);
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
    enemyAilments: enemyAilmentsByIndex.map((list, i) => expireAilments(list, inflictedThisPhaseByEnemy[i])),
    enemyHp,
  };
}
