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
