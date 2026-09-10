import { type ReactNode } from 'react';
import { cx } from '../ui';

export function IconButton({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cx(
        'grid size-8 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--line)] hover:text-[var(--text)]',
        active && 'bg-[var(--accent-soft)] text-[var(--accent)]',
      )}
    >
      {children}
    </button>
  );
}
