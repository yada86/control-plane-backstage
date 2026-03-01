import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

type BackupMeta = {
  src: string;
  time: string;
  sha256_src: string;
  sha256_backup: string;
};

const sha256 = (value: Buffer) =>
  crypto.createHash('sha256').update(value).digest('hex');

const resolveHubRoot = (absSourcePath: string) => {
  const normalized = path.resolve(absSourcePath);
  const parts = normalized.split(path.sep).filter(Boolean);
  const hubIndex = parts.findIndex(part => part.toUpperCase() === 'HUB');
  if (hubIndex < 0) {
    return path.dirname(normalized);
  }

  const prefix = path.isAbsolute(normalized) ? path.sep : '';
  const hubRoot = `${prefix}${parts.slice(0, hubIndex + 1).join(path.sep)}`;
  return hubRoot;
};

export const createHubBackupFile = (absSourcePath: string): string => {
  const sourcePath = path.resolve(absSourcePath);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Backup source does not exist: ${sourcePath}`);
  }

  const hubRoot = resolveHubRoot(sourcePath);
  const relPath = path.relative(hubRoot, sourcePath);
  if (!relPath || relPath.startsWith('..') || path.isAbsolute(relPath)) {
    throw new Error(`Backup source is outside HUB root: ${sourcePath}`);
  }

  const relDir = path.dirname(relPath);
  const backupDir =
    relDir === '.'
      ? path.join(hubRoot, '_BACKUPS')
      : path.join(hubRoot, '_BACKUPS', relDir);
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const backupName = `${path.basename(sourcePath)}.${stamp}.bak`;
  const backupPath = path.join(backupDir, backupName);

  const srcBytes = fs.readFileSync(sourcePath);
  fs.writeFileSync(backupPath, srcBytes);
  const backupBytes = fs.readFileSync(backupPath);

  const meta: BackupMeta = {
    src: sourcePath,
    time: new Date().toISOString(),
    sha256_src: sha256(srcBytes),
    sha256_backup: sha256(backupBytes),
  };

  const metaPath = `${backupPath}.meta.json`;
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

  return backupPath;
};
