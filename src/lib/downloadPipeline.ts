import { db } from '../db';
import { logDownload } from './analytics';
import { blobFromUrl, convertBlob } from './convert';
import { ensureExtension, typeToExt } from './images';
import { sniffBlob } from './enrich';
import { dHashFromBlob } from './hash';
import { domainFromUrl } from './pages';
import { applyRename } from './rename';
import { conflictFor, firstMatchingRule, joinDownloadPath } from './rules';
import { getSettings } from './settings';
import type { DownloadFormat, ImageCandidate, Workflow } from './types';
import { uid } from './ids';
import { zipImages } from './zip';

async function prepareBlob(
  image: ImageCandidate,
  format: DownloadFormat,
): Promise<{ blob: Blob; image: ImageCandidate; ext: string }> {
  const blob = await blobFromUrl(image.url);
  const sniffed = await sniffBlob(image, blob);
  let out = blob;
  let ext = typeToExt(sniffed.type, format);
  if (format !== 'original') {
    try {
      out = await convertBlob(blob, format);
      ext = format === 'jpg' ? 'jpg' : 'png';
    } catch {
      ext = typeToExt(sniffed.type, 'original');
    }
  }
  if (!sniffed.hash) {
    sniffed.hash = await dHashFromBlob(blob);
  }
  return { blob: out, image: sniffed, ext };
}

export async function downloadImages(opts: {
  images: ImageCandidate[];
  workflow: Workflow;
  format?: DownloadFormat;
  zip?: boolean;
}): Promise<{ ok: number; failed: number; zipFailed?: number }> {
  const settings = await getSettings();
  const rules = await db.rules.orderBy('order').toArray();
  const format = opts.format ?? settings.downloadFormat;
  let ok = 0;
  let failed = 0;

  if (opts.zip) {
    const files: { image: ImageCandidate; blob: Blob; filename: string }[] = [];
    for (const [i, image] of opts.images.entries()) {
      if (!image) continue;
      try {
        const prepared = await prepareBlob(image, format);
        const name = settings.renameEnabled
          ? applyRename(prepared.image, i, settings.renamePattern, settings.renameSeparator, prepared.ext)
          : ensureExtension(prepared.image.filename, prepared.ext);
        files.push({ image: prepared.image, blob: prepared.blob, filename: name });
      } catch {
        failed += 1;
      }
    }
    const zipBlob = await zipImages(files);
    const url = URL.createObjectURL(zipBlob);
    const id = await browser.downloads.download({
      url,
      filename: `bulkframe-${new Date().toISOString().slice(0, 10)}.zip`,
      saveAs: settings.askWhereToSave,
      conflictAction: settings.conflict,
    });
    await db.library.add({
      id: uid('dl'),
      url: files[0]?.image.url ?? '',
      filename: `bulkframe-${new Date().toISOString().slice(0, 10)}.zip`,
      byteSize: zipBlob.size,
      type: 'other',
      format,
      status: 'complete',
      timestamp: Date.now(),
      workflow: opts.workflow,
      chromeDownloadId: id,
    });
    ok = files.length;
    return { ok, failed };
  }

  for (const [i, image] of opts.images.entries()) {
    if (!image) continue;
    try {
      const prepared = await prepareBlob(image, format);
      const rule = firstMatchingRule(rules, prepared.image);
      const name = settings.renameEnabled
        ? applyRename(prepared.image, i, settings.renamePattern, settings.renameSeparator, prepared.ext)
        : ensureExtension(prepared.image.filename, prepared.ext);
      const filename = joinDownloadPath(rule?.destFolder, name);
      const objectUrl = URL.createObjectURL(prepared.blob);
      const chromeId = await browser.downloads.download({
        url: objectUrl,
        filename,
        saveAs: settings.askWhereToSave,
        conflictAction: conflictFor(rules, prepared.image, settings.conflict),
      });
      await db.library.add({
        id: uid('dl'),
        url: prepared.image.url,
        pageUrl: prepared.image.pageUrl,
        filename,
        folder: rule?.destFolder,
        byteSize: prepared.blob.size,
        width: prepared.image.width,
        height: prepared.image.height,
        type: prepared.image.type,
        format,
        status: 'complete',
        timestamp: Date.now(),
        workflow: opts.workflow,
        chromeDownloadId: chromeId,
      });
      await logDownload({
        domain: domainFromUrl(prepared.image.pageUrl || prepared.image.url),
        workflow: opts.workflow,
        byteSize: prepared.blob.size,
        imageType: prepared.image.type,
        width: prepared.image.width,
        height: prepared.image.height,
      });
      ok += 1;
    } catch (err) {
      failed += 1;
      await db.library.add({
        id: uid('dl'),
        url: image.url,
        pageUrl: image.pageUrl,
        filename: image.filename,
        type: image.type,
        format,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Download failed',
        timestamp: Date.now(),
        workflow: opts.workflow,
      });
    }
  }
  return { ok, failed };
}

export async function hashScanImages(scanId: string) {
  const scan = await db.scans.get(scanId);
  if (!scan) return;
  const updated = [...scan.images];
  for (let i = 0; i < updated.length; i++) {
    const img = updated[i];
    if (!img || img.hash) continue;
    try {
      const blob = await blobFromUrl(img.url);
      img.hash = await dHashFromBlob(blob);
      img.byteSize = img.byteSize || blob.size;
    } catch {
      /* skip */
    }
    if (i % 12 === 0) {
      await db.scans.update(scanId, { images: updated });
    }
  }
  await db.scans.update(scanId, { images: updated });
}
