import { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '@/state/useSceneStore';
import { useAuthStore } from '@/state/useAuthStore';
import { hydrateAllStores } from '@/state/hydrate';
import { fetchPlayerSave } from '@/firebase/saveService';
import { TitleScene } from '@/scenes/TitleScene';
import { CharacterCreationScene } from '@/scenes/CharacterCreationScene';
import { TownScene } from '@/scenes/TownScene';
import { OverworldScene } from '@/scenes/OverworldScene';
import { DungeonScene } from '@/scenes/DungeonScene';
import { CombatScene } from '@/scenes/CombatScene';
import { ToastHost } from '@/components/ToastHost';

function App() {
  const currentScene = useSceneStore((s) => s.currentScene);
  const goTo = useSceneStore((s) => s.goTo);
  const authStatus = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const [checkingSave, setCheckingSave] = useState(false);
  const checkedForUid = useRef<string | null>(null);

  useEffect(() => {
    if (authStatus === 'signedOut') {
      checkedForUid.current = null;
      if (currentScene !== 'title') goTo('title');
      return;
    }

    if (authStatus === 'signedIn' && user && checkedForUid.current !== user.uid) {
      checkedForUid.current = user.uid;
      setCheckingSave(true);
      fetchPlayerSave(user.uid)
        .then((save) => {
          if (save) {
            hydrateAllStores(save);
            goTo('town', { locationId: save.player.currentLocationId });
          } else {
            goTo('characterCreation');
          }
        })
        .finally(() => setCheckingSave(false));
    }
  }, [authStatus, user, currentScene, goTo]);

  if (authStatus === 'loading' || checkingSave) {
    return (
      <div className="app-shell">
        <p>Lighting the lantern...</p>
      </div>
    );
  }

  function renderScene() {
    switch (currentScene) {
      case 'title':
        return <TitleScene />;
      case 'characterCreation':
        return <CharacterCreationScene />;
      case 'town':
        return <TownScene />;
      case 'overworld':
        return <OverworldScene />;
      case 'dungeon':
        return <DungeonScene />;
      case 'combat':
        return <CombatScene />;
      default:
        return (
          <div className="app-shell">
            <p>Scene "{currentScene}" not implemented yet.</p>
          </div>
        );
    }
  }

  return (
    <>
      {renderScene()}
      <ToastHost />
    </>
  );
}

export default App;
