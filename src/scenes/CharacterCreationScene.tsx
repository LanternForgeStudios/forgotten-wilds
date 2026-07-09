import { useState, type FormEvent } from 'react';
import { Panel } from '@/components/common/Panel';
import { getAssetUrl } from '@/assets/assetManager';
import { callCreateCharacter } from '@/firebase/functionsClient';
import { hydrateAllStores } from '@/state/hydrate';
import { useSceneStore } from '@/state/useSceneStore';
import { useCutsceneStore } from '@/state/useCutsceneStore';
import { INTRO_CUTSCENE } from '@/data/cutscenes';
import styles from './TitleScene.module.css';

export function CharacterCreationScene() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const goTo = useSceneStore((s) => s.goTo);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const save = await callCreateCharacter(name.trim());
      hydrateAllStores(save);
      // A brand new character's own existence is the "first time" signal - no persisted flag
      // needed, this only ever runs once per account by construction. Town only loads once the
      // player dismisses the cutscene, per "before you actually appear in Ash Hallow."
      useCutsceneStore.getState().play({
        ...INTRO_CUTSCENE,
        onComplete: () => goTo('town', { locationId: save.player.currentLocationId }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your character. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap} style={{ backgroundImage: `url(${getAssetUrl('background.title-screen')})` }}>
      <div>
        <h1 className={styles.title}>Take Up the Lantern</h1>
        <p className={styles.tagline}>Every Keeper needs a name the mountain will remember.</p>
      </div>
      <Panel className={styles.panel}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text"
            placeholder="Character name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={24}
            className={styles.input}
            autoFocus
          />
          <button type="submit" className={styles.button} disabled={busy || name.trim().length < 2}>
            {busy ? 'Lighting the lantern...' : 'Begin Journey'}
          </button>
        </form>
        {busy && <p className={styles.info}>Lighting the Light...</p>}
        {error && <p className={styles.error}>{error}</p>}
      </Panel>
    </div>
  );
}
