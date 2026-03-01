import * as fs from 'node:fs/promises';
import * as fssync from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

export type RestoreWriteOp = {
  absPath: string;
  bytes: Buffer;
  mode?: number;
};

export type RestoreTxnResult = {
  txnId: string;
  baseDir: string;
  lockPath: string;
  stageDir: string;
  backupDir: string;
  manifestPath: string;
  committed: boolean;
  rolledBack: boolean;
  fileCount: number;
};

type Manifest = {
  txnId: string;
  createdAt: string;
  cwd: string;
  ops: Array<{
    absPath: string;
    stagePath: string;
    backupPath: string | null;
    existed: boolean;
    bytes: number;
    mode?: number;
  }>;
  status: 'CREATED' | 'STAGED' | 'COMMITTED' | 'ROLLED_BACK' | 'FAILED';
  error?: { message: string; stack?: string };
};

function ensureDirSync(targetPath: string) {
  if (!fssync.existsSync(targetPath)) {
    fssync.mkdirSync(targetPath, { recursive: true });
  }
}

async function ensureDir(targetPath: string) {
  try {
    await fs.mkdir(targetPath, { recursive: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code !== 'EEXIST') {
      throw error;
    }
  }
}

async function writeJson(targetPath: string, value: unknown) {
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function safeUnlink(targetPath: string) {
  try {
    await fs.unlink(targetPath);
  } catch {
    // ignore
  }
}

async function safeRm(targetPath: string) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

async function copyFilePreserveDirs(src: string, dst: string) {
  await ensureDir(path.dirname(dst));
  await fs.copyFile(src, dst);
}

async function writeBytesPreserveDirs(dst: string, bytes: Buffer) {
  await ensureDir(path.dirname(dst));
  await fs.writeFile(dst, bytes);
}

async function chmodIf(mode: number | undefined, targetPath: string) {
  if (typeof mode === 'number') {
    try {
      await fs.chmod(targetPath, mode);
    } catch {
      // ignore
    }
  }
}

export async function withRestoreTransaction(
  ops: RestoreWriteOp[],
  fnNameForAudit: string,
  baseDirOverride?: string,
): Promise<RestoreTxnResult> {
  if (!Array.isArray(ops) || ops.length === 0) {
    throw new Error('RestoreTransaction: ops is empty');
  }

  const baseDir =
    baseDirOverride ?? path.join(process.cwd(), '.fs_runtime_restore_txn');
  ensureDirSync(baseDir);

  const lockPath = path.join(baseDir, 'RESTORE.LOCK');

  let lockFd: number | null = null;
  try {
    lockFd = fssync.openSync(lockPath, 'wx');
    fssync.writeFileSync(
      lockFd,
      `locked_at=${new Date().toISOString()}\nfn=${fnNameForAudit}\n`,
      'utf8',
    );
  } catch {
    throw new Error(
      `RestoreTransaction: lock exists (another restore running?): ${lockPath}`,
    );
  }

  const txnId = `${new Date().toISOString().replace(/[:.]/g, '-')}_${randomUUID()}`;
  const stageDir = path.join(baseDir, 'stage', txnId);
  const backupDir = path.join(baseDir, 'backup', txnId);
  const manifestPath = path.join(baseDir, 'manifest', `${txnId}.json`);

  const result: RestoreTxnResult = {
    txnId,
    baseDir,
    lockPath,
    stageDir,
    backupDir,
    manifestPath,
    committed: false,
    rolledBack: false,
    fileCount: ops.length,
  };

  const manifest: Manifest = {
    txnId,
    createdAt: new Date().toISOString(),
    cwd: process.cwd(),
    ops: [],
    status: 'CREATED',
  };

  await ensureDir(stageDir);
  await ensureDir(backupDir);
  await ensureDir(path.dirname(manifestPath));

  try {
    for (const op of ops) {
      if (!op.absPath || !path.isAbsolute(op.absPath)) {
        throw new Error(
          `RestoreTransaction: absPath must be absolute: ${String(op.absPath)}`,
        );
      }
      const existed = await fileExists(op.absPath);
      const relKey = op.absPath
        .replace(/[\\/]/g, '__')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      const stagePath = path.join(stageDir, relKey);
      await ensureDir(path.dirname(stagePath));
      await writeBytesPreserveDirs(stagePath, op.bytes);
      await chmodIf(op.mode, stagePath);

      const backupPath = existed ? path.join(backupDir, relKey) : null;

      manifest.ops.push({
        absPath: op.absPath,
        stagePath,
        backupPath,
        existed,
        bytes: op.bytes.byteLength,
        mode: op.mode,
      });
    }

    manifest.status = 'STAGED';
    await writeJson(manifestPath, manifest);

    for (const entry of manifest.ops) {
      if (entry.existed && entry.backupPath) {
        await copyFilePreserveDirs(entry.absPath, entry.backupPath);
      }
    }

    for (const entry of manifest.ops) {
      await ensureDir(path.dirname(entry.absPath));
      if (entry.existed && entry.backupPath) {
        await safeUnlink(entry.absPath);
      }
      await fs.rename(entry.stagePath, entry.absPath);
      await chmodIf(entry.mode, entry.absPath);
    }

    manifest.status = 'COMMITTED';
    await writeJson(manifestPath, manifest);

    result.committed = true;
    return result;
  } catch (error) {
    manifest.status = 'FAILED';
    manifest.error = {
      message: String((error as Error)?.message ?? error),
      stack: (error as Error)?.stack
        ? String((error as Error).stack)
        : undefined,
    };
    try {
      await writeJson(manifestPath, manifest);
    } catch {
      // ignore
    }

    try {
      for (const entry of manifest.ops.slice().reverse()) {
        if (entry.existed && entry.backupPath) {
          await safeUnlink(entry.absPath);
          if (await fileExists(entry.backupPath)) {
            await ensureDir(path.dirname(entry.absPath));
            await fs.copyFile(entry.backupPath, entry.absPath);
            await chmodIf(entry.mode, entry.absPath);
          }
        } else {
          await safeUnlink(entry.absPath);
        }
      }
      manifest.status = 'ROLLED_BACK';
      await writeJson(manifestPath, manifest);
      result.rolledBack = true;
    } catch {
      // ignore
    }

    const enriched = error as Error & { txnId?: string; manifestPath?: string };
    enriched.txnId = txnId;
    enriched.manifestPath = manifestPath;
    throw enriched;
  } finally {
    await safeRm(stageDir);
    try {
      if (lockFd !== null) {
        fssync.closeSync(lockFd);
      }
    } catch {
      // ignore
    }
    await safeUnlink(lockPath);
  }
}
