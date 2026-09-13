import type { DownloadFormat, FilterState, ImageCandidate, ImageType, ScanSource, Workflow } from './types';
import type { FolderWriteResult } from './folderWrite';

export type Msg =
  | { type: 'PING' }
  | { type: 'SCAN_PAGE'; skip1x1: boolean; skipRedditAvatars: boolean; skipTypes: ImageType[] }
  | { type: 'WAND_START' }
  | { type: 'WAND_STOP' }
  | {
      type: 'WAND_EVENT';
      action: 'download' | 'stage' | 'tray-download' | 'tray-zip' | 'tray-clear';
      images: ImageCandidate[];
    }
  | {
      type: 'DOWNLOAD_IMAGES';
      images: ImageCandidate[];
      workflow: Workflow;
      format?: DownloadFormat;
      zip?: boolean;
    }
  | {
      type: 'MASS_SCAN_TABS';
      tabIds?: number[];
    }
  | {
      type: 'MASS_SCAN_URLS';
      urls: string[];
    }
  | {
      type: 'SCHEDULE_UPSERT';
      schedule: {
        id?: string;
        url: string;
        time: string;
        destFolder?: string;
        download?: boolean;
        enabled?: boolean;
        name?: string;
        filters?: FilterState;
      };
    }
  | { type: 'SCHEDULE_DELETE'; id: string }
  | { type: 'SCHEDULE_RUN'; id: string }
  | { type: 'FOLDER_WRITE_JOB'; jobId: string }
  | {
      type: 'FOLDER_WRITE_DONE';
      jobId: string;
      error?: string;
      result?: FolderWriteResult;
    }
  | { type: 'OPEN_DASHBOARD'; scanId?: string; view?: string }
  | { type: 'OPEN_SIDE_PANEL' }
  | { type: 'COPY_TEXT'; text: string }
  | { type: 'DELETE_DOWNLOADS'; chromeIds: number[] }
  | { type: 'PARSE_HTML'; url: string; html: string };

export type ScanPageResult = {
  ok: true;
  title: string;
  url: string;
  domain: string;
  images: ImageCandidate[];
};

export type MassScanResult = {
  scanId: string;
  sourceType: ScanSource;
  count: number;
};

export async function sendToTab<T>(tabId: number, msg: Msg): Promise<T> {
  return browser.tabs.sendMessage(tabId, msg) as Promise<T>;
}

export async function sendRuntime<T>(msg: Msg): Promise<T> {
  return browser.runtime.sendMessage(msg) as Promise<T>;
}
