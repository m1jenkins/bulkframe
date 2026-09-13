import { blobToDataUrl } from './downloadUrl';

const OFFSCREEN_PATH = '/offscreen.html';

let creating: Promise<void> | null = null;

type OffscreenClient = {
  url: string;
  postMessage: (message: unknown, options: { transfer: Transferable[] }) => void;
};

async function extensionClients(): Promise<OffscreenClient[]> {
  const scope = self as unknown as { clients?: { matchAll: (opts: { includeUncontrolled: boolean }) => Promise<OffscreenClient[]> } };
  if (!scope.clients) return [];
  return scope.clients.matchAll({ includeUncontrolled: true });
}

export async function ensureOffscreenDocument() {
  const url = browser.runtime.getURL(OFFSCREEN_PATH);
  const existing = await browser.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [url],
  });
  if (existing.length) return;

  if (!creating) {
    creating = browser.offscreen
      .createDocument({
        url: OFFSCREEN_PATH,
        reasons: ['BLOBS', 'DOM_PARSER'],
        justification: 'Create blob URLs for image and ZIP downloads',
      })
      .then(() => undefined)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes('Only a single offscreen')) throw err;
      })
      .finally(() => {
        creating = null;
      });
  }
  await creating;
}

export async function blobUrlViaOffscreen(blob: Blob): Promise<string> {
  await ensureOffscreenDocument();
  const url = browser.runtime.getURL(OFFSCREEN_PATH);
  const client = (await extensionClients()).find((c) => c.url === url || c.url.startsWith(url));
  if (!client) throw new Error('Offscreen document unavailable');

  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => reject(new Error('Blob URL timed out')), 15000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      if (typeof event.data === 'string' && event.data.startsWith('blob:')) resolve(event.data);
      else reject(new Error('Invalid blob URL'));
    };
    client.postMessage({ type: 'CREATE_BLOB_URL', blob }, { transfer: [channel.port2] });
  });
}

export async function urlForBlobDownload(blob: Blob): Promise<string> {
  try {
    return await blobUrlViaOffscreen(blob);
  } catch {
    return blobToDataUrl(blob);
  }
}
