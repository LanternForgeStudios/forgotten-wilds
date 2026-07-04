import type { Tier } from '@/types';
import { TIER_LABELS, TIER_COLORS } from '@/utils/tier';

interface TierBadgeProps {
  tier: Tier;
  style?: React.CSSProperties;
}

export function TierBadge({ tier, style }: TierBadgeProps) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 'bold',
        color: TIER_COLORS[tier],
        border: `1px solid ${TIER_COLORS[tier]}`,
        borderRadius: 3,
        padding: '1px 5px',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        ...style,
      }}
    >
      {TIER_LABELS[tier]}
    </span>
  );
}
