import { EQUIPMENT, LANTERN_ABILITIES } from '@/data';
import { describeLanternAbility } from '@/utils/moveDescription';

/** Shows what a Lantern item's own ability actually does (oil cost, and a numeric effect
 *  description scaled by the given oil tier - see moveDescription.ts's describeLanternAbility) in
 *  an item-detail popup (Shop/CharacterMenu/JournalOfLegends), rather than leaving a Lantern's
 *  in-combat effect entirely undocumented outside the combat screen itself. Renders null for a
 *  non-Lantern item or one with no lanternAbilityIds. */
export function LanternAbilitiesText({ equipDef, oilTier }: { equipDef: (typeof EQUIPMENT)[number]; oilTier: number }) {
  const abilities = (equipDef.lanternAbilityIds ?? [])
    .map((id) => LANTERN_ABILITIES.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => !!a);
  if (abilities.length === 0) return null;
  return (
    <>
      {equipDef.oilCapacity !== undefined && (
        <p style={{ margin: '0 0 4px', fontSize: 12 }}>Oil Capacity: {equipDef.oilCapacity}</p>
      )}
      {abilities.map((ability) => (
        <p key={ability.id} style={{ margin: '0 0 4px', fontSize: 12 }}>
          <strong>{ability.name}</strong> ({ability.oilCost} Oil) - {describeLanternAbility(ability, oilTier)}
        </p>
      ))}
    </>
  );
}
