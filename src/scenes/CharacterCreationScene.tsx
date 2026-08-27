import { useEffect, useState, type FormEvent } from 'react';
import { Panel } from '@/components/common/Panel';
import { SpritePreviewFrame } from '@/components/common/SpritePreviewFrame';
import { getAssetUrl } from '@/assets/assetManager';
import { callCreateCharacter } from '@/firebase/functionsClient';
import { hydrateAllStores, seedAudioSettingsFromSave } from '@/state/hydrate';
import { useSceneStore } from '@/state/useSceneStore';
import { useCutsceneStore } from '@/state/useCutsceneStore';
import { INTRO_CUTSCENE } from '@/data/cutscenes';
import { playMusic } from '@/audio/audioService';
import styles from './TitleScene.module.css';

type Gender = 'male' | 'female';
type Appearance = 'white-dark' | 'black-dark' | 'white-blonde' | 'asian-dark';

const GENDER_OPTIONS: { id: Gender; label: string }[] = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
];

const APPEARANCE_OPTIONS: { id: Appearance; label: string }[] = [
  { id: 'white-dark', label: 'White, Dark Hair' },
  { id: 'black-dark', label: 'Black, Dark Hair' },
  { id: 'white-blonde', label: 'White, Blonde Hair' },
  { id: 'asian-dark', label: 'Asian, Dark Hair' },
];

export function CharacterCreationScene() {
  // Same title theme as TitleScene - a no-op if it's already playing (see playMusic), so this
  // adjacent screen in the same sign-in flow doesn't restart or interrupt the track.
  useEffect(() => {
    void playMusic('music.title');
  }, []);

  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [appearance, setAppearance] = useState<Appearance>('white-dark');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const goTo = useSceneStore((s) => s.goTo);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const save = await callCreateCharacter(name.trim(), gender, appearance);
      hydrateAllStores(save);
      seedAudioSettingsFromSave(save);
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
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {GENDER_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setGender(option.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  background: gender === option.id ? 'var(--fw-accent-dim)' : 'transparent',
                  border: `1px solid ${gender === option.id ? 'var(--fw-accent)' : 'var(--fw-panel-border)'}`,
                  borderRadius: 6,
                  padding: '8px 14px',
                  cursor: 'pointer',
                }}
              >
                <SpritePreviewFrame assetId={`sprite.player.base.${option.id}.${appearance}`} alt={option.label} />
                <span style={{ fontSize: 12, color: 'var(--fw-text)' }}>{option.label}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {APPEARANCE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setAppearance(option.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  background: appearance === option.id ? 'var(--fw-accent-dim)' : 'transparent',
                  border: `1px solid ${appearance === option.id ? 'var(--fw-accent)' : 'var(--fw-panel-border)'}`,
                  borderRadius: 6,
                  padding: '6px 10px',
                  cursor: 'pointer',
                }}
              >
                <SpritePreviewFrame assetId={`sprite.player.base.${gender}.${option.id}`} alt={option.label} />
                <span style={{ fontSize: 11, color: 'var(--fw-text)' }}>{option.label}</span>
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
