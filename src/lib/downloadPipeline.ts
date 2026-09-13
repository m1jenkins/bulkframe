import { db } from '../db';
import { logDownload } from './analytics';
import { blobFromUrl, convertBlob } from './convert';
import { downloadRoute, joinDownloadPath } from './downloadPath';
import { downloadStrategy } from './downloadUrl';
import { ensureExtension, isVideoType, typeToExt } from './images';
import { sniffBlob } from './enrich';
import { runFolderWriteJob } from './folderWrite';
import { dHashFromBlob } from './hash';
import { urlForBlobDownload } from './offscreenBlobs';
import { domainFromUrl } from './pages';
import { applyRename } from './rename';
import { conflictFor, firstMatchingRule } from './rules';
import { getSettings } from './settings';
import type { ConflictAction, DownloadFormat, ImageCandidate, Workflow } from './types';
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
  if (format !== 'original' && !isVideoType(sniffed.type)) {
    try {
      out = await convertBlob(blob, format);
      ext = format === 'jpg' ? 'jpg' : 'png';
    } catch {
      ext = typeToExt(sniffed.type, 'original');
    }
  }
  if (!sniffed.hash && !isVideoType(sniffed.type)) {
    sniffed.hash = await dHashFromBlob(blob);
  }
  return { blob: out, image: sniffed, ext };
}

async function startDownload(opts: {
  url: string;
  filename: string;
  saveAs: boolean;
  conflictAction: ConflictAction;
}) {
  return browser.downloads.download({
    url: opts.url,
    filename: opts.filename,
    saveAs: opts.saveAs,
    conflictAction: opts.conflictAction,
  });
}

