import fs from 'node:fs';
import crypto from 'node:crypto';
import { RestoreWriteOp } from './restoreTransaction';

type RestorePreviewFile = {
  absPath: string;
  existed: boolean;
  bytes_new: number;
  sha256_new: string;
  bytes_old?: number;
  sha256_old?: string;
  action: 'CREATE' | 'OVERWRITE';
};

type RestorePreview = {
  files: RestorePreviewFile[];
  totals: {
    files: number;
    creates: number;
    overwrites: number;
    bytes_new: number;
  };
};

const sha256 = (value: Buffer) =>
  crypto.createHash('sha256').update(value).digest('hex');

export function buildRestorePreview(ops: RestoreWriteOp[]): RestorePreview {
  const files: RestorePreviewFile[] = [];
  let creates = 0;
  let overwrites = 0;
  let bytesNewTotal = 0;

  for (const op of ops) {
    const existed = fs.existsSync(op.absPath);
    const bytesNew = op.bytes.length;
    const sha256New = sha256(op.bytes);
    bytesNewTotal += bytesNew;

    if (!existed) {
      creates += 1;
      files.push({
        absPath: op.absPath,
        existed: false,
        bytes_new: bytesNew,
        sha256_new: sha256New,
        action: 'CREATE',
      });
      continue;
    }

    const oldBytes = fs.readFileSync(op.absPath);
    overwrites += 1;
    files.push({
      absPath: op.absPath,
      existed: true,
      bytes_new: bytesNew,
      sha256_new: sha256New,
      bytes_old: oldBytes.length,
      sha256_old: sha256(oldBytes),
      action: 'OVERWRITE',
    });
  }

  return {
    files,
    totals: {
      files: files.length,
      creates,
      overwrites,
      bytes_new: bytesNewTotal,
    },
  };
}