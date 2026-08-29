/** Row of "pick one" buttons where the active option gets an accent-colored highlight - was
 *  copy-pasted 3 times in UserProfile.tsx (Settings' Difficulty, Debug's Weather and Time of Day
 *  overrides) with identical active-state styling and label-casing logic. */
interface SegmentedOptionRowProps<T extends string | null> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** The caller's own small-button class (each screen still owns its base button look). */
  buttonClassName: string;
  disabled?: boolean;
  /** Defaults to capitalizing the value, or 'Auto' for null - override only when a value needs
   *  different wording than its own capitalized name. */
  labelFor?: (value: T) => string;
  /** Appended after the label on the active option. Pass '' to omit. */
  activeSuffix?: string;
}

function defaultLabelFor(value: string | null): string {
  if (value === null) return 'Auto';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function SegmentedOptionRow<T extends string | null>({
  options,
  value,
  onChange,
  buttonClassName,
  disabled = false,
  labelFor = defaultLabelFor,
  activeSuffix = ' ✓',
}: SegmentedOptionRowProps<T>) {
  return (
    <div style={{ display: 'flex', gap: 'var(--fw-space-sm)', flexWrap: 'wrap' }}>
      {options.map((option) => {
        const isActive = value === option;
        return (
          <button
            key={option ?? 'auto'}
            type="button"
            className={buttonClassName}
            disabled={disabled}
            style={
              isActive
                ? { background: 'var(--fw-accent)', borderColor: 'var(--fw-accent)', color: 'var(--fw-bg-deep)', fontWeight: 'bold' }
                : undefined
            }
            onClick={() => onChange(option)}
          >
            {labelFor(option)}
            {isActive ? activeSuffix : ''}
          </button>
        );
      })}
    </div>
  );
}
