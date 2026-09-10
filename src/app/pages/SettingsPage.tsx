import { exportBackup, importBackup, resetSection, type BackupPayload } from '../../lib/backup';
import { downloadTextFile } from '../../lib/export';
import { IMAGE_TYPES, TYPE_LABELS, type DownloadFormat, type ThemeMode, type VisualStyle } from '../../lib/types';
import { btn } from '../ui';
import { useSettings } from '../useSettings';

export function SettingsPage() {
  const { settings, update } = useSettings();

  async function doExport() {
    const payload = await exportBackup({ scans: true, favorites: true, analytics: true, settings: true });
    downloadTextFile('bulkframe-backup.json', JSON.stringify(payload, null, 2), 'application/json');
  }

  async function doImport(file: File) {
    const payload = JSON.parse(await file.text()) as BackupPayload;
    await importBackup(payload, { scans: true, favorites: true, analytics: true, settings: true });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="space-y-3 rounded-2xl bg-[var(--bg-elev)] p-4">
        <h2 className="font-medium">General</h2>
        <Toggle
          label="Open in Side Panel"
          checked={settings.openInSidePanel}
          onChange={(v) => void update({ openInSidePanel: v })}
        />
        <Toggle
          label="Always ask where to save"
          checked={settings.askWhereToSave}
          onChange={(v) => void update({ askWhereToSave: v })}
        />
        <Toggle
          label="Show helpful tooltips"
          checked={settings.showTooltips}
          onChange={(v) => void update({ showTooltips: v })}
        />
      </section>

      <section className="space-y-3 rounded-2xl bg-[var(--bg-elev)] p-4">
        <h2 className="font-medium">Downloads</h2>
        <label className="block text-sm">
          Default format
          <select
            className="mt-1 w-full rounded-lg border border-[var(--line)] px-2 py-1.5"
            value={settings.downloadFormat}
            onChange={(e) => void update({ downloadFormat: e.target.value as DownloadFormat })}
          >
            <option value="original">Original</option>
            <option value="jpg">JPG</option>
            <option value="png">PNG</option>
          </select>
        </label>
        <Toggle label="Skip 1×1 pixel images" checked={settings.skip1x1} onChange={(v) => void update({ skip1x1: v })} />
        <div>
          <div className="mb-1 text-sm">Skip file types during scan</div>
          <div className="flex flex-wrap gap-2">
            {IMAGE_TYPES.map((t) => {
              const on = settings.skipTypes.includes(t);
              return (
                <label key={t} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...settings.skipTypes, t]
                        : settings.skipTypes.filter((x) => x !== t);
                      void update({ skipTypes: next });
                    }}
                  />
                  {TYPE_LABELS[t]}
                </label>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-[var(--bg-elev)] p-4">
        <h2 className="font-medium">Appearance</h2>
        <label className="block text-sm">
          Theme
          <select
            className="mt-1 w-full rounded-lg border border-[var(--line)] px-2 py-1.5"
            value={settings.theme}
            onChange={(e) => void update({ theme: e.target.value as ThemeMode })}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="block text-sm">
          Style
          <select
            className="mt-1 w-full rounded-lg border border-[var(--line)] px-2 py-1.5"
            value={settings.style}
            onChange={(e) => void update({ style: e.target.value as VisualStyle })}
          >
            <option value="default">Teal</option>
            <option value="graphite">Graphite</option>
            <option value="ocean">Ocean</option>
            <option value="ember">Ember</option>
            <option value="jade">Jade</option>
          </select>
        </label>
      </section>

      <section className="space-y-3 rounded-2xl bg-[var(--bg-elev)] p-4">
        <h2 className="font-medium">Support</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Bulkframe runs locally in your browser profile. If a scan misses images, scroll the page, reset
          filters, and scan again. Restricted browser pages cannot be scanned.
        </p>
        <a className="text-sm text-[var(--accent)] underline" href="/privacy.html" target="_blank" rel="noreferrer">
          Privacy policy
        </a>
      </section>

      <section className="space-y-3 rounded-2xl bg-[var(--bg-elev)] p-4">
        <h2 className="font-medium">Data</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn()} onClick={() => void doExport()}>
            Export backup
          </button>
          <label className={btn('soft')}>
            Import backup
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void doImport(file);
              }}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <button type="button" className={btn('ghost')} onClick={() => void resetSection('scans')}>
            Reset scan results
          </button>
          <button type="button" className={btn('ghost')} onClick={() => void resetSection('favorites')}>
            Reset favorites
          </button>
          <button type="button" className={btn('ghost')} onClick={() => void resetSection('analytics')}>
            Reset analytics
          </button>
          <button type="button" className={btn('ghost')} onClick={() => void resetSection('settings')}>
            Reset settings
          </button>
        </div>
      </section>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
