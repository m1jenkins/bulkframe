import { describePage, scanDocument } from '../../lib/scan';

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'PARSE_HTML') return;
  const doc = new DOMParser().parseFromString(String(message.html || ''), 'text/html');
  sendResponse({ ok: true, title: doc.title, htmlLength: message.html?.length ?? 0 });
  return true;
});

navigator.serviceWorker.onmessage = (event) => {
  if (event.data?.type !== 'CREATE_BLOB_URL' || !(event.data.blob instanceof Blob)) return;
  const port = event.ports[0];
  if (!port) return;
  port.postMessage(URL.createObjectURL(event.data.blob));
};

void describePage;
void scanDocument;
