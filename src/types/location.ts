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
  /** Whether this location shows up as a Fast Travel destination once discovered. True for the
   *  main hubs/routes (town squares, trails, dungeons); false for small interiors (a single house
   *  or shop) that aren't worth a direct-travel entry of their own. */
  fastTravel: boolean;
  /** For a sub-location (a building interior) - the main area it's nested under in the Journal of
   *  Legends. Omitted for main areas themselves. */
  parentLocationId?: string;
  /** Which building-marker icon/label the mini-map should use for this location's entrance, if
   *  it's specifically a shop/inn/apothecary (per the mini-map spec's explicit callouts for those
   *  three). Omitted means "just a generic building" - still shown as a building marker, just not
   *  tagged as one of the three special kinds. */
  buildingKind?: 'shop' | 'inn' | 'apothecary';
}
