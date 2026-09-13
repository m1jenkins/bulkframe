import { executeFolderWriteJob, type FolderWriteJob } from '../../lib/folderWrite';

async function main() {
  const jobId = new URLSearchParams(location.search).get('job') || '';
  try {
    if (!jobId) throw new Error('Missing save job');
    const response = (await browser.runtime.sendMessage({ type: 'FOLDER_WRITE_JOB', jobId })) as {
      job?: FolderWriteJob;
      error?: string;
    };
    if (response?.error) throw new Error(response.error);
    if (!response?.job) throw new Error('Save job expired');
    const result = await executeFolderWriteJob(response.job);
    await browser.runtime.sendMessage({ type: 'FOLDER_WRITE_DONE', jobId, result });
  } catch (err) {
    await browser.runtime.sendMessage({
      type: 'FOLDER_WRITE_DONE',
      jobId,
      error: err instanceof Error ? err.message : 'Could not save to folder',
    });
  }
}

void main();
