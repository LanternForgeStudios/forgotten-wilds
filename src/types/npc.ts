export interface DialogueLine {
  speaker: string;
  text: string;
}

/** One alternate dialogue script for an NPC, shown once a specific quest they're tied to is
 *  completed - lets the same NPC's lines evolve as the story advances instead of staying static. */
export interface NpcDialogueVariant {
  /** One of this NPC's own gameplayHook.questIds. */
  questId: string;
  /** When set, this is a "report back" variant: shown while `questId` is still ACTIVE (not yet
   *  completed), once this specific objective's requiresObjectiveIds are already satisfied but the
   *  objective itself hasn't been credited yet - i.e. the player just did the fetch/kill/shrine
   *  step elsewhere and is walking back to this NPC to turn it in. Without this, an NPC shows the
   *  exact same lines for "here's the job" and "I'm back, did it" (both happen while the same quest
   *  is active), since the ordinary completed-quest variant below can't distinguish the two - see
   *  resolveNpcDialogueVariantKey. Checked before every completed-quest variant, regardless of
   *  array order, since it reflects a more specific/immediate state. */
  reportForObjectiveId?: string;
  lines: DialogueLine[];
}

export type NpcGameplayHook =
  | { type: 'shop'; shopId: string }
  | { type: 'inn'; innId: string }
  | { type: 'questGiver'; questIds: string[] }
  | { type: 'lore' };

export interface Npc {
  id: string;
  name: string;
  title: string;
  spriteAssetId: string;
  portraitAssetId: string;
  locationId: string;
  /** Fallback - shown when no dialogueVariants exist yet, or none of their quests are completed. */
  dialogue: DialogueLine[];
  /** Ordered most-advanced-quest first; see resolveNpcDialogue (src/utils/npcDialogue.ts) for how
   *  the first matching one is picked. Omitted for single-quest/shop/inn/lore NPCs. */
  dialogueVariants?: NpcDialogueVariant[];
  gameplayHook: NpcGameplayHook;
}
