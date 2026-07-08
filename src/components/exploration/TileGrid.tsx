// The Phaser exploration migration replaced this file's DOM/CSS renderer with a Phaser-backed one
// - kept as a thin re-export under the same name/path so no scene's import line needs to change.
// Town/Overworld/Dungeon all import TileGrid from this one path, so all three are already on
// Phaser via this single swap (not a per-scene migration).
export { PhaserExplorationCanvas as TileGrid } from './PhaserExplorationCanvas';
export type { GridEntity } from './PhaserExplorationCanvas';
