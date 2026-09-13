import { assertFolderHandleStored, writeBlobToFolder } from './folderAccess';
import { uid } from './ids';
import type { ConflictAction } from './types';

export type FolderWriteFile = {
  filename: string;
  blob: Blob;
};

export type FolderWriteJob = {
  id: string;
  destFolder: string;
  conflict: ConflictAction;
  files: FolderWriteFile[];
};

export type FolderWriteOutcome =
  | { filename: string; ok: true; savedAs: string }
  | { filename: string; ok: false; error: string };

export type FolderWriteResult = { outcomes: FolderWriteOutcome[] };

type Waiter = {
  resolve: (result: FolderWriteResult) => void;
  reject: (error: Error) => void;
};

const jobs = new Map<string, FolderWriteJob>();
const waiters = new Map<string, Waiter>();

export function stashFolderWriteJob(job: FolderWriteJob): void {
  jobs.set(job.id, job);
}

export function getFolderWriteJob(id: string): FolderWriteJob | undefined {
  return jobs.get(id);
}

export function dropFolderWriteJob(id: string): void {
  jobs.delete(id);
}

export function handleFolderWriteDone(message: {
  jobId?: string;
  error?: string;
  result?: FolderWriteResult;
}): boolean {
  if (!message.jobId) return false;
  const waiter = waiters.get(message.jobId);
  if (!waiter) return false;
  waiters.delete(message.jobId);
  if (message.error) waiter.reject(new Error(message.error));
  else waiter.resolve(message.result ?? { outcomes: [] });
  return true;
}

function waitForDone(jobId: string): Promise<FolderWriteResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!waiters.has(jobId)) return;
      waiters.delete(jobId);
      reject(new Error('Saving to folder timed out'));
    }, 10 * 60 * 1000);
    waiters.set(jobId, {
      resolve: (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
  });
}

export async function executeFolderWriteJob(job: FolderWriteJob): Promise<FolderWriteResult> {
  const outcomes: FolderWriteOutcome[] = [];
  for (const file of job.files) {
    try {
      const savedAs = await writeBlobToFolder({
        destFolder: job.destFolder,
        filename: file.filename,
        blob: file.blob,
        conflict: job.conflict,
      });
      outcomes.push({ filename: file.filename, ok: true, savedAs });
    } catch (err) {
      outcomes.push({
        filename: file.filename,
        ok: false,
        error: err instanceof Error ? err.message : 'Could not save file',
      });
    }
  }
  return { outcomes };
}

export async function runFolderWriteJob(job: Omit<FolderWriteJob, 'id'>): Promise<FolderWriteResult> {
  await assertFolderHandleStored(job.destFolder);
  if (!job.files.length) return { outcomes: [] };
  const id = uid('fw');
  stashFolderWriteJob({ ...job, id });
  let tabId: number | undefined;
  const done = waitForDone(id);
  try {
    const tab = await browser.tabs.create({
      url: browser.runtime.getURL(`/folder-writer.html?job=${encodeURIComponent(id)}`),
      active: false,
    });
    tabId = tab.id;
    return await done;
  } catch (err) {
    const waiter = waiters.get(id);
    waiters.delete(id);
    waiter?.reject(err instanceof Error ? err : new Error('Could not open folder writer'));
    throw err;
  } finally {
    dropFolderWriteJob(id);
    if (tabId != null) await browser.tabs.remove(tabId).catch(() => undefined);
  }
}
