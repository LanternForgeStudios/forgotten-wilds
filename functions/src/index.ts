import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { createCharacter } from './functions/createCharacter';
export { startEncounter } from './functions/startEncounter';
export { resolveCombatAction } from './functions/resolveCombatAction';
export { talkToNpc } from './functions/talkToNpc';
export { enterLocation } from './functions/enterLocation';
export { visitLandmark } from './functions/visitLandmark';
export { collectWorldItem } from './functions/collectWorldItem';
export { equipItem, unequipItem } from './functions/equipItem';
export { purchaseItem } from './functions/purchaseItem';
export { restAtInn } from './functions/restAtInn';
export { useItem } from './functions/useItem';
export { interactWithShrine } from './functions/interactWithShrine';
export { dash } from './functions/dash';
export { openChest } from './functions/openChest';
export { sellItem } from './functions/sellItem';
export { searchUsers } from './functions/searchUsers';
export { sendFriendRequest, respondToFriendRequest, removeFriend } from './functions/friends';
export { blockUser, unblockUser } from './functions/blocking';
export { sendDirectMessage } from './functions/sendDirectMessage';
export { resetPlayerProgress } from './functions/resetPlayerProgress';
export { markSocialReviewed } from './functions/markSocialReviewed';
