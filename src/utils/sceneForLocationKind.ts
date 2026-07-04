import type { LocationKind } from '@/types';
import type { SceneName } from '@/state/useSceneStore';

const LOCATION_KIND_TO_SCENE: Record<LocationKind, SceneName> = {
  town: 'town',
  overworld: 'overworld',
  dungeon: 'dungeon',
};

export function sceneForLocationKind(kind: LocationKind): SceneName {
  return LOCATION_KIND_TO_SCENE[kind];
}