export async function downloadImages(opts: {
  images: ImageCandidate[];
  workflow: Workflow;
  format?: DownloadFormat;
  zip?: boolean;
  destFolder?: string;
  saveAs?: boolean;
}): Promise<{ ok: number; failed: number; zipFailed?: number }> {
  const settings = await getSettings();
  const rules = await db.rules.orderBy('order').toArray();
  const format = opts.format ?? settings.downloadFormat;
  const saveAs = opts.saveAs ?? settings.askWhereToSave;
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
    const zipBase = `bulkframe-${new Date().toISOString().slice(0, 10)}.zip`;
    const route = downloadRoute(opts.destFolder);
    let zipName = joinDownloadPath(route.folder, zipBase);
    let id: number | undefined;
    if (route.kind === 'filesystem') {
      const written = await runFolderWriteJob({
        destFolder: route.folder,
        conflict: settings.conflict,
        files: [{ filename: zipBase, blob: zipBlob }],
      });
      const outcome = written.outcomes[0];
      if (!outcome || !outcome.ok) throw new Error(outcome && !outcome.ok ? outcome.error : 'ZIP save failed');
      zipName = joinDownloadPath(route.folder, outcome.savedAs);
    } else {
      const url = await urlForBlobDownload(zipBlob);
      id = await startDownload({
        url,
        filename: zipName,
        saveAs,
        conflictAction: settings.conflict,
      });
    }
    await db.library.add({
      id: uid('dl'),
      url: files[0]?.image.url ?? '',
      filename: zipName,
      folder: route.folder || opts.destFolder,
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

  const absByFolder = new Map<
    string,
    { conflict: ConflictAction; items: { filename: string; blob: Blob; image: ImageCandidate }[] }
  >();

  for (const [i, image] of opts.images.entries()) {
    if (!image) continue;
    try {
      const formatForDownload = isVideoType(image.type) ? 'original' : format;
      const direct = downloadStrategy(image.url, formatForDownload) === 'direct';
      let prepared = direct ? null : await prepareBlob(image, format);
      const record = prepared?.image ?? image;
      const rule = firstMatchingRule(rules, record);
      const ext = prepared?.ext ?? typeToExt(record.type, format);
      const name = settings.renameEnabled
        ? applyRename(record, i, settings.renamePattern, settings.renameSeparator, ext)
        : ensureExtension(record.filename, ext);
      const folder = opts.destFolder != null ? opts.destFolder : rule?.destFolder;
      const route = downloadRoute(folder);
      const conflictAction = conflictFor(rules, record, settings.conflict);
      if (route.kind === 'filesystem') {
        if (!prepared) prepared = await prepareBlob(image, formatForDownload);
        const group = absByFolder.get(route.folder) ?? { conflict: conflictAction, items: [] };
        group.items.push({ filename: name, blob: prepared.blob, image: prepared.image });
        absByFolder.set(route.folder, group);
        continue;
      }
      const filename = joinDownloadPath(route.folder, name);
      const downloadUrl = prepared ? await urlForBlobDownload(prepared.blob) : image.url;
      const chromeId = await startDownload({
        url: downloadUrl,
        filename,
        saveAs,
        conflictAction,
      });
      await recordSuccess({
        image: record,
        filename,
        folder: route.folder,
        byteSize: prepared?.blob.size ?? record.byteSize,
        format,
        workflow: opts.workflow,
        chromeDownloadId: chromeId,
      });
      ok += 1;
    } catch (err) {
      failed += 1;
      await recordFailure(image, format, opts.workflow, err);
    }
  }

  for (const [folder, group] of absByFolder) {
    try {
      const written = await runFolderWriteJob({
        destFolder: folder,
        conflict: group.conflict,
        files: group.items.map((item) => ({ filename: item.filename, blob: item.blob })),
      });
      for (const [index, outcome] of written.outcomes.entries()) {
        const item = group.items[index];
        if (!item) continue;
        if (!outcome.ok) {
          failed += 1;
          await recordFailure(item.image, format, opts.workflow, outcome.error);
          continue;
        }
        await recordSuccess({
          image: item.image,
          filename: joinDownloadPath(folder, outcome.savedAs),
          folder,
          byteSize: item.blob.size,
          format,
          workflow: opts.workflow,
        });
        ok += 1;
      }
    } catch (err) {
      for (const item of group.items) {
        failed += 1;
        await recordFailure(item.image, format, opts.workflow, err);
      }
    }
  }
  return { ok, failed };
}

async function recordSuccess(opts: {
  image: ImageCandidate;
  filename: string;
  folder?: string;
  byteSize?: number;
  format: DownloadFormat;
  workflow: Workflow;
  chromeDownloadId?: number;
}) {
  await db.library.add({
    id: uid('dl'),
    url: opts.image.url,
    pageUrl: opts.image.pageUrl,
    filename: opts.filename,
    folder: opts.folder,
    byteSize: opts.byteSize,
    width: opts.image.width,
    height: opts.image.height,
    type: opts.image.type,
    format: opts.format,
    status: 'complete',
    timestamp: Date.now(),
    workflow: opts.workflow,
    chromeDownloadId: opts.chromeDownloadId,
  });
  await logDownload({
    domain: domainFromUrl(opts.image.pageUrl || opts.image.url),
    workflow: opts.workflow,
    byteSize: opts.byteSize,
    imageType: opts.image.type,
    width: opts.image.width,
    height: opts.image.height,
  });
}

async function recordFailure(image: ImageCandidate, format: DownloadFormat, workflow: Workflow, err: unknown) {
  await db.library.add({
    id: uid('dl'),
    url: image.url,
    pageUrl: image.pageUrl,
    filename: image.filename,
    type: image.type,
    format,
    status: 'failed',
    error: err instanceof Error ? err.message : String(err),
    timestamp: Date.now(),
    workflow,
  });
}

export async function hashScanImages(scanId: string) {
  const scan = await db.scans.get(scanId);
  if (!scan) return;
  const updated = [...scan.images];
  for (let i = 0; i < updated.length; i++) {
    const img = updated[i];
    if (!img || img.hash || isVideoType(img.type)) continue;
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
