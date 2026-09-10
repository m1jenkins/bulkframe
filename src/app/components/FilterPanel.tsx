import { IMAGE_TYPES, TYPE_LABELS, type FilterState, type ImageCandidate, type Orientation } from '../../lib/types';
import { typeCounts } from '../../lib/filters';
import { btn, cx } from '../ui';

const ORIENTATIONS: { id: Orientation; label: string }[] = [
  { id: 'portrait', label: 'Portrait' },
  { id: 'landscape', label: 'Landscape' },
  { id: 'square', label: 'Square' },
];

export function FilterPanel({
  filters,
  images,
  onChange,
  onSave,
}: {
  filters: FilterState;
  images: ImageCandidate[];
  onChange: (filters: FilterState) => void;
  onSave?: () => void;
}) {
  const counts = typeCounts(images);
  function patch(partial: Partial<FilterState>) {
    onChange({ ...filters, ...partial });
  }
  function num(v: string) {
    const n = Number(v);
    return v === '' || Number.isNaN(n) ? undefined : n;
  }

  return (
    <div className="bf-scroll space-y-4 overflow-auto p-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Filters</h2>
        {onSave && (
          <label className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            Save filters
            <input type="checkbox" onChange={(e) => e.target.checked && onSave()} />
          </label>
        )}
      </div>

      <section>
        <div className="mb-1 text-xs font-medium text-[var(--text-muted)]">Image dimensions (px)</div>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] px-2 py-1.5"
            placeholder="Min width"
            type="number"
            value={filters.minWidth ?? ''}
            onChange={(e) => patch({ minWidth: num(e.target.value) })}
          />
          <input
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] px-2 py-1.5"
            placeholder="Min height"
            type="number"
            value={filters.minHeight ?? ''}
            onChange={(e) => patch({ minHeight: num(e.target.value) })}
          />
          <input
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] px-2 py-1.5"
            placeholder="Max width"
            type="number"
            value={filters.maxWidth ?? ''}
            onChange={(e) => patch({ maxWidth: num(e.target.value) })}
          />
          <input
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] px-2 py-1.5"
            placeholder="Max height"
            type="number"
            value={filters.maxHeight ?? ''}
            onChange={(e) => patch({ maxHeight: num(e.target.value) })}
          />
        </div>
      </section>

      <section>
        <div className="mb-1 text-xs font-medium text-[var(--text-muted)]">Image orientation</div>
        <div className="flex flex-wrap gap-1">
          {ORIENTATIONS.map((o) => {
            const on = filters.orientations.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                className={cx(
                  'rounded-lg border px-2 py-1 text-xs',
                  on
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--line)]',
                )}
                onClick={() =>
                  patch({
                    orientations: on
                      ? filters.orientations.filter((x) => x !== o.id)
                      : [...filters.orientations, o.id],
                  })
                }
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between text-xs font-medium text-[var(--text-muted)]">
          File types
          <button
            type="button"
            className="text-[var(--accent)]"
            onClick={() =>
              patch({
                types: filters.types.length ? [] : [...IMAGE_TYPES],
              })
            }
          >
            {filters.types.length ? 'Clear' : 'Select all'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {IMAGE_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2 rounded-lg px-1 py-0.5">
              <input
                type="checkbox"
                checked={!filters.types.length || filters.types.includes(type)}
                onChange={(e) => {
                  const set = new Set(filters.types.length ? filters.types : IMAGE_TYPES);
                  if (e.target.checked) set.add(type);
                  else set.delete(type);
                  const next = [...set];
                  patch({ types: next.length === IMAGE_TYPES.length ? [] : next });
                }}
              />
              <span>
                {TYPE_LABELS[type]} ({counts[type]})
              </span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1 text-xs font-medium text-[var(--text-muted)]">File size (KB)</div>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] px-2 py-1.5"
            placeholder="Min size"
            type="number"
            value={filters.minBytes != null ? Math.round(filters.minBytes / 1024) : ''}
            onChange={(e) => {
              const v = num(e.target.value);
              patch({ minBytes: v == null ? undefined : v * 1024 });
            }}
          />
          <input
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] px-2 py-1.5"
            placeholder="Max size"
            type="number"
            value={filters.maxBytes != null ? Math.round(filters.maxBytes / 1024) : ''}
            onChange={(e) => {
              const v = num(e.target.value);
              patch({ maxBytes: v == null ? undefined : v * 1024 });
            }}
          />
        </div>
      </section>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={filters.hideDuplicates}
          onChange={(e) => patch({ hideDuplicates: e.target.checked })}
        />
        Hide duplicate images
      </label>

      <button type="button" className={btn('ghost')} onClick={() => onChange({ orientations: [], types: [], hideDuplicates: false })}>
        Reset filters
      </button>
    </div>
  );
}
