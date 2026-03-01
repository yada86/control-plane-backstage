import path from 'node:path';
import crypto from 'node:crypto';
import { RestoreWriteOp } from './restoreTransaction';

type RestoreFile = {
  relpath: string;
  encoding: 'utf8';
  content: string;
  sha256: string;
};

type RestorePackV1 = {
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

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value, 'utf8').digest('hex');

const toObject = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const extractPayload = (event: Record<string, unknown>): unknown => {
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

const validateRestorePackV1Files = (filesValue: unknown): RestoreFile[] => {
  if (!Array.isArray(filesValue) || filesValue.length === 0) {
    throw new Error('Invalid restore pack files: expected non-empty array');
  }

  return filesValue.map((file, index) => {
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
};

const validateRestorePackSmokeFiles = (filesValue: unknown): RestoreFile[] => {
  if (!Array.isArray(filesValue) || filesValue.length === 0) {
    throw new Error('Invalid restore pack hub.files: expected non-empty array');
  }

  return filesValue.map((file, index) => {
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
};

const validateRestorePack = (pack: unknown): RestorePackV1 | RestorePackSmoke => {
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

    return {
      schema: 'FS_RUNTIME_RESTORE_PACK_V1',
      checkpoint_id: obj.checkpoint_id,
      created_at: obj.created_at,
      files: validateRestorePackV1Files(obj.files),
    };
  }

  if (obj.schema === 'RESTORE_PACK') {
    const hub = toObject(obj.hub);
    if (!hub) {
      throw new Error('Invalid restore pack hub object');
    }

    const checkpointId =
      typeof obj.checkpoint_id === 'string' && obj.checkpoint_id.trim()
        ? obj.checkpoint_id
        : 'RESTORE_PACK';
    const createdAt =
      typeof obj.created_at === 'string' && obj.created_at.trim()
        ? obj.created_at
        : '1970-01-01T00:00:00.000Z';

    return {
      schema: 'RESTORE_PACK',
      checkpoint_id: checkpointId,
      created_at: createdAt,
      files: validateRestorePackSmokeFiles(hub.files),
    };
  }

  throw new Error('Invalid restore pack schema');
};

export function buildRestorePackFromCheckpoint(
  checkpointEvent: unknown,
): RestoreWriteOp[] {
  const eventObj = toObject(checkpointEvent);
  if (!eventObj) {
    throw new Error('Invalid checkpoint event: expected object');
  }

  const hubRoot = eventObj.hubRootAbs;
  if (typeof hubRoot !== 'string' || !hubRoot.trim()) {
    throw new Error('Invalid checkpoint event: missing hubRootAbs');
  }

  const hubRootAbs = path.resolve(hubRoot);
  if (!path.isAbsolute(hubRootAbs)) {
    throw new Error('Invalid checkpoint event: hubRootAbs must resolve to absolute path');
  }

  const payload = extractPayload(eventObj) ?? checkpointEvent;
  const pack = validateRestorePack(payload);

  return pack.files.map(file => ({
    absPath: resolveTargetPath(hubRootAbs, file.relpath),
    bytes: Buffer.from(file.content, 'utf8'),
  }));
}