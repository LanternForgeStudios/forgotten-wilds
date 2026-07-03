export type LocationKind = 'town' | 'overworld' | 'dungeon';

export interface EncounterTableEntry {
  enemyId: string;
  weight: number;
}

export interface Location {
  id: string;
  name: string;
  kind: LocationKind;
  description: string;
  mapAssetId: string;
  battleBackgroundAssetId: string;
  encounterTable: EncounterTableEntry[];
  npcIds: string[];
}
