import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { createCharacter } from './functions/createCharacter';
export { startEncounter } from './functions/startEncounter';
export { resolveCombatAction } from './functions/resolveCombatAction';
export { talkToNpc } from './functions/talkToNpc';
export { enterLocation } from './functions/enterLocation';
export { collectWorldItem } from './functions/collectWorldItem';
export { equipItem, unequipItem } from './functions/equipItem';
export { purchaseItem } from './functions/purchaseItem';
export { restAtInn } from './functions/restAtInn';
export { useItem } from './functions/useItem';
