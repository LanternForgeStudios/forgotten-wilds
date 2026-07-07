export interface DialogueLine {
  speaker: string;
  text: string;
}

/** One alternate dialogue script for an NPC, shown once a specific quest they're tied to is
 *  completed - lets the same NPC's lines evolve as the story advances instead of staying static. */
export interface NpcDialogueVariant {
  /** One of this NPC's own gameplayHook.questIds. */
  questId: string;
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
