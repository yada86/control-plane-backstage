import fsSync from 'fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { withRestoreTransaction } from './runtime/restoreTransaction';
import { buildRestorePackFromCheckpoint } from './runtime/restorePackBuilder';

type RuntimeJsonEvent = Record<string, unknown>;

type RestoreFile = {
  relpath: string;
  encoding: 'utf8';
  content: string;
  sha256: string;
};

export type RestorePackV1 = {
  schema: 'FS_RUNTIME_RESTORE_PACK_V1';
  checkpoint_id: string;
  created_at: string;
  files: RestoreFile[];
};

type RestorePackSmoke = {
  schema: 'RESTORE_PACK';
  checkpoint_id: string;
  created_at: string;
  files: RestoreFile[];
};

type RestorePlanItem = {
  relpath: string;
  targetPath: string;
  exists: boolean;
  bytesNew: number;
  shaNew: string;
  bytesOld: number;
  shaOld: string | null;
};

type ApplyResultItem = {
  relpath: string;
  targetPath: string;
  backupPath: string | null;
  shaBefore: string | null;
  shaAfter: string;
  bytesBefore: number;
  bytesAfter: number;
};

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value, 'utf8').digest('hex');

const toObject = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const extractPayload = (event: RuntimeJsonEvent): unknown => {
  const facts = toObject(event.facts);
  const factsPayload = facts?.payload;
  if (factsPayload !== undefined) return factsPayload;
  const payload = event.payload;
  if (payload !== undefined) return payload;
  const data = event.data;
  if (data !== undefined) return data;
  const nestedEvent = toObject(event.event);
  if (!nestedEvent) return undefined;
  return nestedEvent.payload;
};

const normalizeRelPath = (hubRootAbs: string, relpath: string) => {
  const rootBase = path.basename(hubRootAbs).toUpperCase();
  if (rootBase === 'HUB' && relpath.startsWith('HUB/')) {
    return relpath.slice('HUB/'.length);
  }
  return relpath;
};

const resolveTargetPath = (hubRootAbs: string, relpath: string) => {
  if (!relpath || typeof relpath !== 'string') {
    throw new Error('Invalid relpath: expected non-empty string');
  }
  if (path.isAbsolute(relpath) || /^[A-Za-z]:\\/.test(relpath)) {
    throw new Error(`Invalid relpath '${relpath}': absolute paths are forbidden`);
  }
  const normalized = normalizeRelPath(hubRootAbs, relpath).replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.some(part => part === '..')) {
    throw new Error(`Invalid relpath '${relpath}': path traversal is forbidden`);
  }

  const targetPath = path.resolve(hubRootAbs, normalized);
  const relToRoot = path.relative(hubRootAbs, targetPath);
  if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
    throw new Error(`Invalid relpath '${relpath}': escapes hubDocs.rootPath`);
  }
  return targetPath;
};

export const readRuntimeJsonl = (jsonlPath: string): RuntimeJsonEvent[] => {
  const text = fsSync.readFileSync(jsonlPath, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const events: RuntimeJsonEvent[] = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line) as RuntimeJsonEvent);
    } catch {
      continue;
    }
  }
  return events;
};

export const validateRestorePack = (pack: unknown): RestorePackV1 => {
  const obj = toObject(pack);
  if (!obj) {
    throw new Error('Invalid restore pack payload: expected object');
  }

  if (obj.schema === 'FS_RUNTIME_RESTORE_PACK_V1') {
    if (typeof obj.checkpoint_id !== 'string' || !obj.checkpoint_id.trim()) {
      throw new Error('Invalid restore pack checkpoint_id');
    }
    if (typeof obj.created_at !== 'string' || !obj.created_at.trim()) {
      throw new Error('Invalid restore pack created_at');
    }
    if (!Array.isArray(obj.files) || obj.files.length === 0) {
      throw new Error('Invalid restore pack files: expected non-empty array');
    }

    const files: RestoreFile[] = obj.files.map((file, index) => {
      const next = toObject(file);
      if (!next) {
        throw new Error(`Invalid restore pack file[${index}]`);
      }
      if (typeof next.relpath !== 'string' || !next.relpath.trim()) {
        throw new Error(`Invalid restore pack file[${index}].relpath`);
      }
      if (next.encoding !== 'utf8') {
        throw new Error(`Invalid restore pack file[${index}].encoding`);
      }
      if (typeof next.content !== 'string') {
        throw new Error(`Invalid restore pack file[${index}].content`);
      }
      if (typeof next.sha256 !== 'string' || !next.sha256.trim()) {
        throw new Error(`Invalid restore pack file[${index}].sha256`);
      }
      const computed = sha256(next.content);
      if (computed !== next.sha256) {
        throw new Error(
          `Restore pack sha256 mismatch for ${next.relpath}: expected ${next.sha256}, got ${computed}`,
        );
      }
      return {
        relpath: next.relpath,
        encoding: 'utf8',
        content: next.content,
        sha256: next.sha256,
      };
    });

    return {
      schema: 'FS_RUNTIME_RESTORE_PACK_V1',
      checkpoint_id: obj.checkpoint_id,
      created_at: obj.created_at,
      files,
    };
  }

  if (obj.schema === 'RESTORE_PACK') {
    const hub = toObject(obj.hub);
    if (!hub || !Array.isArray(hub.files) || hub.files.length === 0) {
      throw new Error('Invalid restore pack hub.files: expected non-empty array');
    }

    const files: RestoreFile[] = hub.files.map((file, index) => {
      const next = toObject(file);
      if (!next) {
        throw new Error(`Invalid restore pack hub.files[${index}]`);
      }
      if (typeof next.path !== 'string' || !next.path.trim()) {
        throw new Error(`Invalid restore pack hub.files[${index}].path`);
      }
      if (next.encoding !== undefined && next.encoding !== 'utf8') {
        throw new Error(`Invalid restore pack hub.files[${index}].encoding`);
      }
      if (typeof next.content !== 'string') {
        throw new Error(`Invalid restore pack hub.files[${index}].content`);
      }

      return {
        relpath: next.path,
        encoding: 'utf8',
        content: next.content,
        sha256: sha256(next.content),
      };
    });

    const normalized: RestorePackSmoke = {
      schema: 'RESTORE_PACK',
      checkpoint_id:
        typeof obj.checkpoint_id === 'string' && obj.checkpoint_id.trim()
          ? obj.checkpoint_id
          : 'RESTORE_PACK',
      created_at:
        typeof obj.created_at === 'string' && obj.created_at.trim()
          ? obj.created_at
          : '1970-01-01T00:00:00.000Z',
      files,
    };

    return {
      schema: 'FS_RUNTIME_RESTORE_PACK_V1',
      checkpoint_id: normalized.checkpoint_id,
      created_at: normalized.created_at,
      files: normalized.files,
    };
  }

  throw new Error('Invalid restore pack schema');
};

