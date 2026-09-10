import { useState } from 'react';
import { db } from '../../db';
import { uid } from '../../lib/ids';
import { previewRename } from '../../lib/rename';
import { saveSettings } from '../../lib/settings';
import type { ConflictAction, DownloadRule } from '../../lib/types';
import { btn } from '../ui';
import { useLiveQuery } from '../useLiveQuery';
import { useSettings } from '../useSettings';

export function RulesPage() {
  const rules = useLiveQuery(() => db.rules.orderBy('order').toArray(), [] as DownloadRule[], []);
  const { settings, update } = useSettings();
  const [draft, setDraft] = useState<Partial<DownloadRule>>({
    matchType: 'extension',
    destFolder: 'Bulkframe',
    conflict: 'uniquify',
    enabled: true,
    name: '',
    value: 'png',
  });

  async function addRule() {
    const order = rules.length;
    await db.rules.add({
      id: uid('rule'),
      name: draft.name || `${draft.matchType} rule`,
      matchType: draft.matchType || 'extension',
      value: String(draft.value || ''),
      destFolder: draft.destFolder || 'Bulkframe',
      conflict: (draft.conflict as ConflictAction) || 'uniquify',
      enabled: true,
      order,
    });
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-8 p-6 lg:grid-cols-2">
      <section>
        <h1 className="mb-4 text-2xl font-semibold">Download Rules</h1>
        <div className="space-y-3 rounded-2xl bg-[var(--bg-elev)] p-4">
          <input
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
            placeholder="Rule name"
            value={draft.name || ''}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <select
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
            value={draft.matchType}
            onChange={(e) => setDraft({ ...draft, matchType: e.target.value as DownloadRule['matchType'] })}
          >
            <option value="extension">Extension</option>
            <option value="domain">Domain</option>
            <option value="minSize">Minimum size (bytes)</option>
            <option value="orientation">Orientation</option>
          </select>
          <input
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
            placeholder="Match value"
            value={draft.value || ''}
            onChange={(e) => setDraft({ ...draft, value: e.target.value })}
          />
          <input
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
            placeholder="Destination folder"
            value={draft.destFolder || ''}
            onChange={(e) => setDraft({ ...draft, destFolder: e.target.value })}
          />
          <button type="button" className={btn()} onClick={() => void addRule()}>
            Add rule
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between rounded-xl bg-[var(--bg-elev)] px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) => void db.rules.update(rule.id, { enabled: e.target.checked })}
                />
                <span>
                  {rule.name} · {rule.matchType}={rule.value} → {rule.destFolder}
                </span>
              </label>
              <button type="button" className="text-xs text-red-600" onClick={() => void db.rules.delete(rule.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold">File Renamer</h2>
        <label className="mb-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.renameEnabled}
            onChange={(e) => void update({ renameEnabled: e.target.checked })}
          />
          Enable File Renamer
        </label>
        <input
          className="mb-2 w-full rounded-lg border border-[var(--line)] px-3 py-2"
          value={settings.renamePattern}
          onChange={(e) => void update({ renamePattern: e.target.value })}
        />
        <input
          className="mb-2 w-full rounded-lg border border-[var(--line)] px-3 py-2"
          value={settings.renameSeparator}
          onChange={(e) => void update({ renameSeparator: e.target.value })}
        />
        <p className="text-sm text-[var(--text-muted)]">
          Tokens: {'{domain} {filename} {index} {width} {height} {date} {ext}'}
        </p>
        <p className="mt-2 rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-sm">
          Preview: {previewRename(settings.renamePattern, settings.renameSeparator)}
        </p>
        <button
          type="button"
          className={`${btn('ghost')} mt-3`}
          onClick={() => void saveSettings({ renamePattern: '{domain}-{filename}-{index}' })}
        >
          Use suggested pattern
        </button>
      </section>
    </div>
  );
}
