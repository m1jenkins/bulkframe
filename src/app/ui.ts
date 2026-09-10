import clsx from 'clsx';

export function cx(...parts: Array<string | false | undefined | null>) {
  return clsx(parts);
}

export function btn(kind: 'primary' | 'ghost' | 'soft' | 'danger' = 'primary') {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none';
  switch (kind) {
    case 'ghost':
      return cx(base, 'text-[var(--text)] hover:bg-[var(--line)]');
    case 'soft':
      return cx(base, 'bg-[var(--accent-soft)] text-[var(--accent)]');
    case 'danger':
      return cx(base, 'bg-red-600 text-white hover:bg-red-700');
    default:
      return cx(base, 'bg-[var(--accent)] text-white hover:opacity-90');
  }
}
