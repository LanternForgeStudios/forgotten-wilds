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
import { LOCATIONS } from '@/data';

/** On a completely fresh page load (not an in-session scene transition - see the "signedIn"
 *  branch below), always resume in a town rather than exactly wherever the player was standing -
 *  mid-dungeon or deep in an overworld trail on a cold reload used to force the Town scene onto a
 *  non-town map, which doesn't render correctly (Town's own object/entity handling doesn't know
 *  what to do with a dungeon's or overworld's objects). Only one region's town (Ash Hallow) exists
 *  in the built content today - falls back to it for any non-town location until a real
 *  region->town mapping exists for a second town. */
function freshLoadStartLocationId(lastLocationId: string): string {
  const location = LOCATIONS.find((l) => l.id === lastLocationId);
  return location?.kind === 'town' ? lastLocationId : 'ash-hallow';
}

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
            goTo('town', { locationId: freshLoadStartLocationId(save.player.currentLocationId) });
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
