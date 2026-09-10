import { Frame, RefreshCw, Settings, Sparkles, WandSparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '../db';
import { enrichImages } from '../lib/enrich';
import { uid } from '../lib/ids';
import { logScan } from '../lib/analytics';
import { sendRuntime } from '../lib/messaging';
import { isScannableUrl } from '../lib/pages';
import { requestHostPermission } from '../lib/permissions';
import { getSettings } from '../lib/settings';
import { scanTab } from '../lib/tabScan';
import type { ScanRecord } from '../lib/types';
import { ScanWorkspace } from './components/ScanWorkspace';
import { IconButton } from './components/IconButton';
import { btn } from './ui';
import { useSettings } from './useSettings';

export function CompactApp({ variant }: { variant: 'popup' | 'sidepanel' }) {
  useSettings();
  const [tab, setTab] = useState<{ id?: number; url?: string; title?: string }>({});
  const [scan, setScan] = useState<ScanRecord | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wand, setWand] = useState(false);

  async function loadTab() {
    const [active] = await browser.tabs.query({ active: true, currentWindow: true });
    setTab(active ?? {});
  }

  useEffect(() => {
    void loadTab();
  }, []);

  async function search() {
    setError('');
    setBusy(true);
    try {
      const granted = await requestHostPermission();
      if (!granted) throw new Error('Allow page access to scan images on this site.');
      if (!tab.id || !isScannableUrl(tab.url)) {
        throw new Error('This page cannot be scanned. Open a regular website and try again.');
      }
      const settings = await getSettings();
      const result = await scanTab(tab.id, {
        skip1x1: settings.skip1x1,
        skipTypes: settings.skipTypes,
      });
      const images = await enrichImages(result.images);
      const record: ScanRecord = {
        id: uid('scan'),
        createdAt: Date.now(),
        sourceType: 'page',
        title: result.title,
        domain: result.domain,
        urls: [result.url],
        images,
      };
      await db.scans.add(record);
      await logScan(result.domain, images);
      setScan(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleWand() {
    if (!tab.id) return;
    const granted = await requestHostPermission();
    if (!granted) return;
    const next = !wand;
    setWand(next);
    try {
      await browser.tabs.sendMessage(tab.id, { type: next ? 'WAND_START' : 'WAND_STOP' });
    } catch {
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['/content-scripts/content.js'],
      });
      await browser.tabs.sendMessage(tab.id, { type: next ? 'WAND_START' : 'WAND_STOP' });
    }
  }

  return (
    <div
      className={
        variant === 'popup'
          ? 'flex h-[600px] w-[400px] flex-col bg-[var(--bg)]'
          : 'flex h-screen w-full flex-col bg-[var(--bg)]'
      }
    >
      <header className="flex items-center gap-2 px-3 py-2">
        <div className="grid size-8 place-items-center rounded-lg bg-[var(--accent)] text-white">
          <Frame size={16} />
        </div>
        <div className="font-semibold">Bulkframe</div>
        <div className="ml-auto flex">
          <IconButton label="Magic Wand" active={wand} onClick={() => void toggleWand()}>
            <WandSparkles size={16} />
          </IconButton>
          <IconButton label="Refresh tab" onClick={() => void loadTab()}>
            <RefreshCw size={16} />
          </IconButton>
          <IconButton
            label="Settings"
            onClick={() => void sendRuntime({ type: 'OPEN_DASHBOARD', view: 'settings' })}
          >
            <Settings size={16} />
          </IconButton>
        </div>
      </header>

      <div className="px-3">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg-elev)] px-3 py-2 text-left text-sm text-[var(--text-muted)]"
          onClick={() => void search()}
          disabled={busy}
        >
          <Sparkles size={16} className="text-[var(--accent)]" />
          {busy ? 'Searching images…' : 'Search images'}
        </button>
      </div>

      {error && <p className="px-3 pt-2 text-xs text-red-600">{error}</p>}

      {scan ? (
        <ScanWorkspace
          scan={scan}
          workflow="popup"
          compact
          onOpenFull={() => void sendRuntime({ type: 'OPEN_DASHBOARD', scanId: scan.id })}
        />
      ) : (
        <div className="grid flex-1 place-items-center px-6 text-center">
          <div>
            <p className="text-sm text-[var(--text-muted)]">
              Scan the current page, then filter and download the images you need.
            </p>
            <button type="button" className={`${btn()} mt-4`} onClick={() => void search()} disabled={busy}>
              Search images
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
