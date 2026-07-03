export interface JournalEntry {
  id: string;
  title: string;
  body: string;
  unlockedAt: number;
}

export interface JournalState {
  creaturesDiscovered: string[];
  locationsVisited: string[];
  loreUnlocked: string[];
  bossesDefeated: string[];
}
