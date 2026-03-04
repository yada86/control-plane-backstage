import express from 'express';
import Router from 'express-promise-router';
import { Logger } from 'winston';
import { Config } from '@backstage/config';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import {
  applyRestoreTransactional,
  findRestorePackByCheckpointId,
} from './runtime_restore_engine';
import { createHubBackupFile } from './runtime/hubBackupRouting';
import { buildRestorePackFromCheckpoint } from './runtime/restorePackBuilder';
import { buildRestorePreview } from './runtime/restorePreview';
import { evaluateRestorePolicy } from './runtime/restorePolicy';

type RuntimeEvent = {
  ts?: string;
  project?: string;
  task_id?: string;
  event_type?: string;
  severity?: string;
  summary?: string;
  tags?: string[];
  facts?: Record<string, unknown>;
  checkpoint_id?: string;
  DOC_PATHS?: Record<string, string>;
  DOC_SNAPSHOTS?: Record<string, unknown>;
  HUB_PACK?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

type HubPatchRequest = {
  name?: unknown;
  dryRun?: unknown;
  patch?: {
    op?: unknown;
    text?: unknown;
    startMarker?: unknown;
    endMarker?: unknown;
  };
};

const REQUIRED_HUB_DOCS = [
  'HUB_RULEBOOK.md',
  'HUB_STATE.md',
  'HUB_SYSTEMS.md',
] as const;

const HUB_DOC_WHITELIST = [
  'HUB_RULEBOOK.md',
  'HUB_SYSTEMS.md',
  'HUB_STATE.md',
  'HUB_v4_CANONICAL.md',
] as const;

type FsRunbookLink = {
  title: string;
  path: string;
  keywords: string[];
};

const FS_RUNBOOK_TIER01_ALLOWLIST: FsRunbookLink[] = [
  {
    title: 'Baseline v1 verifier',
    path: '../docs/hub/content/runbook/baseline_v1_verifier.md',
    keywords: ['baseline', 'verifier', 'green', 'audit', 'healthcheck', 'hub-docs'],
  },
  {
    title: 'New Chat Start generator contract',
    path: '../docs/hub/content/docs/runtime/new-chat-start-generator/',
    keywords: ['new-chat-start', 'wrap', 'ssot', 'runtime', 'generator', 'debug', 'wrapkey'],
  },
  {
    title: 'Runtime Truth schema',
    path: '../runtime-truth.md',
    keywords: ['runtime', 'jsonl', 'facts', 'schema', 'event', 'checkpoint', 'wrap'],
  },
  {
    title: 'TechDocs flow + publish troubleshooting',
    path: '../docs/hub/content/runbook/techdocs_flow_troubleshooting/',
    keywords: ['techdocs', 'mkdocs', 'publish', 'publisher', 'publishdirectory', 'docs', 'hub-docs'],
  },
  {
    title: 'Backend port / EADDRINUSE guard',
    path: '../docs/hub/content/runbook/backend_port_guard/',
    keywords: ['eaddrinuse', 'port', '7007', 'backend', 'launcher', 'guard'],
  },
  {
    title: 'Graphviz snapshot renderer',
    path: '../docs/hub/content/runbook/graphviz_renderer/',
    keywords: ['graphviz', 'snapshot', 'dot', 'renderer', 'png', 'observability'],
  },
  {
    title: 'SAFE MODE (measure → patch → verify)',
    path: '../HUB_RULEBOOK.md',
    keywords: ['safe', 'measure', 'patch', 'verify', 'governance', 'laws'],
  },
  {
    title: 'Runbook Index',
    path: '../docs/hub/content/runbook/00__RUNBOOK_INDEX.md',
    keywords: ['runbook', 'index', 'triage', 'recovery', 'patterns'],
  },
];

function fsTokenizeTrack(s: string): string[] {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/g)
    .filter(Boolean)
    .slice(0, 24);
}

function fsPickRelevantRunbooks(
  activeTrackShort: string,
  max: number,
): Array<{ title: string; path: string; score: number }> {
  const toks = fsTokenizeTrack(activeTrackShort);
  if (!toks.length) return [];

  const scored = FS_RUNBOOK_TIER01_ALLOWLIST.map(l => {
    const hay = `${l.title} ${l.path} ${l.keywords.join(' ')}`.toLowerCase();
    const score = toks.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
    return { title: l.title, path: l.path, score };
  });

  const picked = scored
    .filter(x => x.score >= 1)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = a.title.localeCompare(b.title);
      if (ta !== 0) return ta;
      return a.path.localeCompare(b.path);
    })
    .slice(0, Math.max(0, max | 0));

  return picked;
}

function parseRootCandidatesFromEnv(): string[] {
  const raw = String(process.env.FS_HUB_ROOTS ?? '').trim();
  if (!raw) return [];
  return raw
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
}

function winToWslPath(p: string): string {
  const s = String(p ?? '');
  if (!s) return s;
  if (s.startsWith('/')) return s;
  const m = /^([A-Za-z]):\\(.*)$/.exec(s);
  if (!m) return s;
  const drive = m[1].toLowerCase();
  const rest = m[2].replace(/\\/g, '/');
  return `/mnt/${drive}/${rest}`;
}

function normalizeDocPathsMap(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(map ?? {})) {
    out[k] = winToWslPath(map[k]);
  }
  return out;
}

const isLoopbackAddress = (value: string | undefined) => {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '::ffff:127.0.0.1'
  );
};

const isLocalDev = (req: express.Request) => {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  const hostName = String(req.hostname ?? '').trim().toLowerCase();
  if (hostName === 'localhost') {
    return true;
  }

  if (isLoopbackAddress(req.ip)) {
    return true;
  }

  return isLoopbackAddress(req.socket?.remoteAddress);
};

