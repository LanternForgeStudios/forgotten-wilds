// Authoritative — the client's src/data/equipment.ts is a display copy only.

export type EquipmentSlot = 'weapon' | 'armor' | 'boots' | 'gloves' | 'charm' | 'lantern' | 'spiritTotem';

export interface StatBonuses {
  maxHp?: number;
  maxSpirit?: number;
  attack?: number;
  defense?: number;
  speed?: number;
}

export interface EquipmentDefinition {
  id: string;
  slot: EquipmentSlot;
  statBonuses: StatBonuses;
}

export const EQUIPMENT: Record<string, EquipmentDefinition> = {
  'miners-pick': { id: 'miners-pick', slot: 'weapon', statBonuses: { attack: 4 } },
  'keepers-lantern-staff': { id: 'keepers-lantern-staff', slot: 'weapon', statBonuses: { attack: 8, speed: 1 } },
  'travelers-coat': { id: 'travelers-coat', slot: 'armor', statBonuses: { defense: 4 } },
  'ironwood-vest': { id: 'ironwood-vest', slot: 'armor', statBonuses: { defense: 8, maxHp: 10 } },
  'worn-trail-boots': { id: 'worn-trail-boots', slot: 'boots', statBonuses: { speed: 2 } },
  'ridge-runner-boots': { id: 'ridge-runner-boots', slot: 'boots', statBonuses: { speed: 5 } },
  'frayed-gloves': { id: 'frayed-gloves', slot: 'gloves', statBonuses: { attack: 2 } },
  'miners-leather-gloves': { id: 'miners-leather-gloves', slot: 'gloves', statBonuses: { attack: 5, defense: 1 } },
  'ash-hallow-token': { id: 'ash-hallow-token', slot: 'charm', statBonuses: { maxSpirit: 8 } },
  'moonlit-charm': { id: 'moonlit-charm', slot: 'charm', statBonuses: { maxSpirit: 16 } },
  'keepers-lantern': { id: 'keepers-lantern', slot: 'lantern', statBonuses: { maxSpirit: 5 } },
  'miners-lost-lantern-equipped': {
    id: 'miners-lost-lantern-equipped',
    slot: 'lantern',
    statBonuses: { maxSpirit: 14, defense: 2 },
  },
  'carved-totem': { id: 'carved-totem', slot: 'spiritTotem', statBonuses: { attack: 1, defense: 1 } },
};