const getCheckpointIdMatch = (event: RuntimeJsonEvent, checkpointId: string): boolean => {
  const eventCheckpointId =
    typeof event.checkpoint_id === 'string' ? event.checkpoint_id : undefined;
  if (eventCheckpointId === checkpointId) {
    return true;
  }

  const taskId = typeof event.task_id === 'string' ? event.task_id : undefined;
  return taskId === checkpointId;
};

export const findRestorePackByCheckpointId = (
  jsonlPath: string,
  checkpointId: string,
): RestorePackV1 | null => {
  const events = readRuntimeJsonl(jsonlPath);
  const candidates = events
    .filter(event => getCheckpointIdMatch(event, checkpointId))
    .sort((a, b) => {
      const tsA = typeof a.ts === 'string' ? Date.parse(a.ts) : NaN;
      const tsB = typeof b.ts === 'string' ? Date.parse(b.ts) : NaN;
      const safeA = Number.isFinite(tsA) ? tsA : Number.NEGATIVE_INFINITY;
      const safeB = Number.isFinite(tsB) ? tsB : Number.NEGATIVE_INFINITY;
      return safeB - safeA;
    });

  for (const candidate of candidates) {
    const payload = extractPayload(candidate);
    if (!payload) continue;
    const payloadObj = toObject(payload);
    if (!payloadObj) continue;
    try {
      return validateRestorePack(payloadObj);
    } catch {
      continue;
    }
  }
  return null;
};

export const buildRestorePlan = (
  hubRootAbs: string,
  pack: RestorePackV1,
): RestorePlanItem[] => {
  const root = path.resolve(hubRootAbs);
  return pack.files.map(file => {
    const targetPath = resolveTargetPath(root, file.relpath);
    const exists = fsSync.existsSync(targetPath);
    const bytesNew = Buffer.byteLength(file.content, 'utf8');
    const shaNew = sha256(file.content);
    if (!exists) {
      return {
        relpath: file.relpath,
        targetPath,
        exists: false,
        bytesNew,
        shaNew,
        bytesOld: 0,
        shaOld: null,
      };
    }
    const oldContent = fsSync.readFileSync(targetPath, 'utf8');
    return {
      relpath: file.relpath,
      targetPath,
      exists: true,
      bytesNew,
      shaNew,
      bytesOld: Buffer.byteLength(oldContent, 'utf8'),
      shaOld: sha256(oldContent),
    };
  });
};

export const applyRestoreTransactional = async (
  hubRootAbs: string,
  pack: RestorePackV1,
): Promise<{
  restored: number;
  backups: number;
  files: ApplyResultItem[];
  txnId: string;
  committed: boolean;
  rolledBack: boolean;
  fileCount: number;
  manifestPath: string;
}> => {
  const root = path.resolve(hubRootAbs);
  const plan = buildRestorePlan(root, pack);
  const fileByRelpath = new Map(pack.files.map(file => [file.relpath, file]));

  for (const item of plan) {
    const file = fileByRelpath.get(item.relpath);
    if (!file) {
      throw new Error(`Internal restore plan mismatch for ${item.relpath}`);
    }
    const computed = sha256(file.content);
    if (computed !== file.sha256) {
      throw new Error(
        `Pre-write sha256 mismatch for ${item.relpath}: expected ${file.sha256}, got ${computed}`,
      );
    }
  }

  const txn = await withRestoreTransaction(
    buildRestorePackFromCheckpoint({
      hubRootAbs: root,
      payload: pack,
    }),
    'restoreCheckpoint:/checkpoints/restore',
  );

  const files: ApplyResultItem[] = [];
  for (const item of plan) {
    const file = fileByRelpath.get(item.relpath)!;
    const written = await fs.readFile(item.targetPath, 'utf8');
    const writtenSha = sha256(written);
    if (writtenSha !== file.sha256) {
      throw new Error(
        `Post-write sha256 mismatch for ${item.relpath}: expected ${file.sha256}, got ${writtenSha}`,
      );
    }
    files.push({
      relpath: item.relpath,
      targetPath: item.targetPath,
      backupPath: null,
      shaBefore: item.shaOld,
      shaAfter: writtenSha,
      bytesBefore: item.bytesOld,
      bytesAfter: Buffer.byteLength(written, 'utf8'),
    });
  }

  return {
    restored: files.length,
    backups: plan.filter(item => item.exists).length,
    files,
    txnId: txn.txnId,
    committed: txn.committed,
    rolledBack: txn.rolledBack,
    fileCount: txn.fileCount,
    manifestPath: txn.manifestPath,
  };
};
