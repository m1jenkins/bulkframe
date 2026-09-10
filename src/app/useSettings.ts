import { useEffect, useState } from 'react';
import { getSettings, saveSettings, watchSettings } from '../lib/settings';
import { DEFAULT_SETTINGS, type Settings } from '../lib/types';

function applyTheme(settings: Settings) {
  const root = document.documentElement;
  const dark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.style = settings.style;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void getSettings().then((s) => {
      setSettings(s);
      applyTheme(s);
      setReady(true);
    });
    return watchSettings((s) => {
      setSettings(s);
      applyTheme(s);
    });
  }, []);

  async function update(patch: Partial<Settings>) {
    const next = await saveSettings(patch);
    setSettings(next);
    applyTheme(next);
  }

  return { settings, ready, update };
}
