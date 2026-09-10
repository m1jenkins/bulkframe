import { findImageAtPoint, scanDocument, describePage } from '../lib/scan';
import type { ImageCandidate } from '../lib/types';

declare global {
  interface Window {
    __bulkframeInjected?: boolean;
  }
}

const HOST_ID = 'bulkframe-wand-host';

function ensureHost() {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    document.documentElement.appendChild(host);
  }
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  return shadow;
}

function wandStyles() {
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .tip {
      position: fixed; z-index: 2147483646; display: none; gap: 6px;
      background: #0f766e; color: #f0fdfa; border-radius: 999px; padding: 4px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, .25); font: 12px/1.2 ui-sans-serif, system-ui;
    }
    .tip button {
      all: unset; cursor: pointer; padding: 6px 10px; border-radius: 999px;
      background: rgba(255,255,255,.12);
    }
    .tip button:hover { background: rgba(255,255,255,.22); }
    .tray {
      position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%);
      z-index: 2147483646; display: none; align-items: center; gap: 8px;
      background: #0f172a; color: #f8fafc; border-radius: 16px; padding: 8px 12px;
      box-shadow: 0 12px 40px rgba(15,23,42,.4); font: 12px ui-sans-serif, system-ui;
      max-width: min(92vw, 640px);
    }
    .thumbs { display: flex; gap: 6px; max-width: 360px; overflow: auto; }
    .thumbs img { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; }
    .tray button {
      all: unset; cursor: pointer; padding: 6px 10px; border-radius: 999px;
      background: #0f766e; color: white;
    }
    .tray .ghost { background: #334155; }
  `;
  return style;
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    if (window.__bulkframeInjected) return;
    window.__bulkframeInjected = true;

    let wandOn = false;
    let current: ImageCandidate | null = null;
    const tray: ImageCandidate[] = [];

    const shadow = ensureHost();
    shadow.replaceChildren();
    shadow.append(wandStyles());

    const tip = document.createElement('div');
    tip.className = 'tip';
    const dlBtn = document.createElement('button');
    dlBtn.textContent = 'Download';
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add';
    tip.append(dlBtn, addBtn);
    shadow.append(tip);

    const trayEl = document.createElement('div');
    trayEl.className = 'tray';
    const thumbs = document.createElement('div');
    thumbs.className = 'thumbs';
    const count = document.createElement('span');
    const trayDl = document.createElement('button');
    trayDl.textContent = 'Download';
    const trayZip = document.createElement('button');
    trayZip.textContent = 'ZIP';
    const trayClear = document.createElement('button');
    trayClear.className = 'ghost';
    trayClear.textContent = 'Clear';
    trayEl.append(thumbs, count, trayDl, trayZip, trayClear);
    shadow.append(trayEl);

    function renderTray() {
      trayEl.style.display = tray.length ? 'flex' : 'none';
      count.textContent = `${tray.length}`;
      thumbs.replaceChildren(
        ...tray.slice(-8).map((img) => {
          const el = document.createElement('img');
          el.src = img.url;
          el.alt = img.filename;
          return el;
        }),
      );
    }

    function sendWand(action: 'download' | 'stage' | 'tray-download' | 'tray-zip' | 'tray-clear', images: ImageCandidate[]) {
      void browser.runtime.sendMessage({ type: 'WAND_EVENT', action, images });
    }

    dlBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (current) sendWand('download', [current]);
    });
    addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!current) return;
      if (!tray.some((t) => t.url === current!.url)) tray.push(current);
      renderTray();
      sendWand('stage', tray);
    });
    trayDl.addEventListener('click', () => sendWand('tray-download', [...tray]));
    trayZip.addEventListener('click', () => sendWand('tray-zip', [...tray]));
    trayClear.addEventListener('click', () => {
      tray.splice(0, tray.length);
      renderTray();
    });

    const onMove = (ev: MouseEvent) => {
      if (!wandOn) return;
      const found = findImageAtPoint(ev.clientX, ev.clientY);
      current = found;
      if (!found) {
        tip.style.display = 'none';
        return;
      }
      tip.style.display = 'flex';
      tip.style.left = `${ev.clientX + 12}px`;
      tip.style.top = `${ev.clientY + 12}px`;
    };

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'PING') {
        sendResponse({ ok: true });
        return;
      }
      if (message?.type === 'SCAN_PAGE') {
        const meta = describePage();
        const images = scanDocument({
          skip1x1: Boolean(message.skip1x1),
          skipTypes: message.skipTypes || [],
        });
        sendResponse({ ok: true, ...meta, images });
        return;
      }
      if (message?.type === 'WAND_START') {
        wandOn = true;
        document.addEventListener('mousemove', onMove, true);
        sendResponse({ ok: true });
        return;
      }
      if (message?.type === 'WAND_STOP') {
        wandOn = false;
        tip.style.display = 'none';
        document.removeEventListener('mousemove', onMove, true);
        sendResponse({ ok: true });
        return;
      }
    });
  },
});
