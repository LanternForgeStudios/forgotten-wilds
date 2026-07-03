export interface DialogueLine {
  speaker: string;
  text: string;
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
  dialogue: DialogueLine[];
  gameplayHook: NpcGameplayHook;
}
