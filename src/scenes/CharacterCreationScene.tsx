import { useState, type FormEvent } from 'react';
import { Panel } from '@/components/common/Panel';
import { getAssetUrl } from '@/assets/assetManager';
import { callCreateCharacter } from '@/firebase/functionsClient';
import { hydrateAllStores } from '@/state/hydrate';
import { useSceneStore } from '@/state/useSceneStore';
import { useCutsceneStore } from '@/state/useCutsceneStore';
import { INTRO_CUTSCENE } from '@/data/cutscenes';
import styles from './TitleScene.module.css';

const SKIN_OPTIONS: { id: 'male' | 'female'; label: string; assetId: string }[] = [
  { id: 'male', label: 'Male', assetId: 'sprite.player.male' },
  { id: 'female', label: 'Female', assetId: 'sprite.player.female' },
];

export function CharacterCreationScene() {
  const [name, setName] = useState('');
  const [skin, setSkin] = useState<'male' | 'female'>('male');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const goTo = useSceneStore((s) => s.goTo);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const save = await callCreateCharacter(name.trim(), skin);
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
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {SKIN_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSkin(option.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  background: skin === option.id ? 'var(--fw-accent-dim)' : 'transparent',
                  border: `1px solid ${skin === option.id ? 'var(--fw-accent)' : 'var(--fw-panel-border)'}`,
                  borderRadius: 6,
                  padding: '8px 14px',
                  cursor: 'pointer',
                }}
              >
                <img src={getAssetUrl(option.assetId)} alt={option.label} style={{ width: 48, height: 64, imageRendering: 'pixelated' }} />
                <span style={{ fontSize: 12, color: 'var(--fw-text)' }}>{option.label}</span>
              </button>
            ))}
          </div>
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
