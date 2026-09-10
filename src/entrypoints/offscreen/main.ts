import { describePage, scanDocument } from '../../lib/scan';

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'PARSE_HTML') return;
  const doc = new DOMParser().parseFromString(String(message.html || ''), 'text/html');
  sendResponse({ ok: true, title: doc.title, htmlLength: message.html?.length ?? 0 });
  return true;
});

void describePage;
void scanDocument;
