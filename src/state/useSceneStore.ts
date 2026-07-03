import { create } from 'zustand';

export type SceneName =
  | 'title'
  | 'characterCreation'
  | 'town'
  | 'overworld'
  | 'dungeon'
  | 'combat';

export interface SceneParams {
  locationId?: string;
  spawnId?: string;
  /** Raw tile coordinates, preferred over spawnId when both target the same locationId (e.g.
   *  restoring the exact spot combat was triggered from, rather than a named map entrance). */
  spawnX?: number;
  spawnY?: number;
  bossId?: string;
}

interface SceneState {
  currentScene: SceneName;
  previousScene: SceneName | null;
  params: SceneParams;
  goTo: (scene: SceneName, params?: SceneParams) => void;
}

export const useSceneStore = create<SceneState>((set, get) => ({
  currentScene: 'title',
  previousScene: null,
  params: {},
  goTo: (scene, params = {}) => {
    set({ currentScene: scene, previousScene: get().currentScene, params });
  },
}));
