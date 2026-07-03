import type { CSSProperties, MouseEventHandler, PropsWithChildren } from 'react';
import { getAssetUrl } from '@/assets/assetManager';
import styles from './Panel.module.css';

interface PanelProps {
  variant?: 'default' | 'accent';
  className?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

const VARIANT_ASSET_ID: Record<NonNullable<PanelProps['variant']>, string> = {
  default: 'ui.panel-border-default',
  accent: 'ui.panel-border-accent',
};

/** Scalable 9-slice panel used for dialogue boxes, menus, and other JRPG UI chrome. */
export function Panel({ variant = 'default', className, style, onClick, children }: PropsWithChildren<PanelProps>) {
  const borderImageSource = `url(${getAssetUrl(VARIANT_ASSET_ID[variant])})`;

  return (
    <div
      className={[styles.panel, className].filter(Boolean).join(' ')}
      style={{ borderImageSource, ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
