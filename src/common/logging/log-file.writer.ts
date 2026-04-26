import * as fs from 'node:fs';
import * as path from 'node:path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

let directoryEnsured = false;

function ensureLogDir(): void {
  if (directoryEnsured) {
    return;
  }
  directoryEnsured = true;
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getMaxFileSizeBytes(): number {
  const raw = process.env.LOG_MAX_FILE_SIZE;
  const kb = raw !== undefined ? Number.parseInt(String(raw), 10) : 1024;
  if (!Number.isFinite(kb) || kb < 1) {
    return 1024 * 1024;
  }
  return kb * 1024;
}

function timestampSuffixForFilename(): string {
  return new Date().toISOString().split('.')[0].replace(/:/g, '-');
}

function rotateIfNeeded(): void {
  if (!fs.existsSync(LOG_FILE)) {
    return;
  }
  const { size } = fs.statSync(LOG_FILE);
  if (size < getMaxFileSizeBytes()) {
    return;
  }
  const stamp = timestampSuffixForFilename();
  let target = path.join(LOG_DIR, `app-${stamp}.log`);
  let n = 0;
  while (fs.existsSync(target)) {
    n += 1;
    target = path.join(LOG_DIR, `app-${stamp}-${n}.log`);
  }
  fs.renameSync(LOG_FILE, target);
}

export function appendRotatingFileLine(line: string): void {
  const toWrite = line.endsWith('\n') ? line : `${line}\n`;
  try {
    ensureLogDir();
    rotateIfNeeded();
    fs.appendFileSync(LOG_FILE, toWrite, 'utf8');
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Failed to write to log file ${LOG_FILE}: ${text}\n`);
  }
}
