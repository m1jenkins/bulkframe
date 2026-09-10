import { useEffect, useState } from 'react';
import { sendRuntime } from '../../lib/messaging';
import { isScannableUrl } from '../../lib/pages';
import { btn } from '../ui';

export function MassScanPage({ onOpenScan }: { onOpenScan: (id: string) => void }) {
  const [mode, setMode] = useState<'tabs' | 'links'>('tabs');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [excluded, setExcluded] = useState<number[]>([]);
  const [tabs, setTabs] = useState<{ id?: number; url?: string; title?: string }[]>([]);

  useEffect(() => {
    void (async () => {
      const current = await browser.windows.getCurrent();
      setTabs(await browser.tabs.query({ windowId: current.id }));
    })();
  }, []);

  const eligible = tabs.filter((t) => t.id && isScannableUrl(t.url) && !excluded.includes(t.id));

  async function run() {
    setBusy(true);
    setStatus('Scanning…');
    try {
      const result =
        mode === 'tabs'
          ? ((await sendRuntime({
              type: 'MASS_SCAN_TABS',
              tabIds: eligible.map((t) => t.id!),
            })) as { scanId: string; count: number; error?: string })
          : ((await sendRuntime({
              type: 'MASS_SCAN_URLS',
              urls: text
                .split(/[\s,]+/)
                .map((u) => u.trim())
                .filter(Boolean),
            })) as { scanId: string; count: number; error?: string });
      if (result.error) setStatus(result.error);
      else {
        setStatus(`Found ${result.count} images`);
        onOpenScan(result.scanId);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Mass Scan</h1>
      <div className="flex gap-2">
        <button type="button" className={btn(mode === 'tabs' ? 'primary' : 'ghost')} onClick={() => setMode('tabs')}>
          Scan open tabs
        </button>
        <button type="button" className={btn(mode === 'links' ? 'primary' : 'ghost')} onClick={() => setMode('links')}>
          Scan links
        </button>
      </div>
      {mode === 'tabs' ? (
        <ul className="space-y-2">
          {eligible.map((tab) => (
            <li key={tab.id} className="flex items-center justify-between rounded-xl bg-[var(--bg-elev)] px-3 py-2">
              <span className="truncate text-sm">{tab.title || tab.url}</span>
              <button type="button" className="text-xs text-red-600" onClick={() => setExcluded((e) => [...e, tab.id!])}>
                Remove
              </button>
            </li>
          ))}
          {!eligible.length && <li className="text-sm text-[var(--text-muted)]">No scannable tabs in this window.</li>}
        </ul>
      ) : (
        <textarea
          className="h-40 w-full rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] p-3"
          placeholder="Paste URLs, one per line"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      )}
      <button type="button" className={btn()} disabled={busy} onClick={() => void run()}>
        {busy ? 'Scanning…' : 'Run scan'}
      </button>
      {status && <p className="text-sm text-[var(--text-muted)]">{status}</p>}
    </div>
  );
}
