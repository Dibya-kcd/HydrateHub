/**
 * The "second copy" of bills / GRNs inside the STORAGE_KEY backup blob used to be rewritten (read the whole blob,
 * JSON.parse, change one field, JSON.stringify, write) on every single change, which blocks the screen once the
 * ledger is large. Now the latest copy is written at most once a second, and immediately when the page is
 * hidden or closed, so nothing is lost. The main cache and the cloud save still happen right away, as before.
 */
const pendingBackupCopies = new Map<string, () => void>();
let backupCopyTimer: ReturnType<typeof setTimeout> | null = null;
const BACKUP_COPY_DELAY_MS = 1000;

export function flushBackupCopies(): void {
  if (backupCopyTimer) {
    clearTimeout(backupCopyTimer);
    backupCopyTimer = null;
  }
  const jobs = Array.from(pendingBackupCopies.values());
  pendingBackupCopies.clear();
  for (const job of jobs) {
    try {
      job();
    } catch {
      // same as before: a failed backup copy never stops the app
    }
  }
}

export function scheduleBackupCopy(field: string, write: () => void): void {
  pendingBackupCopies.set(field, write); // a newer copy replaces an older one that has not been written yet
  if (!backupCopyTimer) backupCopyTimer = setTimeout(flushBackupCopies, BACKUP_COPY_DELAY_MS);
}
