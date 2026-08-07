interface BestBadgeProps {
  title?: string;
}

/** Small "★ Best" pill - marks an equipment card/row as noteworthy for its slot. Used both by
 *  CharacterMenu (the strongest item the player owns for a slot, regardless of whether it's
 *  currently equipped) and Shop (a shop listing that would outscore the player's current gear in
 *  that slot) - same visual, different `title` tooltip per caller. */
export function BestBadge({ title = 'The strongest item you own for this slot' }: BestBadgeProps) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 'bold',
        color: 'var(--fw-accent)',
        border: '1px solid var(--fw-accent)',
        borderRadius: 3,
        padding: '1px 4px',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
      }}
      title={title}
    >
      ★ Best
    </span>
  );
}
