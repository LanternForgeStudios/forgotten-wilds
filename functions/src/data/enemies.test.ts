import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { SKILLS } from './skills';
import { AILMENTS } from './ailments';

describe('ENEMIES.vulnerableAilments', () => {
  for (const enemy of Object.values(ENEMIES)) {
    const ownAilments = enemy.moves
      .map((m) => SKILLS[m.skillId]?.inflictsAilmentId)
      .filter((id): id is string => !!id);

    it(`${enemy.id} is never vulnerable to an ailment its own moves inflict`, () => {
      for (const ailmentId of ownAilments) {
        expect(enemy.vulnerableAilments).not.toContain(ailmentId);
      }
    });

    it(`${enemy.id}'s vulnerableAilments only references real ailment ids`, () => {
      for (const ailmentId of enemy.vulnerableAilments) {
        expect(AILMENTS[ailmentId], `${enemy.id} lists unknown ailment "${ailmentId}"`).toBeDefined();
      }
    });
  }
});
