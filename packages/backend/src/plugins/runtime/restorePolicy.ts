import fs from 'node:fs';
import path from 'node:path';
import { RestoreWriteOp } from './restoreTransaction';

type RestorePreviewLike = {
  files: Array<{
    absPath: string;
    action: 'CREATE' | 'OVERWRITE';
  }>;
  totals: {
    files: number;
    bytes_new: number;
  };
};

type RestorePolicyOptions = {
  allowHolyOverwrite?: boolean;
  maxFiles?: number;
  maxBytesNew?: number;
};

type EvaluateRestorePolicyArgs = {
  hubRootAbs: string;
  ops: RestoreWriteOp[];
  preview: RestorePreviewLike;
  options?: RestorePolicyOptions;
};

const HOLY_FILES = ['HUB_v4_CANONICAL.md', 'HUB_RULEBOOK.md', 'HUB_STATE.md'] as const;

const resolveNormalizedTarget = (absPath: string) => {
  const resolved = path.resolve(absPath);
  if (fs.existsSync(resolved)) {
    return fs.realpathSync(resolved);
  }

  const tailParts = [path.basename(resolved)];
  let cursor = path.dirname(resolved);

  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    tailParts.unshift(path.basename(cursor));
    cursor = parent;
  }

  const anchor = fs.realpathSync(cursor);
  return path.resolve(anchor, ...tailParts);
};

const isWithinRoot = (rootReal: string, targetReal: string) => {
  const rel = path.relative(rootReal, targetReal);
  return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
};

export function evaluateRestorePolicy(args: EvaluateRestorePolicyArgs): {
  ok: boolean;
  violations: string[];
  policy: {
    hubRootAbs: string;
    allowHolyOverwrite: boolean;
    holyFiles: string[];
    maxFiles: number;
    maxBytesNew: number;
  };
} {
  const maxFiles = args.options?.maxFiles ?? 200;
  const maxBytesNew = args.options?.maxBytesNew ?? 10_000_000;
  const allowHolyOverwrite = args.options?.allowHolyOverwrite ?? false;
  const violations: string[] = [];

  const hubRootReal = fs.realpathSync(path.resolve(args.hubRootAbs));

  for (const op of args.ops) {
    const targetReal = resolveNormalizedTarget(op.absPath);
    if (!isWithinRoot(hubRootReal, targetReal)) {
      violations.push(`Path outside hub root: ${op.absPath}`);
    }
  }

  if (!allowHolyOverwrite) {
    for (const file of args.preview.files) {
      if (file.action !== 'OVERWRITE') {
        continue;
      }
      if (HOLY_FILES.includes(path.basename(file.absPath) as (typeof HOLY_FILES)[number])) {
        violations.push(`Holy overwrite blocked: ${file.absPath}`);
      }
    }
  }

  if (args.preview.totals.files > maxFiles) {
    violations.push(
      `Restore file count exceeds maxFiles (${args.preview.totals.files} > ${maxFiles})`,
    );
  }
  if (args.preview.totals.bytes_new > maxBytesNew) {
    violations.push(
      `Restore bytes_new exceeds maxBytesNew (${args.preview.totals.bytes_new} > ${maxBytesNew})`,
    );
  }

  return {
    ok: violations.length === 0,
    violations,
    policy: {
      hubRootAbs: hubRootReal,
      allowHolyOverwrite,
      holyFiles: [...HOLY_FILES],
      maxFiles,
      maxBytesNew,
    },
  };
}