export default async function createRouter(options: {
  logger: Logger;
  config: Config;
}): Promise<express.Router> {
  const { logger, config } = options;
  const router = Router();
  router.use(express.json({ limit: '2mb' }));

  const filePath =
    config.getOptionalString('runtimeTruth.filePath') ??
    config.getOptionalString('runtimeTruth.jsonlPath') ??
    process.env.RUNTIME_TRUTH_PATH ??
    '';
  const runtimeJsonlPath =
    config.getOptionalString('runtimeTruth.jsonlPath') ??
    process.env.RUNTIME_TRUTH_PATH ??
    filePath;
  const hubDocsRootPath = config.getOptionalString('hubDocs.rootPath');
  const latestPath =
    config.getOptionalString('runtimeTruth.latestPath') ??
    path.join(path.dirname(filePath), 'runtime.latest.json');

  const parseLimit = (rawValue: unknown, defaultLimit = 200) => {
    const rawLimit = Number.parseInt(String(rawValue ?? ''), 10);
    const parsedLimit = Number.isNaN(rawLimit) ? defaultLimit : rawLimit;
    return Math.min(2000, Math.max(1, parsedLimit));
  };

  const parseJsonFile = <T>(targetPath: string): T => {
    const text = fs.readFileSync(targetPath, 'utf8');
    return JSON.parse(text) as T;
  };

  const loadAllEvents = (): RuntimeEvent[] => {
    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split(/\r?\n/).filter(Boolean);
    const events: RuntimeEvent[] = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          events.push(parsed as RuntimeEvent);
        }
      } catch {
        logger.warn(
          `Skipping invalid runtime JSONL line: ${line.slice(0, 120)}`,
        );
      }
    }
    return events;
  };

  const loadEvents = (limit: number) => loadAllEvents().slice(-limit).reverse();

  const sha256 = (value: string) =>
    crypto.createHash('sha256').update(value, 'utf8').digest('hex');

  const getLatestRuntimePayload = () => {
    if (!fs.existsSync(latestPath)) {
      const error = new Error(`Missing runtime.latest.json at ${latestPath}`);
      (error as Error & { status?: number }).status = 409;
      throw error;
    }
    return parseJsonFile<Record<string, unknown>>(latestPath);
  };

  const extractDocPaths = (latestPayload: Record<string, unknown>) => {
    const fromTop = latestPayload.DOC_PATHS;
    const fromPayload =
      typeof latestPayload.payload === 'object' && latestPayload.payload
        ? (latestPayload.payload as Record<string, unknown>).DOC_PATHS
        : undefined;
    const fromCheckpoint =
      typeof latestPayload.checkpoint === 'object' && latestPayload.checkpoint
        ? (latestPayload.checkpoint as Record<string, unknown>).DOC_PATHS
        : undefined;
    const fromEvents = Array.isArray(latestPayload.events)
      ? (latestPayload.events[0] as Record<string, unknown> | undefined)
          ?.DOC_PATHS
      : undefined;

    const candidate = fromTop ?? fromPayload ?? fromCheckpoint ?? fromEvents;
    if (!candidate || typeof candidate !== 'object') {
      const error = new Error(
        'DOC_PATHS missing in latest checkpoint; push DOC_PATHS via CHECKPOINT event first.',
      );
      (error as Error & { status?: number }).status = 409;
      throw error;
    }

    const docPaths = candidate as Record<string, unknown>;
    const normalized: Record<string, string> = {};
    for (const name of REQUIRED_HUB_DOCS) {
      const next = docPaths[name];
      if (typeof next === 'string' && next.trim()) {
        normalized[name] = next;
      }
    }

    if (Object.keys(normalized).length === 0) {
      const error = new Error(
        'DOC_PATHS missing in latest checkpoint; push DOC_PATHS via CHECKPOINT event first.',
      );
      (error as Error & { status?: number }).status = 409;
      throw error;
    }

    return normalized;
  };

  function _ts(ev: any): string {
    return String(ev?.ts ?? '');
  }

  function pickLatestDocPathsCheckpoint(events: any[]) {
    const list = Array.isArray(events) ? events : [];
    const sorted = [...list].sort((a, b) =>
      _ts(b).localeCompare(_ts(a)),
    );
    for (const ev of sorted) {
      const type = String(ev?.event_type ?? ev?.eventType ?? '').toUpperCase();
      if (type !== 'CHECKPOINT') continue;
      const schema = String(
        ev?.facts?.payload?.schema ?? ev?.facts?.schema ?? '',
      ).toUpperCase();
      if (schema !== 'DOC_PATHS') continue;
      return ev;
    }
    return undefined;
  }

  const extractDocPathsFromDocPathsCheckpoint = (checkpoint: RuntimeEvent) => {
    const facts =
      checkpoint.facts && typeof checkpoint.facts === 'object'
        ? (checkpoint.facts as Record<string, unknown>)
        : {};
    const payload =
      typeof facts.payload === 'object' && facts.payload
        ? (facts.payload as Record<string, unknown>)
        : undefined;

    const candidate =
      (payload?.DOC_PATHS as Record<string, unknown> | undefined) ??
      (payload?.doc_paths as Record<string, unknown> | undefined) ??
      (payload?.paths as Record<string, unknown> | undefined) ??
      (facts.DOC_PATHS as Record<string, unknown> | undefined);

    if (!candidate || typeof candidate !== 'object') {
      const error = new Error(
        'DOC_PATHS not found in recent checkpoints window; push DOC_PATHS via CHECKPOINT event first.',
      );
      (error as Error & { status?: number }).status = 409;
      throw error;
    }

    const normalized: Record<string, string> = {};
    for (const name of REQUIRED_HUB_DOCS) {
      const baseName = name.replace(/\.md$/i, '');
      const next =
        candidate[name] ??
        candidate[baseName] ??
        candidate[baseName.toUpperCase()] ??
        candidate[baseName.toLowerCase()];
      if (typeof next === 'string' && next.trim()) {
        normalized[name] = next;
      }
    }

    if (Object.keys(normalized).length === 0) {
      const error = new Error(
        'DOC_PATHS not found in recent checkpoints window; push DOC_PATHS via CHECKPOINT event first.',
      );
      (error as Error & { status?: number }).status = 409;
      throw error;
    }

    return normalized;
  };

  const extractDocPathsFromCheckpoint = (
    ev: RuntimeEvent,
  ): Record<string, string> | undefined => {
    const payloadCandidate =
      ev?.facts && typeof ev.facts === 'object'
        ? ((ev.facts as Record<string, unknown>).payload as Record<string, unknown> | undefined)
        : undefined;
    const p = (payloadCandidate ?? ev?.facts ?? undefined) as
      | Record<string, unknown>
      | undefined;
    if (!p) return undefined;
    const schema = String(p?.schema ?? '').toUpperCase();
    if (schema !== 'DOC_PATHS') return undefined;

    const dp =
      (p?.docPaths as Record<string, unknown> | undefined) ??
      (p?.doc_paths as Record<string, unknown> | undefined) ??
      ((p?.hub as Record<string, unknown> | undefined)?.docPaths as
        | Record<string, unknown>
        | undefined) ??
      ((p?.hub as Record<string, unknown> | undefined)?.doc_paths as
        | Record<string, unknown>
        | undefined) ??
      (p?.DOC_PATHS as Record<string, unknown> | undefined) ??
      (p?.paths as Record<string, unknown> | undefined);

    if (!dp || typeof dp !== 'object') return undefined;

    const out: Record<string, string> = {};
    for (const name of REQUIRED_HUB_DOCS) {
      const baseName = name.replace(/\.md$/i, '');
      const next =
        dp[name] ??
        dp[baseName] ??
        dp[baseName.toUpperCase()] ??
        dp[baseName.toLowerCase()];
      if (typeof next === 'string' && next.trim()) {
        out[name] = next;
      }
    }
    return Object.keys(out).length ? out : undefined;
  };

  const fileExists = async (targetPath: string): Promise<boolean> => {
    try {
      await fsPromises.stat(targetPath);
      return true;
    } catch {
      return false;
    }
  };

  const tryResolveFromRoots = async (
    roots: string[],
  ): Promise<Record<string, string> | undefined> => {
    for (const root of roots) {
      const rootWsl = winToWslPath(root);
      const out: Record<string, string> = {};
      for (const name of HUB_DOC_WHITELIST) {
        const targetPath = path.join(rootWsl, name);
        if (await fileExists(targetPath)) {
          out[name] = targetPath;
        }
      }
      if (out['HUB_RULEBOOK.md'] && out['HUB_SYSTEMS.md'] && out['HUB_STATE.md']) {
        return out;
      }
    }
    return undefined;
  };

  const resolveHubDocPaths = async (eventsWindow: RuntimeEvent[]) => {
    const docEv = pickLatestDocPathsCheckpoint(eventsWindow);
    const fromCheckpointRaw = docEv ? extractDocPathsFromCheckpoint(docEv) : undefined;
    if (fromCheckpointRaw && Object.keys(fromCheckpointRaw).length) {
      return {
        ok: true,
        source: 'checkpoint_doc_paths',
        reason: undefined as string | undefined,
        docPaths: normalizeDocPathsMap(fromCheckpointRaw),
      };
    }

    const envRoots = parseRootCandidatesFromEnv();
    const configRoots = hubDocsRootPath ? [hubDocsRootPath] : [];
    const roots = envRoots.length ? envRoots : configRoots;
    if (roots.length) {
      const hit = await tryResolveFromRoots(roots);
      if (hit && Object.keys(hit).length) {
        return {
          ok: true,
          source: envRoots.length ? 'fallback_root_candidates' : 'hub_docs_root_path',
          reason: envRoots.length
            ? 'DOC_PATHS not found; resolved via FS_HUB_ROOTS candidates'
            : 'DOC_PATHS not found; resolved via hubDocs.rootPath fallback',
          docPaths: hit,
        };
      }
    }

    return {
      ok: false,
      source: 'none',
      reason: roots.length
        ? envRoots.length
          ? 'DOC_PATHS not found and no HUB files found in FS_HUB_ROOTS candidates'
          : 'DOC_PATHS not found and no HUB files found in hubDocs.rootPath fallback'
        : 'DOC_PATHS not found and FS_HUB_ROOTS is empty (no fallback roots configured)',
      docPaths: {} as Record<string, string>,
    };
  };

  const resolveHubPathByName = (name: string) => {
    const eventsWindow = loadEvents(200);
    const docEv = pickLatestDocPathsCheckpoint(eventsWindow);
    if (!docEv) {
      const error = new Error(
        'DOC_PATHS not found in recent checkpoints window; push DOC_PATHS via CHECKPOINT event first.',
      );
      (error as Error & { status?: number }).status = 409;
      throw error;
    }
    const docPaths = extractDocPathsFromDocPathsCheckpoint(docEv);
    const resolved = docPaths[name];
    if (!resolved) {
      const error = new Error(`DOC_PATHS does not define file name: ${name}`);
      (error as Error & { status?: number }).status = 404;
      throw error;
    }
    return { docPaths, resolvedPath: resolved };
  };

  const toWslPathIfWindows = (targetPath: string) => {
    if (!/^[A-Za-z]:\\/.test(targetPath)) {
      return targetPath;
    }
    const drive = targetPath[0].toLowerCase();
    const rest = targetPath.slice(2).replace(/\\/g, '/');
    return `/mnt/${drive}/${rest.replace(/^\//, '')}`;
  };

  const ensureString = (value: unknown, field: string) => {
    if (typeof value !== 'string' || !value.trim()) {
      const error = new Error(`Invalid ${field}: expected non-empty string`);
      (error as Error & { status?: number }).status = 400;
      throw error;
    }
    return value;
  };

  const getJsonBody = (req: express.Request): Record<string, unknown> | null => {
    const body = (req as { body?: unknown }).body;
    if (body && typeof body === 'object') {
      return body as Record<string, unknown>;
    }
    if (typeof body === 'string' && body.trim().length > 0) {
      try {
        return JSON.parse(body) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  };

  const buildPatchedContent = (
    oldContent: string,
    patchSpec: Required<NonNullable<HubPatchRequest['patch']>>,
  ) => {
    if (patchSpec.op === 'append') {
      const base = oldContent.endsWith('\n') ? oldContent : `${oldContent}\n`;
      const payload = patchSpec.text.endsWith('\n')
        ? patchSpec.text
        : `${patchSpec.text}\n`;
      return `${base}${payload}`;
    }

    if (patchSpec.op === 'replace_between_markers') {
      const start = oldContent.indexOf(patchSpec.startMarker);
      const end = oldContent.indexOf(patchSpec.endMarker);
      if (start < 0 || end < 0 || start >= end) {
        const error = new Error(
          'replace_between_markers requires valid startMarker and endMarker with start before end',
        );
        (error as Error & { status?: number }).status = 400;
        throw error;
      }
      const startEnd = start + patchSpec.startMarker.length;
      const prefix = oldContent.slice(0, startEnd);
      const suffix = oldContent.slice(end);
      const replacement = patchSpec.text.endsWith('\n')
        ? patchSpec.text
        : `${patchSpec.text}\n`;
      return `${prefix}\n${replacement}${suffix}`;
    }

    const error = new Error(
      `Invalid patch.op: ${String(patchSpec.op)} (allowed: append, replace_between_markers)`,
    );
    (error as Error & { status?: number }).status = 400;
    throw error;
  };

  const writeAtomicWithBackup = (targetPath: string, content: string) => {
    const backupPath = createHubBackupFile(targetPath);
    const tempPath = `${targetPath}.tmp_${process.pid}_${Date.now()}`;
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, targetPath);
    return backupPath;
  };

  const parseSnapshots = (checkpoint: RuntimeEvent) => {
    const topSnapshots = checkpoint.DOC_SNAPSHOTS;
    const factsSnapshots =
      checkpoint.facts && typeof checkpoint.facts === 'object'
        ? (checkpoint.facts.DOC_SNAPSHOTS as Record<string, unknown> | undefined)
        : undefined;
    const topPack = checkpoint.HUB_PACK;
    const factsPack =
      checkpoint.facts && typeof checkpoint.facts === 'object'
        ? (checkpoint.facts.HUB_PACK as Record<string, unknown> | undefined)
        : undefined;

    const source = topSnapshots ?? factsSnapshots ?? topPack ?? factsPack;
    if (!source || typeof source !== 'object') return undefined;

    const snapshots: Record<string, string> = {};
    for (const name of REQUIRED_HUB_DOCS) {
      const raw = (source as Record<string, unknown>)[name];
      if (typeof raw === 'string') {
        snapshots[name] = raw;
      } else if (raw && typeof raw === 'object') {
        const candidate = (raw as Record<string, unknown>).content;
        if (typeof candidate === 'string') {
          snapshots[name] = candidate;
        }
      }
    }
    return Object.keys(snapshots).length ? snapshots : undefined;
  };

  router.get('/events', async (req, res) => {
    const limit = parseLimit(req.query.limit, 200);
    const limited = loadEvents(limit);

    res.json({ filePath, limit, events: limited });
  });

  router.get('/new-chat-start', async (req, res) => {
    try {
      const MAX_RELEVANT_CHECKPOINTS = 7;
      const limit = parseLimit(req.query.limit, 200);
      const maxCheckpoints = Math.min(
        parseLimit(req.query.maxCheckpoints, MAX_RELEVANT_CHECKPOINTS),
        MAX_RELEVANT_CHECKPOINTS,
      );
      const debug = String(req.query.debug ?? '0') === '1';

      const events = loadEvents(limit);

      const taskish = (ev: any) =>
        String(ev?.task_id ?? ev?.taskId ?? ev?.id ?? ev?.event_id ?? ev?.name ?? '');

      const toMs = (ts: any) => {
        const t = Date.parse(String(ts ?? ''));
        return Number.isNaN(t) ? 0 : t;
      };

      const wraps = events.filter((ev: any) => taskish(ev).startsWith('HUB_SESSION_WRAP'));
      const latestWrap = wraps.reduce((best: any, ev: any) => {
        if (!best) return ev;
        return toMs(ev?.ts) > toMs(best?.ts) ? ev : best;
      }, undefined);

      const pickLatestRuntimeGate = (allEvents: any[]) => {
        const gateEvents = (allEvents ?? []).filter((ev: any) => {
          const key = taskish(ev);
          return key.includes('RUNTIME_GREEN_GATE');
        });

        const latestGate = gateEvents.reduce((best: any, ev: any) => {
          if (!best) return ev;
          return toMs(ev?.ts) > toMs(best?.ts) ? ev : best;
        }, undefined);

        const gateKey = latestGate ? taskish(latestGate) : '';
        const gateTs = latestGate ? String(latestGate?.ts ?? '') : '';
        if (!latestGate) {
          return { gateFound: false, gateOk: false, gateKey, gateTs };
        }

        const gateFacts =
          (latestGate?.facts && typeof latestGate.facts === 'object' ? latestGate.facts : null) ??
          (latestGate?.payload?.facts && typeof latestGate.payload.facts === 'object' ? latestGate.payload.facts : null) ??
          (latestGate?.payload && typeof latestGate.payload === 'object' ? latestGate.payload : {}) ??
          {};

        const gateOkFromPayload =
          gateFacts?.verification?.runtime_green_gate?.ok ??
          gateFacts?.runtime_green_gate?.ok ??
          gateFacts?.ok ??
          latestGate?.payload?.ok;

        let gateOk = false;
        if (typeof gateOkFromPayload === 'boolean') {
          gateOk = gateOkFromPayload;
        } else {
          const statusRaw = String(latestGate?.status ?? gateFacts?.status ?? '').toUpperCase();
          gateOk = statusRaw === 'GREEN' || statusRaw === 'OK' || statusRaw === 'PASS';
        }

        return { gateFound: true, gateOk, gateKey, gateTs };
      };

      const gate = pickLatestRuntimeGate(events);

      const wrapKey = latestWrap ? taskish(latestWrap) : '';
      const wrapTs = latestWrap ? String(latestWrap?.ts ?? '') : '';

      const fsPickSessionSummaryFacts = (raw: any): any => {
        const isObj = (x: any) => x && typeof x === 'object' && !Array.isArray(x);
        if (!isObj(raw)) return {};

        if (String(raw.schema ?? '').toUpperCase() === 'SESSION_SUMMARY') return raw;

        if (isObj(raw.facts) && String(raw.facts.schema ?? '').toUpperCase() === 'SESSION_SUMMARY') return raw.facts;

        for (const k of Object.keys(raw)) {
          const v = (raw as any)[k];
          if (isObj(v) && String(v.schema ?? '').toUpperCase() === 'SESSION_SUMMARY') return v;
        }

        for (const k of Object.keys(raw)) {
          const v = (raw as any)[k];
          if (!isObj(v)) continue;
          for (const kk of Object.keys(v)) {
            const vv = (v as any)[kk];
            if (isObj(vv) && String(vv.schema ?? '').toUpperCase() === 'SESSION_SUMMARY') return vv;
          }
        }

        return raw;
      };

      const rawFacts =
        (latestWrap?.facts && typeof latestWrap.facts === 'object' ? latestWrap.facts : null) ??
        (latestWrap?.payload?.facts && typeof latestWrap.payload.facts === 'object' ? latestWrap.payload.facts : null) ??
        (latestWrap?.payload && typeof latestWrap.payload === 'object' ? latestWrap.payload : {}) ??
        {};

      const facts = fsPickSessionSummaryFacts(rawFacts);
      const objKeys = (x: any) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).slice(0, 50) : [];

      const asStrArr = (v: any) => (Array.isArray(v) ? v.map((x: any) => String(x).trim()).filter(Boolean) : []);
      const next = asStrArr(facts?.next_actions ?? facts?.nextActions ?? facts?.next ?? []);
        // --- git detection (best-effort, no throw) ---
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { execSync } = require('node:child_process');
        const gitRoot = (() => {
          try {
            return String(execSync('git rev-parse --show-toplevel', {
              cwd: process.cwd(),
              stdio: ['ignore', 'pipe', 'ignore'],
            }) ?? '').trim();
          } catch {
            return '';
          }
        })();
        const gitDetected = Boolean(gitRoot);

        // --- scrub outdated next-actions (only when git already exists) ---
        const scrubNext = (arr: string[]) => {
          const rx = /(git\s+init\s+baseline\b|git\s+init\b)/i;
          return arr
            .map(x => String(x ?? '').trim())
            .filter(Boolean)
            .filter(x => !(gitDetected && rx.test(x)));
        };

        const nextScrubbed = scrubNext(next);

      const issues = asStrArr(facts?.known_issues ?? facts?.knownIssues ?? facts?.issues ?? []);
      const goals = asStrArr(facts?.active_goals ?? facts?.activeGoals ?? []);

        // facts payload (debug only): expose normalized arrays so UI can render NEXT ACTIONS deterministically
        const factsOut = {
          ...((facts && typeof facts === 'object') ? facts : {}),
          next_actions: nextScrubbed,
          known_issues: issues,
          active_goals: goals,
        };


      const normalizeCompact = (v: any) => String(v ?? '').replace(/\s+/g, ' ').trim();
      const wrapGoal = normalizeCompact(facts?.goal ?? facts?.Goal ?? '');
      const wrapSummary = normalizeCompact(facts?.summary ?? latestWrap?.summary ?? '');
      const rawMission = wrapGoal || wrapSummary || '';
      const missionSource: 'goal' | 'summary' | 'none' = wrapGoal
        ? 'goal'
        : wrapSummary
          ? 'summary'
          : 'none';

      const wrapNextAction = normalizeCompact(
        facts?.next_action ?? facts?.nextAction ?? facts?.next ?? nextScrubbed[0] ?? '',
      );
      const rawTrack = wrapNextAction || wrapGoal || '';
      const trackSource: 'nextAction' | 'goal' | 'none' = wrapNextAction
        ? 'nextAction'
        : wrapGoal
          ? 'goal'
          : 'none';

      const clampMissionLines = (input: string): string[] => {
        const compact = normalizeCompact(input);
        if (!compact) return ['—'];

        const chunks = compact
          .split(/(?:\n|;|\.(?=\s))/)
          .map(x => normalizeCompact(x))
          .filter(Boolean);

        if (chunks.length >= 2) {
          return chunks.slice(0, 2);
        }

        const single = chunks[0] ?? compact;
        if (single.length <= 180) return [single];
        const cutAt = single.lastIndexOf(' ', 180);
        if (cutAt > 40) {
          return [single.slice(0, cutAt).trim(), single.slice(cutAt + 1).trim()].slice(0, 2);
        }
        return [single.slice(0, 180).trim(), single.slice(180).trim()].slice(0, 2);
      };

      const missionLines = clampMissionLines(rawMission);
      const missionText = missionLines.join(' | ');

      const trackLines = rawTrack
        ? rawTrack
            .split(/[;\n]+/)
            .map(x => normalizeCompact(x))
            .filter(Boolean)
            .slice(0, 3)
        : [];

      const trackBulletLines = trackLines.length ? trackLines : ['—'];

      const stopwords = new Set([
        'that', 'this', 'with', 'from', 'into', 'over', 'when', 'then',
        'skal', 'ikke', 'bare', 'neste', 'må', 'som', 'for', 'med', 'til',
        'der', 'det', 'den', 'dette', 'ingen', 'none',
      ]);

      const trackTokens = (rawTrack || '')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .map(x => x.trim())
        .filter(x => x.length >= 4)
        .filter(x => !stopwords.has(x))
        .slice(0, 12);

      const strategicText = `${wrapSummary} ${wrapGoal} ${wrapNextAction}`.toLowerCase();
      let strategicPhase = '—';
      if (/(stabiliz|stability|hardening|verify|verification|green)/.test(strategicText)) {
        strategicPhase = 'Stabilization (derived)';
      } else if (/(build|implement|patch|upgrade|migrate|refactor)/.test(strategicText)) {
        strategicPhase = 'Implementation (derived)';
      } else if (/(measure|analy|triage|diagnos|investig|read only)/.test(strategicText)) {
        strategicPhase = 'Measurement/Triage (derived)';
      }

      const activeTrackShort = trackBulletLines[0] && trackBulletLines[0] !== '—'
        ? trackBulletLines[0]
        : '—';
      const missionShort = missionLines[0] && missionLines[0] !== '—'
        ? missionLines[0]
        : '—';
      const currentMainTask = goals[0] || '—';
      const currentNextAction = nextScrubbed[0] || '—';
      const currentKnownIssue = issues[0] || '—';

      const isCheckpoint = (ev: any) => {
        const t = String(ev?.event_type ?? ev?.type ?? '').toUpperCase();
        const s = String(ev?.summary ?? '').toUpperCase();
        return t.includes('CHECKPOINT') || s.startsWith('CHECKPOINT');
      };

      const checkpointsNewest = events
        .filter(isCheckpoint)
        .sort((a: any, b: any) => toMs(b?.ts) - toMs(a?.ts));

      let checkpointsFiltered = false;
      let checkpoints = checkpointsNewest.slice(0, maxCheckpoints);

      if (trackTokens.length >= 2) {
        const scored = checkpointsNewest.map((ev: any) => {
          const haystack = `${taskish(ev)} ${String(ev?.summary ?? '')} ${String(ev?.title ?? '')}`.toLowerCase();
          const score = trackTokens.reduce((acc, tok) => acc + (haystack.includes(tok) ? 1 : 0), 0);
          return { ev, score, ts: toMs(ev?.ts) };
        });

        const matched = scored
          .filter(x => x.score >= 1)
          .sort((a, b) => b.ts - a.ts)
          .map(x => x.ev);

        if (matched.length > 0) {
          checkpointsFiltered = true;
          const merged: any[] = [];
          const seen = new Set<string>();

          const addUnique = (ev: any) => {
            const key = `${String(ev?.ts ?? '')}::${taskish(ev)}::${String(ev?.summary ?? '')}`;
            if (seen.has(key)) return;
            seen.add(key);
            merged.push(ev);
          };

          for (const ev of matched) {
            if (merged.length >= MAX_RELEVANT_CHECKPOINTS) break;
            addUnique(ev);
          }
          for (const ev of checkpointsNewest) {
            if (merged.length >= MAX_RELEVANT_CHECKPOINTS) break;
            addUnique(ev);
          }

          checkpoints = merged.slice(0, maxCheckpoints);
        }
      }

      checkpoints = checkpoints.slice(0, MAX_RELEVANT_CHECKPOINTS);

      const fmtCp = (ev: any) => `⚪ ${String(ev?.ts ?? 'n/a')} | ${taskish(ev)} | ${String(ev?.summary ?? '')}`;

      const nowIso = new Date().toISOString();
      const lines: string[] = [];
      lines.push('==================== NEW CHAT START — CONTROL_PLANE ====================');
      lines.push('MODE: READ ONLY');
      lines.push('TOOL: VSCAI_WSL');
      lines.push(`DATE/TZ: Europe/Oslo | ${nowIso}`);
      if (gate.gateFound && gate.gateOk) {
        lines.push(`STATUS: GREEN (runtime gate OK @ ${gate.gateTs || 'n/a'})`);
      } else if (gate.gateFound && !gate.gateOk) {
        lines.push(`STATUS: RED (runtime gate FAIL @ ${gate.gateTs || 'n/a'})`);
      } else {
        lines.push('STATUS: YELLOW (no runtime gate event found)');
      }
      lines.push('ENGINE MODE: SAFE');
      lines.push(`RISK LEVEL: ${gate.gateFound ? (gate.gateOk ? 'LOW' : 'HIGH') : 'MEDIUM'}`);
      lines.push('');

      lines.push('NORTH STAR (DO NOT DRIFT)');
      lines.push('- RuntimeTruth is SSOT');
      lines.push('- Append-only history');
      lines.push('- No hidden state');
      lines.push('- UI must never lie');
      lines.push('- No architecture expansion without explicit order');
      lines.push('');

      lines.push('EXECUTION LAW (NON-NEGOTIABLE)');
      lines.push('- ÉN BLOKK OM GANGEN: Only ONE runnable block per assistant message.');
      lines.push('- Wait for execution output before issuing the next block. No batching.');
      lines.push('');

      lines.push('BLOCK MARKING LAW (NON-NEGOTIABLE)');
      lines.push('- Every runnable block MUST be preceded (outside the code fence) with:');
      lines.push('  "LIM RETT INN I → VSCAI_WSL / WSL TERMINAL (EXEC) / POWERSHELL / VSCAI_WIN"');
      lines.push('- If a runnable block is not clearly marked, it is INVALID output.');
      lines.push('');

      lines.push('DOC LAW (NON-NEGOTIABLE)');
      lines.push('- Any new technical behavior (scripts/paths/commands/policies/defaults) MUST be documented');
      lines.push('  in TechDocs AND indexed in Runbook BEFORE continuing.');
      lines.push('- If it’s not documented → hidden state → STOP.');
      lines.push('');
      lines.push('DOCS-FIRST GATE (HARD)');
      lines.push('- BEFORE any patch/code: open Runbook Index and confirm canonical page exists for the topic.');
      lines.push('- Runbook Index: ../docs/hub/content/runbook/00__RUNBOOK_INDEX.md');
      lines.push('- If missing/not indexed → next action is docs + index (NOT code).');
      lines.push('- If assistant proposes a patch without a docs-check first → STOP and go to Runbook Index.');
      lines.push('');

      lines.push('MEASUREMENT LAW');
      lines.push('- Vi antar ikke. Vi måler. Inspect before patching.');
      lines.push('- Default is READ ONLY until an explicit PATCH step is chosen.');
      lines.push('');

      lines.push('SCOPE / ARCHITECTURE LAW');
      lines.push('- No new endpoints/services/schemas/expansions without explicit order.');
      lines.push('- Minimal diffs only. No refactors unless ordered.');
      lines.push('');

      lines.push('STANDARD WORKFLOW (ALWAYS)');
      lines.push('- 1) Pick tool explicitly: VSCAI (edit files) / WSL EXEC (measure+run) / PWS (Windows truth) / LOCAL AI (optional).');
      lines.push('- 2) Measure → Patch → Verify → Wrap.');
      lines.push('- 3) After any PATCH: verify SSOT loop + docs compliance.');
      lines.push('');
      lines.push('BASH/PASTE SAFETY (NON-NEGOTIABLE)');
      lines.push('- SHORT BLOCK LAW: no pasted EXEC block > ~60 lines. If longer: write to file then run the file.');
      lines.push('- NO HEREDOC IN CHAT: avoid <<EOF in pasted blocks (paste corruption risk).');
      lines.push('- NO PIPES INTO PARSERS: always curl > "$TMP" then parse the file (no | python, no | jq).');
      lines.push('- ALWAYS mktemp + FILE PARSE: TMP="$(mktemp ...)" then read TMP in python/jq.');
      lines.push('- QUOTE LAW: every $VAR in bash commands must be in double quotes.');
      lines.push('- ANTI-UNBOUND: define variables immediately before use; never rely on previous blocks.');
      lines.push('- IF PASTE FAILS: stop and switch to file-based execution; do not brute-force “block 5”.');
      lines.push('');

      lines.push('SSOT TASK CONTEXT (FROM LATEST WRAP)');
      lines.push(`- MAIN TASK (GOAL): ${currentMainTask}`);
      lines.push(`- NEXT ACTION (LAST WRAP): ${currentNextAction}`);
      lines.push(`- KNOWN ISSUE (LAST WRAP): ${currentKnownIssue}`);
      lines.push(`- LATEST WRAP (SSOT): ${wrapKey || 'n/a'} | ${wrapTs || 'n/a'}`);
      lines.push('');

      lines.push('KEY DOC LINKS (CANONICAL)');
      lines.push('- [HUB Rulebook — SAFE MODE + copy rules + governance](../HUB_RULEBOOK.md)');
      lines.push('- [HUB Systems — canonical paths + ports + architecture map](../HUB_SYSTEMS.md)');
      lines.push('- [HUB State — current operational baseline](../HUB_STATE.md)');
      lines.push('- [Runbook Index — triage and recovery patterns](../docs/hub/content/runbook/00__RUNBOOK_INDEX.md)');
      lines.push('- [Runtime Truth — event schema + generator contract](../runtime-truth.md)');
      lines.push('');

      lines.push('RUNTIME INSTRUCTIONS (CANONICAL)');
      lines.push('A) PUSH WRAP (WSL terminal only)');
      lines.push('- Command (one line per flag, no fancy pipes):');
      lines.push('/home/danie/control_plane/runtime_truth_store/fs_push_session_wrap.sh \\');
      lines.push('  --id "HUB_SESSION_WRAP__<SHORT_NAME>__YYYY-MM-DD" \\');
      lines.push('  --summary "<1–2 lines: what changed + what is now true>" \\');
      lines.push('  --known-issue "<blockers or —>" \\');
      lines.push('  --next-action "<exact next step>" \\');
      lines.push('  --goal "<goal of next chat>" \\');
      lines.push('  --show');
      lines.push('');
      lines.push('B) VERIFY SSOT LOOP (READ ONLY)');
      lines.push('- Always: fetch to file → parse file (avoid heredoc stdin traps):');
      lines.push('');
      lines.push("REMINDER: All runnable blocks must be labeled 'LIM RETT INN I → …' or they are INVALID.");
      lines.push('```bash');
      lines.push('BASE="http://127.0.0.1:7007"');
      lines.push('TMP="$(mktemp /tmp/ncs_verify_XXXXXX.json)"');
      lines.push('curl -sS --max-time 8 "$BASE/api/runtime/new-chat-start?debug=1" > "$TMP"');
      lines.push('python3 - <<PY');
      lines.push('import json');
      lines.push('p = "$TMP"');
      lines.push('with open(p, "r", encoding="utf-8") as f:');
      lines.push('    d = json.load(f)');
      lines.push('m = d.get("meta") or {}');
      lines.push('print("[OK] meta.wrapFound =", m.get("wrapFound"))');
      lines.push('print("[OK] meta.wrapKey   =", m.get("wrapKey"))');
      lines.push('print("[OK] meta.wrapTs    =", m.get("wrapTs"))');
      lines.push('PY');
      lines.push('```');
      lines.push('- Expect: meta.wrapFound=True and meta.wrapKey == the wrap you just pushed.');
      lines.push('');

      lines.push('C) HEALTH CHECK (READ ONLY)');
      lines.push('- Canonical:');
      lines.push('  /home/danie/control_plane/runtime_truth_store/runtime_health.sh');
      lines.push('- Shortcut (PATH):');
      lines.push('  cp_health');
      lines.push('- Guardian loop (systemd user):');
      lines.push('  systemctl --user status cp-guardian.timer --no-pager');
      lines.push('  journalctl --user -u cp-guardian.service -n 80 --no-pager');
      lines.push('');

      lines.push('D) DOC UPDATE (CANONICAL)');
      lines.push('- All docs edits happen via VSCAI_WSL (minimal diff).');
      lines.push('- After docs PATCH, verify:');
      lines.push('  - file exists at expected path');
      lines.push('  - Runbook Index contains correct link');
      lines.push('  - grep shows new keyword(s)');
      lines.push('');

      lines.push('PRIMARY DOCS (DON’T GUESS)');
      lines.push('- Runbook Index: ../docs/hub/content/runbook/00__RUNBOOK_INDEX.md');
      lines.push('- Runtime Truth schema/contract: ../runtime-truth.md');
      lines.push('- NCS generator contract: ../docs/hub/content/docs/runtime/new-chat-start-generator/');
      lines.push('- Guardian loop runbook: ../docs/hub/content/runbook/runtime_truth/guardian_loop/index.md');
      lines.push('- Runtime health runbook: ../docs/hub/content/runbook/runtime_truth/runtime_health/index.md');
      lines.push('');
      lines.push('LATEST RELEVANT CHECKPOINTS (MAX 7)');
      lines.push(checkpoints.length ? checkpoints.map(fmtCp).join('\n') : '—');
      lines.push('');
      lines.push('=======================================================================');

      const text = lines.join('\n');

      res.json({
        text,
        ...(debug
          ? {
              facts: factsOut,
              meta: {
                wrapKey,
                wrapTs,
                gateFound: gate.gateFound,
                gateOk: gate.gateOk,
                gateKey: gate.gateKey,
                gateTs: gate.gateTs,
                eventsCount: events.length,
                wrapFound: Boolean(latestWrap),
                checkpointsCount: checkpoints.length,
                checkpointsMax: MAX_RELEVANT_CHECKPOINTS,
                checkpointsFiltered,
                checkpointsReturned: checkpoints.length,
                missionFound: missionSource !== 'none',
                missionSource,
                missionText,
                trackFound: trackSource !== 'none',
                trackSource,
                trackTokens,
                rawFactsSchema: String(rawFacts?.schema ?? ''),
                pickedFactsSchema: String(facts?.schema ?? ''),
                rawFactsKeys: objKeys(rawFacts),
                pickedFactsKeys: objKeys(facts),
              },
            }
          : {}),
      });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  router.get('/resume', async (req, res) => {
    try {
      const computedAt = new Date().toISOString();
      const events = loadEvents(parseLimit(req.query.limit, 200));

      const taskish = (ev: any) =>
        String(ev?.task_id ?? ev?.taskId ?? ev?.id ?? ev?.event_id ?? ev?.name ?? '');
      const toMs = (ts: any) => {
        const t = Date.parse(String(ts ?? ''));
        return Number.isNaN(t) ? 0 : t;
      };

      const wraps = events.filter((ev: any) => taskish(ev).startsWith('HUB_SESSION_WRAP'));
      const latestWrap = wraps.reduce((best: any, ev: any) => {
        if (!best) return ev;
        return toMs(ev?.ts) > toMs(best?.ts) ? ev : best;
      }, undefined);

      const gateEvents = (events ?? []).filter((ev: any) => taskish(ev).includes('RUNTIME_GREEN_GATE'));
      const latestGate = gateEvents.reduce((best: any, ev: any) => {
        if (!best) return ev;
        return toMs(ev?.ts) > toMs(best?.ts) ? ev : best;
      }, undefined);

      const gateFacts =
        (latestGate?.facts && typeof latestGate.facts === 'object' ? latestGate.facts : null) ??
        (latestGate?.payload?.facts && typeof latestGate.payload.facts === 'object' ? latestGate.payload.facts : null) ??
        (latestGate?.payload && typeof latestGate.payload === 'object' ? latestGate.payload : {}) ??
        {};

      const gateOkFromPayload =
        gateFacts?.verification?.runtime_green_gate?.ok ??
        gateFacts?.runtime_green_gate?.ok ??
        gateFacts?.ok ??
        latestGate?.payload?.ok;

      let gateOk = false;
      if (typeof gateOkFromPayload === 'boolean') {
        gateOk = gateOkFromPayload;
      } else {
        const statusRaw = String(latestGate?.status ?? gateFacts?.status ?? '').toUpperCase();
        gateOk = statusRaw === 'GREEN' || statusRaw === 'OK' || statusRaw === 'PASS';
      }

      const wrapFacts =
        (latestWrap?.facts && typeof latestWrap.facts === 'object' ? latestWrap.facts : null) ??
        (latestWrap?.payload?.facts && typeof latestWrap.payload.facts === 'object' ? latestWrap.payload.facts : null) ??
        (latestWrap?.payload && typeof latestWrap.payload === 'object' ? latestWrap.payload : {}) ??
        {};

      const wrapSummary = String(wrapFacts?.summary ?? latestWrap?.summary ?? '').trim();
      const wrapNext = String(
        wrapFacts?.next_action ??
          wrapFacts?.nextAction ??
          (Array.isArray(wrapFacts?.next_actions) ? wrapFacts.next_actions[0] : '') ??
          (Array.isArray(wrapFacts?.next) ? wrapFacts.next[0] : '') ??
          '',
      ).trim();
      const wrapIssue = String(
        wrapFacts?.known_issue ??
          (Array.isArray(wrapFacts?.known_issues) ? wrapFacts.known_issues[0] : '') ??
          (Array.isArray(wrapFacts?.issues) ? wrapFacts.issues[0] : '') ??
          '',
      ).trim();

      const text = latestWrap
        ? [
            'RESUME',
            `- SUMMARY: ${wrapSummary || '—'}`,
            `- NEXT: ${wrapNext || '—'}`,
            `- ISSUE: ${wrapIssue || '—'}`,
          ].join('\n')
        : 'No wrap found';

      res.json({
        text,
        meta: {
          templateVersion: 'resume:v1',
          computedAt,
          wrapFound: Boolean(latestWrap),
          wrapKey: latestWrap ? taskish(latestWrap) : '',
          wrapTs: String(latestWrap?.ts ?? ''),
          gateFound: Boolean(latestGate),
          gateOk: Boolean(latestGate) ? gateOk : false,
          gateKey: latestGate ? taskish(latestGate) : '',
          gateTs: String(latestGate?.ts ?? ''),
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  router.get('/session-summary', async (req, res) => {
    try {
      const computedAt = new Date().toISOString();
      const maxHighlights = Math.min(100, Math.max(1, parseLimit(req.query.max, 25)));
      const hubEnabled = ['1', 'true', 'yes'].includes(String(req.query.hub ?? '').toLowerCase());
      const debugEnabled = ['1', 'true', 'yes'].includes(String(req.query.debug ?? '').toLowerCase());
      const hubTopN = 7;
      const hubTopNHardMax = 12;
      const allEvents = loadAllEvents();

      const taskish = (ev: any) =>
        String(ev?.task_id ?? ev?.taskId ?? ev?.id ?? ev?.event_id ?? ev?.name ?? '');
      const eventKeyOf = (ev: any) =>
        `${String(ev?.ts ?? '')}::${taskish(ev)}::${String(ev?.summary ?? '')}`;

      const toFactsObject = (ev: any) => {
        const direct = ev?.facts;
        if (direct && typeof direct === 'object') return direct as Record<string, unknown>;
        const payloadFacts = ev?.payload?.facts;
        if (payloadFacts && typeof payloadFacts === 'object') return payloadFacts as Record<string, unknown>;
        const payload = ev?.payload;
        if (payload && typeof payload === 'object') return payload as Record<string, unknown>;
        return {} as Record<string, unknown>;
      };

      const normalizeTokens = (text: string): string[] => {
        const upper = String(text ?? '').toUpperCase();
        const out = new Set<string>();

        const snake = upper.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? [];
        for (const tok of snake) {
          if (tok.length >= 3) out.add(tok);
        }

        for (const tok of upper.split(/[^A-Z0-9_]+/g)) {
          if (tok.length >= 3) out.add(tok);
        }

        return [...out];
      };

      const extractEventTokenBag = (eventsForHub: any[]) => {
        const tokenSet = new Set<string>();
        const tagSet = new Set<string>();

        for (const ev of eventsForHub ?? []) {
          const facts = toFactsObject(ev);
          const nextAction = String(
            facts?.next_action ??
              facts?.nextAction ??
              (Array.isArray(facts?.next_actions) ? facts.next_actions[0] : '') ??
              (Array.isArray(facts?.next) ? facts.next[0] : '') ??
              '',
          );
          const knownIssue = String(
            facts?.known_issue ??
              (Array.isArray(facts?.known_issues) ? facts.known_issues[0] : '') ??
              (Array.isArray(facts?.issues) ? facts.issues[0] : '') ??
              '',
          );

          const tags = Array.isArray(ev?.tags) ? ev.tags : [];
          for (const tagRaw of tags) {
            const tag = String(tagRaw ?? '').trim().toUpperCase();
            if (tag.length >= 3) tagSet.add(tag);
          }

          const pieces = [
            String(taskish(ev)),
            String(ev?.summary ?? ''),
            nextAction,
            knownIssue,
            ...tags.map((t: any) => String(t ?? '')),
          ];

          for (const piece of pieces) {
            for (const token of normalizeTokens(piece)) {
              tokenSet.add(token);
              if (tokenSet.size >= 500) break;
            }
            if (tokenSet.size >= 500) break;
          }
          if (tokenSet.size >= 500) break;
        }

        return {
          tokens: [...tokenSet].slice(0, 120),
          tags: [...tagSet].slice(0, 60),
        };
      };

      const parseRunbookIndexEntries = () => {
        type HubIndexEntry = {
          title: string;
          path: string;
          tier: string | null;
          keywords: string[];
        };

        const relIndexPath = 'docs/hub/content/runbook/00__RUNBOOK_INDEX.md';
        const indexCandidates = [
          path.resolve(process.cwd(), relIndexPath),
          path.resolve(process.cwd(), '..', relIndexPath),
          path.resolve(process.cwd(), '..', '..', relIndexPath),
          path.resolve(__dirname, '..', '..', '..', '..', relIndexPath),
          path.resolve(__dirname, '..', '..', '..', '..', '..', relIndexPath),
        ];
        const indexPath = indexCandidates.find(candidate => fs.existsSync(candidate)) ?? indexCandidates[0];
        if (!fs.existsSync(indexPath)) {
          return {
            indexPath,
            entries: [] as HubIndexEntry[],
            parseError: 'runbook index not found',
          };
        }

        const text = fs.readFileSync(indexPath, 'utf8');
        const lines = text.split(/\r?\n/);
        const entries: HubIndexEntry[] = [];
        let currentTier: string | null = null;

        for (const rawLine of lines) {
          const line = String(rawLine ?? '').trim();
          if (!line) continue;

          if (/^#{1,6}\s+/.test(line)) {
            const heading = line.replace(/^#{1,6}\s+/, '').trim();
            const mTier = /\bTIER\s*([0-9]+)\b/i.exec(heading);
            currentTier = mTier ? `Tier ${mTier[1]}` : currentTier;
            continue;
          }

          if (!line.startsWith('- ')) continue;

          const m = /\[([^\]]+)\]\(([^)]+)\)/.exec(line);
          if (!m) continue;

          const linkLabel = String(m[1] ?? '').trim();
          const linkPath = String(m[2] ?? '').trim();
          const prefix = line
            .replace(/^-\s+/, '')
            .split('[')[0]
            .trim()
            .replace(/[\s:–-]+$/, '');
          const title = prefix || linkLabel;
          if (!title || !linkPath) continue;

          const lineTier = /\bTIER\s*([0-9]+)\b/i.exec(line);
          const tier = lineTier ? `Tier ${lineTier[1]}` : currentTier;
          const keywords = normalizeTokens(`${title} ${linkLabel}`);

          entries.push({
            title,
            path: linkPath,
            tier,
            keywords,
          });

          if (entries.length >= 500) break;
        }

        return {
          indexPath,
          entries,
          parseError: undefined as string | undefined,
        };
      };

      const buildHubSelection = (eventsForHub: any[]) => {
        const parsed = parseRunbookIndexEntries();
        const { tokens, tags } = extractEventTokenBag(eventsForHub);

        const scored = parsed.entries
          .map(entry => {
            const titleUpper = entry.title.toUpperCase();
            const pathUpper = entry.path.toUpperCase();
            let score = 0;
            const why = new Set<string>();

            for (const tag of tags) {
              if (titleUpper.includes(tag)) {
                score += 5;
                why.add(`tag:${tag}`);
              }
            }

            for (const token of tokens) {
              if (titleUpper.includes(token)) {
                score += 2;
                why.add(`title:${token}`);
              }
              if (pathUpper.includes(token)) {
                score += 1;
                why.add(`path:${token}`);
              }
            }

            return {
              title: entry.title,
              path: entry.path,
              tier: entry.tier,
              score,
              why: [...why].slice(0, 8),
            };
          })
          .filter(entry => entry.score > 0)
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const t = a.title.localeCompare(b.title);
            if (t !== 0) return t;
            return a.path.localeCompare(b.path);
          });

        const selected = scored.slice(0, Math.min(hubTopN, hubTopNHardMax));
        const droppedCount = Math.max(0, scored.length - selected.length);

        return {
          enabled: true,
          indexPath: parsed.indexPath,
          selected,
          droppedCount,
          parsedEntries: parsed.entries.length,
          parseError: parsed.parseError,
          explain: {
            deterministic: true,
            scoring: {
              titleHasEventTagExact: '+5',
              tokenInTitle: '+2',
              tokenInPath: '+1',
            },
            caps: {
              parsedEntriesMax: 500,
              tokenMax: 120,
              selectedDefault: hubTopN,
              selectedHardMax: hubTopNHardMax,
            },
          },
          ...(debugEnabled
            ? {
                debug: {
                  tokenCount: tokens.length,
                  tagCount: tags.length,
                  tokens,
                  tags,
                },
              }
            : {}),
        };
      };

      if (allEvents.length === 0) {
        const hubMeta = hubEnabled
          ? buildHubSelection([])
          : { enabled: false };
        res.json({
          text: 'SESSION SUMMARY\n- No events found.',
          meta: {
            templateVersion: 'session-summary:v1',
            window: {
              fromKey: '',
              toKey: '',
              fromTs: '',
              toTs: '',
              totalEvents: 0,
              includedEvents: 0,
            },
            selection: { events: [] },
            dropped: { events: [] },
            computedAt,
            basedOnLatestKey: '',
            hub: hubMeta,
          },
        });
        return;
      }

      const wrapIndices: number[] = [];
      for (let i = 0; i < allEvents.length; i++) {
        if (taskish(allEvents[i]).startsWith('HUB_SESSION_WRAP')) wrapIndices.push(i);
      }

      const latestIdx = allEvents.length - 1;
      const latestWrapIdx = wrapIndices.length ? wrapIndices[wrapIndices.length - 1] : -1;
      const prevWrapIdx = wrapIndices.length >= 2 ? wrapIndices[wrapIndices.length - 2] : -1;

      const fromIdx = prevWrapIdx >= 0 ? prevWrapIdx : 0;
      const toIdx = latestIdx;
      const windowEvents = allEvents.slice(fromIdx, toIdx + 1);

      const includeEvent = (ev: any) => {
        const t = String(ev?.event_type ?? '').toUpperCase();
        if (t.includes('CHECKPOINT')) return true;
        if (t === 'NOTE' || t.startsWith('NOTE_')) return true;
        if (t === 'FIX' || t.startsWith('FIX_')) return true;
        if (t === 'INCIDENT' || t.startsWith('INCIDENT_')) return true;
        if (t === 'DECISION' || t.startsWith('DECISION_')) return true;
        if (t === 'DOC' || t.startsWith('DOC_')) return true;
        return false;
      };

      const includedCandidates = windowEvents.filter(includeEvent);
      const selectedEvents = includedCandidates.slice(-maxHighlights);
      const droppedEvents = includedCandidates.slice(0, Math.max(0, includedCandidates.length - selectedEvents.length));

      const fromEv = allEvents[fromIdx];
      const toEv = allEvents[toIdx];
      const fromKey = fromEv ? eventKeyOf(fromEv) : '';
      const toKey = toEv ? eventKeyOf(toEv) : '';

      const lines: string[] = [];
      lines.push('SESSION SUMMARY');
      lines.push(`WINDOW: ${String(fromEv?.ts ?? 'n/a')} -> ${String(toEv?.ts ?? 'n/a')}`);
      lines.push(`TOTAL EVENTS IN WINDOW: ${windowEvents.length}`);
      lines.push(`INCLUDED HIGHLIGHTS: ${selectedEvents.length} (cap=${maxHighlights})`);
      lines.push('');
      for (const ev of selectedEvents) {
        const t = String(ev?.event_type ?? 'UNKNOWN');
        lines.push(`- [${String(ev?.ts ?? 'n/a')}] ${t} | ${taskish(ev)} | ${String(ev?.summary ?? '')}`);
      }
      if (!selectedEvents.length) {
        lines.push('- —');
      }

      const hubMeta = hubEnabled
        ? buildHubSelection(windowEvents)
        : { enabled: false };

      if (hubEnabled) {
        lines.push('');
        lines.push('RELEVANT HUB REFS (deterministic)');
        if (hubMeta.selected.length) {
          for (const ref of hubMeta.selected) {
            lines.push(`- ${ref.title} — ${ref.path}`);
          }
        } else {
          lines.push('- —');
        }
      }

      res.json({
        text: lines.join('\n'),
        meta: {
          templateVersion: 'session-summary:v1',
          window: {
            fromKey,
            toKey,
            fromTs: String(fromEv?.ts ?? ''),
            toTs: String(toEv?.ts ?? ''),
            totalEvents: windowEvents.length,
            includedEvents: selectedEvents.length,
          },
          selection: {
            events: selectedEvents.map(eventKeyOf),
          },
          dropped: {
            events: droppedEvents.map(eventKeyOf),
          },
          computedAt,
          basedOnLatestKey: toKey,
          mapping: {
            requested: ['CHECKPOINT', 'NOTE', 'FIX', 'INCIDENT', 'DECISION', 'DOC'],
            matchedBy: 'event_type/type exact or prefix; CHECKPOINT also includes CHECKPOINT_*',
          },
          latestWrap: {
            latestWrapKey: latestWrapIdx >= 0 ? eventKeyOf(allEvents[latestWrapIdx]) : '',
            previousWrapKey: prevWrapIdx >= 0 ? eventKeyOf(allEvents[prevWrapIdx]) : '',
          },
          hub: hubMeta,
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  router.get('/session-wrap-command', async (req, res) => {
    try {
      const computedAt = new Date().toISOString();
      const events = loadEvents(parseLimit(req.query.limit, 200));

      const taskish = (ev: any) =>
        String(ev?.task_id ?? ev?.taskId ?? ev?.id ?? ev?.event_id ?? ev?.name ?? '');
      const toMs = (ts: any) => {
        const t = Date.parse(String(ts ?? ''));
        return Number.isNaN(t) ? 0 : t;
      };
      const wraps = events.filter((ev: any) => taskish(ev).startsWith('HUB_SESSION_WRAP'));
      const latestWrap = wraps.reduce((best: any, ev: any) => {
        if (!best) return ev;
        return toMs(ev?.ts) > toMs(best?.ts) ? ev : best;
      }, undefined);

      const wrapFacts =
        (latestWrap?.facts && typeof latestWrap.facts === 'object' ? latestWrap.facts : null) ??
        (latestWrap?.payload?.facts && typeof latestWrap.payload.facts === 'object' ? latestWrap.payload.facts : null) ??
        (latestWrap?.payload && typeof latestWrap.payload === 'object' ? latestWrap.payload : {}) ??
        {};

      const nowDate = new Date().toISOString().slice(0, 10);
      const id = `HUB_SESSION_WRAP__SESSION__${nowDate}`;
      const summary = String(wrapFacts?.summary ?? latestWrap?.summary ?? '<fill>').trim() || '<fill>';
      const knownIssue = String(
        wrapFacts?.known_issue ??
          (Array.isArray(wrapFacts?.known_issues) ? wrapFacts.known_issues[0] : '') ??
          (Array.isArray(wrapFacts?.issues) ? wrapFacts.issues[0] : '') ??
          '<fill>',
      ).trim() || '<fill>';
      const nextAction = String(
        wrapFacts?.next_action ??
          wrapFacts?.nextAction ??
          (Array.isArray(wrapFacts?.next_actions) ? wrapFacts.next_actions[0] : '') ??
          (Array.isArray(wrapFacts?.next) ? wrapFacts.next[0] : '') ??
          '<fill>',
      ).trim() || '<fill>';
      const goal = String(wrapFacts?.goal ?? wrapFacts?.Goal ?? '<fill>').trim() || '<fill>';

      const text = [
        '/home/danie/control_plane/runtime_truth_store/fs_push_session_wrap.sh \\',
        `  --id "${id}" \\`,
        `  --summary "${summary.replace(/"/g, '\\"')}" \\`,
        `  --known-issue "${knownIssue.replace(/"/g, '\\"')}" \\`,
        `  --next-action "${nextAction.replace(/"/g, '\\"')}" \\`,
        `  --goal "${goal.replace(/"/g, '\\"')}" \\`,
        '  --show',
      ].join('\n');

      res.json({
        text,
        meta: {
          templateVersion: 'session-wrap-command:v1',
          computedAt,
          wrapFound: Boolean(latestWrap),
          wrapKey: latestWrap ? taskish(latestWrap) : '',
          wrapTs: String(latestWrap?.ts ?? ''),
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  router.get('/generator-status', async (req, res) => {
    try {
      const computedAt = new Date().toISOString();
      const events = loadEvents(parseLimit(req.query.limit, 200));

      const taskish = (ev: any) =>
        String(ev?.task_id ?? ev?.taskId ?? ev?.id ?? ev?.event_id ?? ev?.name ?? '');
      const toMs = (ts: any) => {
        const t = Date.parse(String(ts ?? ''));
        return Number.isNaN(t) ? 0 : t;
      };

      const latest = events.reduce((best: any, ev: any) => {
        if (!best) return ev;
        return toMs(ev?.ts) > toMs(best?.ts) ? ev : best;
      }, undefined);

      const wraps = events.filter((ev: any) => taskish(ev).startsWith('HUB_SESSION_WRAP'));
      const latestWrap = wraps.reduce((best: any, ev: any) => {
        if (!best) return ev;
        return toMs(ev?.ts) > toMs(best?.ts) ? ev : best;
      }, undefined);

      const gateEvents = events.filter((ev: any) => taskish(ev).includes('RUNTIME_GREEN_GATE'));
      const latestGate = gateEvents.reduce((best: any, ev: any) => {
        if (!best) return ev;
        return toMs(ev?.ts) > toMs(best?.ts) ? ev : best;
      }, undefined);

      const gateFacts =
        (latestGate?.facts && typeof latestGate.facts === 'object' ? latestGate.facts : null) ??
        (latestGate?.payload?.facts && typeof latestGate.payload.facts === 'object' ? latestGate.payload.facts : null) ??
        (latestGate?.payload && typeof latestGate.payload === 'object' ? latestGate.payload : {}) ??
        {};
      const gateOkFromPayload =
        gateFacts?.verification?.runtime_green_gate?.ok ??
        gateFacts?.runtime_green_gate?.ok ??
        gateFacts?.ok ??
        latestGate?.payload?.ok;
      const gateOk = typeof gateOkFromPayload === 'boolean'
        ? gateOkFromPayload
        : ['GREEN', 'OK', 'PASS'].includes(String(latestGate?.status ?? gateFacts?.status ?? '').toUpperCase());

      res.json({
        meta: {
          templateVersion: 'generator-status:v1',
          computedAt,
          paths: {
            runtimeJsonlPath,
            latestPath,
          },
          latestKey: latest ? `${String(latest?.ts ?? '')}::${taskish(latest)}::${String(latest?.summary ?? '')}` : '',
          latestTs: String(latest?.ts ?? ''),
          latestWrapKey: latestWrap ? taskish(latestWrap) : '',
          latestWrapTs: String(latestWrap?.ts ?? ''),
          latestGateKey: latestGate ? taskish(latestGate) : '',
          latestGateTs: String(latestGate?.ts ?? ''),
          gateOk,
          versions: {
            resume: 'resume:v1',
            sessionSummary: 'session-summary:v1',
            sessionWrapCommand: 'session-wrap-command:v1',
            generatorStatus: 'generator-status:v1',
            newChatStart: 'new-chat-start:v2',
          },
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  router.get('/hub/paths', async (req, res) => {
    try {
      const eventsWindow = loadEvents(200);
      const resolved = await resolveHubDocPaths(eventsWindow);
      const shaMap: Record<string, string> = {};
      const hashDir = (dirPath: string): string => {
        const lines: string[] = [];
        const walk = (currentPath: string) => {
          let entries: fs.Dirent[] = [];
          try {
            entries = fs.readdirSync(currentPath, { withFileTypes: true });
          } catch {
            return;
          }

          entries.sort((a, b) => a.name.localeCompare(b.name));
          for (const entry of entries) {
            const nextPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
              walk(nextPath);
              continue;
            }
            if (!entry.isFile()) continue;
            if (!/\.(md|ya?ml|json)$/i.test(entry.name)) continue;
            try {
              const content = fs.readFileSync(nextPath, 'utf8');
              const rel = path.relative(dirPath, nextPath).replace(/\\/g, '/');
              lines.push(`${rel}:${sha256(content)}`);
            } catch {
              continue;
            }
          }
        };

        walk(dirPath);
        return sha256(lines.join('\n'));
      };

      for (const name of Object.keys(resolved.docPaths ?? {}).sort()) {
        try {
          const resolvedPath = resolved.docPaths[name];
          if (!resolvedPath) continue;
          const fsPath = fs.existsSync(resolvedPath)
            ? resolvedPath
            : winToWslPath(resolvedPath);
          if (!fs.existsSync(fsPath)) continue;

          const stat = fs.statSync(fsPath);
          if (stat.isFile()) {
            const content = fs.readFileSync(fsPath, 'utf8');
            shaMap[name] = sha256(content);
            continue;
          }

          if (stat.isDirectory()) {
            shaMap[name] = hashDir(fsPath);
          }
        } catch {
          continue;
        }
      }
      res.json({
        ok: resolved.ok,
        source: resolved.source,
        reason: resolved.reason,
        docPaths: resolved.docPaths,
        doc_paths: resolved.docPaths,
        doc_paths_meta: {},
        paths: resolved.docPaths,
        sha256: shaMap,
      });
      return;
    } catch (error) {
      const status = (error as Error & { status?: number }).status ?? 500;
      res.status(status).json({ error: (error as Error).message });
    }
  });

  router.get('/hub/file', async (req, res) => {
    try {
      const name = ensureString(req.query.name, 'name');
      if (!(HUB_DOC_WHITELIST as readonly string[]).includes(name)) {
        return res.status(400).json({ error: `Invalid hub doc name: ${name}` });
      }

      const eventsWindow = loadEvents(200);
      const resolved = await resolveHubDocPaths(eventsWindow);
      if (!resolved.ok) {
        return res.status(409).json({
          error:
            'DOC_PATHS not available (checkpoint missing) and fallback roots did not resolve HUB docs. Set FS_HUB_ROOTS or push DOC_PATHS.',
        });
      }

      const resolvedPath = resolved.docPaths[name];
      if (!resolvedPath) {
        return res.status(404).json({
          error: `DOC_PATHS does not define file name: ${name}`,
        });
      }
      const fsPath = fs.existsSync(resolvedPath)
        ? resolvedPath
        : winToWslPath(resolvedPath);
      if (!fs.existsSync(fsPath)) {
        return res.status(404).json({
          error: `Resolved hub file path does not exist: ${resolvedPath}`,
        });
      }
      const content = fs.readFileSync(fsPath, 'utf8');
      const stat = fs.statSync(fsPath);
      res.json({
        name,
        path: fsPath,
        sha256: sha256(content),
        mtime: stat.mtime.toISOString(),
        size: stat.size,
        content,
      });
    } catch (error) {
      const status = (error as Error & { status?: number }).status ?? 500;
      res.status(status).json({ error: (error as Error).message });
    }
  });

  router.post('/hub/patch', async (req, res) => {
    try {
      const body = getJsonBody(req) as HubPatchRequest | null;
      if (!body) {
        return res
          .status(400)
          .json({ error: 'Invalid JSON body (missing or not parseable)' });
      }
      const name = ensureString(body.name, 'name');
      const dryRun = typeof body.dryRun === 'boolean' ? body.dryRun : true;
      if (!body.patch || typeof body.patch !== 'object') {
        return res
          .status(400)
          .json({ error: 'Invalid patch: expected object with op/text fields' });
      }
      const patchSpec = {
        op: ensureString(body.patch.op, 'patch.op'),
        text: ensureString(body.patch.text, 'patch.text'),
        startMarker:
          typeof body.patch.startMarker === 'string' ? body.patch.startMarker : '',
        endMarker:
          typeof body.patch.endMarker === 'string' ? body.patch.endMarker : '',
      };

      const { resolvedPath } = resolveHubPathByName(name);
      if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({
          error: `Resolved hub file path does not exist: ${resolvedPath}`,
        });
      }

      const oldContent = fs.readFileSync(resolvedPath, 'utf8');
      const newContent = buildPatchedContent(oldContent, patchSpec);
      const shaBefore = sha256(oldContent);
      const shaAfterComputed = sha256(newContent);
      const changed = oldContent !== newContent;
      const summary = {
        dryRun,
        name,
        path: resolvedPath,
        sha256_before: shaBefore,
        sha256_after: shaAfterComputed,
        bytes_before: Buffer.byteLength(oldContent, 'utf8'),
        bytes_after: Buffer.byteLength(newContent, 'utf8'),
        changed,
        notes: changed ? ['content changed'] : ['no content change'],
      };

      if (dryRun) {
        return res.json(summary);
      }

      const backupPath = writeAtomicWithBackup(resolvedPath, newContent);
      const written = fs.readFileSync(resolvedPath, 'utf8');
      const writtenSha = sha256(written);
      if (writtenSha !== shaAfterComputed) {
        return res.status(500).json({
          error: 'sha256 verification failed after write',
          expected: shaAfterComputed,
          actual: writtenSha,
          backup_path: backupPath,
        });
      }

      return res.json({ ...summary, dryRun: false, backup_path: backupPath });
    } catch (error) {
      const status = (error as Error & { status?: number }).status ?? 500;
      return res.status(status).json({ error: (error as Error).message });
    }
  });

  router.post('/hub/restore', async (req, res) => {
    try {
      const body = (req.body ?? {}) as {
        checkpoint_id?: unknown;
        dryRun?: unknown;
      };
      const checkpointId = ensureString(body.checkpoint_id, 'checkpoint_id');
      const dryRun = typeof body.dryRun === 'boolean' ? body.dryRun : true;

      const events = loadAllEvents();
      const checkpoint = [...events].reverse().find(event => {
        if (event.event_type !== 'CHECKPOINT') return false;
        const factsCheckpointId =
          event.facts && typeof event.facts.checkpoint_id === 'string'
            ? event.facts.checkpoint_id
            : undefined;
        return event.checkpoint_id === checkpointId || factsCheckpointId === checkpointId;
      });

      if (!checkpoint) {
        return res.status(404).json({
          error: `Checkpoint not found for checkpoint_id=${checkpointId}`,
        });
      }

      const checkpointDocPaths =
        checkpoint.DOC_PATHS ||
        (checkpoint.payload && typeof checkpoint.payload === 'object'
          ? (checkpoint.payload as Record<string, unknown>).DOC_PATHS
          : undefined) ||
        (checkpoint.facts && typeof checkpoint.facts.DOC_PATHS === 'object'
          ? (checkpoint.facts.DOC_PATHS as Record<string, string>)
          : undefined);
      const snapshots = parseSnapshots(checkpoint);

      if (!checkpointDocPaths || !snapshots) {
        return res.status(409).json({
          error:
            'Checkpoint has no restore payload yet; implement pack generation first.',
        });
      }

      const fileSummaries: Array<Record<string, unknown>> = [];
      for (const name of REQUIRED_HUB_DOCS) {
        const targetPath = checkpointDocPaths[name];
        const restoredContent = snapshots[name];
        if (!targetPath || typeof targetPath !== 'string' || !restoredContent) {
          continue;
        }
        if (!fs.existsSync(targetPath)) {
          return res.status(404).json({
            error: `Restore target file does not exist: ${targetPath}`,
          });
        }

        const currentContent = fs.readFileSync(targetPath, 'utf8');
        const summary: Record<string, unknown> = {
          name,
          path: targetPath,
          sha256_before: sha256(currentContent),
          sha256_after: sha256(restoredContent),
          bytes_before: Buffer.byteLength(currentContent, 'utf8'),
          bytes_after: Buffer.byteLength(restoredContent, 'utf8'),
          changed: currentContent !== restoredContent,
        };

        if (!dryRun) {
          const backupPath = writeAtomicWithBackup(targetPath, restoredContent);
          const verify = fs.readFileSync(targetPath, 'utf8');
          const verifySha = sha256(verify);
          if (verifySha !== summary.sha256_after) {
            return res.status(500).json({
              error: `sha256 verification failed after restore for ${name}`,
              expected: summary.sha256_after,
              actual: verifySha,
              backup_path: backupPath,
            });
          }
          summary.backup_path = backupPath;
        }

        fileSummaries.push(summary);
      }

      if (fileSummaries.length === 0) {
        return res.status(409).json({
          error:
            'Checkpoint has no restore payload yet; implement pack generation first.',
        });
      }

      return res.json({
        dryRun,
        checkpoint_id: checkpointId,
        files: fileSummaries,
      });
    } catch (error) {
      const status = (error as Error & { status?: number }).status ?? 500;
      return res.status(status).json({ error: (error as Error).message });
    }
  });

  router.post('/checkpoints/restore', async (req, res) => {
    try {
      const bypass = isLocalDev(req);
      if (bypass) {
        logger.info('RESTORE_AUTH_BYPASS dev-localhost used');
      } else {
        const authorization = req.headers.authorization;
        const hasAuthHeader =
          typeof authorization === 'string' && authorization.trim().length > 0;
        if (!hasAuthHeader) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }

      const body = getJsonBody(req);
      if (!body) {
        return res
          .status(400)
          .json({ error: 'Invalid JSON body (missing or not parseable)' });
      }
      const checkpointId = ensureString(body.checkpoint_id, 'checkpoint_id');
      const queryDryRun =
        req.query?.dryRun === '1' ||
        req.query?.dryRun === 1 ||
        req.query?.dryRun === true ||
        req.query?.dryRun === 'true';
      const bodyDryRun = typeof body.dryRun === 'boolean' ? body.dryRun : true;
      const dryRun = queryDryRun || bodyDryRun;

      if (!hubDocsRootPath || !hubDocsRootPath.trim()) {
        return res.status(500).json({
          error: 'Missing required config: hubDocs.rootPath',
        });
      }

      let restoreHubRootAbs = hubDocsRootPath;
      const overrideRoot = process.env.FS_HUB_ROOT_OVERRIDE;
      if (
        isLocalDev(req) &&
        typeof overrideRoot === 'string' &&
        overrideRoot.trim() &&
        path.isAbsolute(overrideRoot.trim())
      ) {
        restoreHubRootAbs = overrideRoot.trim();
        logger.info(`HUB_ROOT_OVERRIDE active path=${restoreHubRootAbs}`);
      }

      logger.info(`RESTORE_LOOKUP start checkpoint_id=${checkpointId} dryRun=${dryRun}`);
      const pack = findRestorePackByCheckpointId(runtimeJsonlPath, checkpointId);
      if (!pack) {
        return res.status(404).json({
          code: 'checkpoint_event_not_found',
          error: `Restore pack not found for checkpoint_id=${checkpointId}`,
        });
      }

      const ops = buildRestorePackFromCheckpoint({
        hubRootAbs: restoreHubRootAbs,
        payload: pack,
      });
      const preview = buildRestorePreview(ops);

      if (dryRun) {
        logger.info(
          `RESTORE_DRYRUN OK files=${preview.totals.files} creates=${preview.totals.creates} overwrites=${preview.totals.overwrites}`,
        );
        return res.json({
          ok: true,
          dryRun: true,
          checkpoint_id: checkpointId,
          pack,
          preview,
        });
      }

      const policyResult = evaluateRestorePolicy({
        hubRootAbs: restoreHubRootAbs,
        ops,
        preview,
        options: {
          allowHolyOverwrite: body.allowHolyOverwrite === true,
          maxFiles:
            typeof body.maxFiles === 'number' && Number.isFinite(body.maxFiles)
              ? body.maxFiles
              : undefined,
          maxBytesNew:
            typeof body.maxBytesNew === 'number' && Number.isFinite(body.maxBytesNew)
              ? body.maxBytesNew
              : undefined,
        },
      });

      if (!policyResult.ok) {
        logger.warn(
          `RESTORE_BLOCKED policy violations=${policyResult.violations.length}`,
        );
        return res.status(409).json({
          ok: false,
          blocked: true,
          violations: policyResult.violations,
          policy: policyResult.policy,
          checkpoint_id: checkpointId,
          preview_summary: preview.totals,
        });
      }

      try {
        const result = await applyRestoreTransactional(restoreHubRootAbs, pack);
        logger.info(
          `RESTORE_COMMIT OK txnId=${result.txnId} files=${result.restored} manifest=${result.manifestPath}`,
        );
        return res.json({
          ok: true,
          dryRun: false,
          checkpoint_id: checkpointId,
          restored: result.restored,
          backups: result.backups,
          files: result.files,
          txnId: result.txnId,
          committed: result.committed,
          rolledBack: result.rolledBack,
          fileCount: result.fileCount,
          manifestPath: result.manifestPath,
        });
      } catch (commitError) {
        const txnId = (commitError as Error & { txnId?: string }).txnId ?? 'unknown';
        const manifestPath =
          (commitError as Error & { manifestPath?: string }).manifestPath ?? 'unknown';
        logger.error(
          `RESTORE_COMMIT ERROR txnId=${txnId} manifest=${manifestPath} message=${(commitError as Error).message}`,
        );
        throw commitError;
      }
    } catch (error) {
      const status = (error as Error & { status?: number }).status ?? 500;
      return res.status(status).json({ error: (error as Error).message });
    }
  });

  return router;
}
