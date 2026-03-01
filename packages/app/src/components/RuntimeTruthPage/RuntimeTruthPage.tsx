import { useEffect, useMemo, useRef, useState } from 'react';
import { Content, Header, Page, Progress, ResponseErrorPanel, Table } from '@backstage/core-components';
import { useApi, alertApiRef, configApiRef } from '@backstage/core-plugin-api';
import { Button, Menu, MenuItem } from '@material-ui/core';
import { copyTextRobustSync } from '../../utils/clipboard';

type RuntimeEvent = {
  id?: string;
  ts?: string;
  name?: string;
  title?: string;
  type?: string;
  project?: string;
  task_id?: string;
  event_type?: string;
  status?: string;
  severity?: string;
  message?: string;
  details?: string;
  summary?: string;
  tags?: string[];
  facts?: Record<string, unknown>;
};

type RuntimeEventsResponse = {
  filePath?: string;
  limit?: number;
  events?: any[];
};

type RuntimeTextWithMetaResponse = {
  text?: string;
  newChatStartText?: string;
  meta?: Record<string, unknown>;
};

type GeneratorStatusResponse = {
  meta?: {
    latestWrapKey?: string;
    latestWrapTs?: string;
    latestGateTs?: string;
    gateOk?: boolean;
    versions?: {
      newChatStart?: string;
      resume?: string;
      sessionSummary?: string;
      sessionWrapCommand?: string;
      generatorStatus?: string;
    };
  };
};

type SessionSummaryHubSelected = {
  title?: string;
  path?: string;
  score?: number;
  why?: string[];
};

type SessionSummaryHubMeta = {
  enabled?: boolean;
  indexPath?: string;
  selected?: SessionSummaryHubSelected[];
  droppedCount?: number;
  parsedEntries?: number;
  parseError?: string;
  debug?: {
    tokens?: string[];
    tags?: string[];
  };
};

type SessionSummaryMetaResponse = {
  meta?: {
    hub?: SessionSummaryHubMeta;
    [k: string]: unknown;
  };
};

type HubPathsResponse = {
  docPaths?: Record<string, string>;
  source?: string;
  ts?: string;
  error?: string;
};

type HubFileResponse = {
  name?: string;
  path?: string;
  sha256?: string;
  mtime?: string;
  size?: number;
  content?: string;
  error?: string;
};

type HubFileMeta = {
  ok: boolean;
  sha256?: string;
  mtime?: string;
  size?: number;
  error?: string;
};

type HubPatchSummary = {
  dryRun?: boolean;
  name?: string;
  path?: string;
  sha256_before?: string;
  sha256_after?: string;
  bytes_before?: number;
  bytes_after?: number;
  changed?: boolean;
  backup_path?: string;
  notes?: string[];
  error?: string;
};

type RuntimeUrls = {
  ui?: string;
  runtime?: string;
  backend?: string;
  api?: string;
};

const KNOWN_HUB_FILES = ['HUB_RULEBOOK.md', 'HUB_STATE.md', 'HUB_SYSTEMS.md'];

function normalizeRuntimeEvent(e: any, idx: number): RuntimeEvent {
  const timestamp = e?.timestamp ?? e?.ts ?? e?.time ?? e?.date;
  const name = e?.name ?? e?.title ?? e?.checkpoint ?? '';
  const title = e?.title ?? e?.name ?? e?.checkpoint ?? '';
  const eventType = e?.event_type ?? e?.type ?? e?.EVENT_TYPE ?? '';
  const summary = e?.summary ?? e?.message ?? e?.details ?? '';

  return {
    ...e,
    id: e?.id ?? e?.event_id ?? `${String(timestamp ?? '')}-${idx}`,
    ts: timestamp ? String(timestamp) : '',
    project: String(e?.project ?? e?.PROJECT ?? e?.context?.project ?? ''),
    event_type: String(eventType),
    severity: String(e?.severity ?? e?.status ?? e?.level ?? e?.SEVERITY ?? ''),
    name: String(name),
    title: String(title),
    summary: String(summary),
    task_id: String(e?.task_id ?? e?.taskId ?? e?.id ?? e?.event_id ?? ''),
    message: String(e?.message ?? ''),
    details: String(e?.details ?? ''),
  };
}

function eventTypeNorm(event: RuntimeEvent): string {
  return String(event.event_type ?? '').toUpperCase();
}

function isCheckpointEvent(event: RuntimeEvent): boolean {
  const normalizedType = eventTypeNorm(event);
  if (
    normalizedType === 'CHECKPOINT' ||
    normalizedType === 'CHECKPOINT_SUMMARY' ||
    normalizedType.includes('CHECKPOINT')
  ) {
    return true;
  }

  const nameTitle = `${event.name ?? ''} ${event.title ?? ''}`.toUpperCase();
  return nameTitle.includes('CHECKPOINT');
}

type FsRtEvent = RuntimeEvent;

type FsWrappedStateV1 = {
  schema: 'WRAPPED_STATE';
  schema_version: 1;
  baseline_mode: 'CHECKPOINT_WINDOW' | 'NO_CHECKPOINT_BASELINE';
  generated_at_iso: string;
  window: {
    prev_checkpoint_iso: string | null;
    latest_checkpoint_iso: string | null;
    from_inclusive_iso: string | null;
    to_inclusive_iso: string | null;
    event_count: number;
  };
  latest_checkpoint: {
    id: string | null;
    iso: string | null;
    severity: string | null;
    title: string | null;
  };
  active_goals: string[];
  known_issues: string[];
  next_actions: string[];
  scope_guard: string[];
  included_event_ids: string[];
};

function fsRtToIso(ts: any): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function fsRtGetIso(e: any): string | null {
  return fsRtToIso(e?.ts ?? e?.timestamp ?? e?.time ?? e?.date);
}

function fsRtGetType(e: any): string {
  return String(e?.event_type ?? e?.type ?? '').toUpperCase();
}

function fsRtGetSeverity(e: any): string {
  return String(e?.severity ?? e?.status ?? '').toUpperCase();
}

function fsRtGetId(e: any): string | null {
  const v = String(e?.id ?? e?.task_id ?? e?.name ?? '').trim();
  return v ? v : null;
}

function fsRtGetTitle(e: any): string | null {
  const v = String(e?.title ?? e?.summary ?? e?.message ?? e?.text ?? '').trim();
  return v ? v : null;
}

function fsRtGetFacts(e: any): any {
  if (e?.facts?.payload) return e.facts.payload;
  if (e?.facts) return e.facts;
  return e?.payload ?? e?.data ?? null;
}

function fsRtSortAscByIso(events: any[]): any[] {
  return [...(events || [])]
    .map(e => ({ ...e, __iso: fsRtGetIso(e) }))
    .sort((a: any, b: any) => {
      const A = a.__iso || '9999-12-31T23:59:59.999Z';
      const B = b.__iso || '9999-12-31T23:59:59.999Z';
      return A.localeCompare(B);
    });
}

function buildWrappedStateV1(sortedEventsAsc: any[]): {
  state: FsWrappedStateV1;
  sincePrev: any[];
  latest: any | null;
  prev: any | null;
} {
  const nowIso = new Date().toISOString();

  const checkpointIdxs: number[] = [];
  for (let i = 0; i < sortedEventsAsc.length; i++) {
    if (fsRtGetType(sortedEventsAsc[i]) === 'CHECKPOINT') checkpointIdxs.push(i);
  }

  const hasCheckpoint = checkpointIdxs.length > 0;

  const latestIdx = hasCheckpoint ? checkpointIdxs[checkpointIdxs.length - 1] : -1;
  const prevIdx = checkpointIdxs.length >= 2 ? checkpointIdxs[checkpointIdxs.length - 2] : -1;

  const latest = latestIdx >= 0 ? sortedEventsAsc[latestIdx] : null;
  const prev = prevIdx >= 0 ? sortedEventsAsc[prevIdx] : null;

  const sliceStart = prevIdx >= 0 ? prevIdx + 1 : 0;
  const sincePrev = sortedEventsAsc.slice(sliceStart);

  const prevIso = prev ? prev.__iso || null : null;
  const latestIso = latest ? latest.__iso || null : null;

  const fromIso = prevIso || (sortedEventsAsc[0]?.__iso || null);
  const toIso = latestIso || (sortedEventsAsc[sortedEventsAsc.length - 1]?.__iso || null);

  const baseline_mode: FsWrappedStateV1['baseline_mode'] = hasCheckpoint
    ? 'CHECKPOINT_WINDOW'
    : 'NO_CHECKPOINT_BASELINE';

  const latestFacts = latest ? fsRtGetFacts(latest) : null;
  const rawGoals = latestFacts?.active_goals ?? latestFacts?.activeGoals ?? latestFacts?.goals ?? null;
  const active_goals = Array.isArray(rawGoals)
    ? rawGoals.map((x: any) => String(x).trim()).filter(Boolean)
    : [];

  const known_issues: string[] = [];
  for (const e of sincePrev) {
    const sev = fsRtGetSeverity(e);
    const typ = fsRtGetType(e);
    const isBad = sev === 'RED' || sev === 'ERROR' || sev === 'FAIL' || typ === 'ERROR' || typ === 'FAIL';
    if (!isBad) continue;
    const iso = e.__iso || '—';
    const id = fsRtGetId(e) || '';
    const title = fsRtGetTitle(e) || '';
    const idPart = id ? ` ${id}` : '';
    const titlePart = title ? ` — ${title}` : '';
    known_issues.push(`[${iso}] ${typ}/${sev}${idPart}${titlePart}`.trim());
  }

  const rawNext = latestFacts?.next_actions ?? latestFacts?.nextActions ?? null;
  let next_actions = Array.isArray(rawNext)
    ? rawNext.map((x: any) => String(x).trim()).filter(Boolean)
    : [];
  if (!next_actions.length) {
    const notes = sincePrev
      .filter(e => {
        const t = fsRtGetType(e);
        const s = fsRtGetSeverity(e);
        return (t === 'NOTE' || t === 'INFO') && (s === 'GREEN' || s === 'INFO' || s === 'OK' || s === '');
      })
      .map(e => fsRtGetTitle(e))
      .filter(Boolean) as string[];
    next_actions = notes.slice(-5);
  }

  const included_event_ids = sincePrev.map(e => fsRtGetId(e)).filter(Boolean) as string[];

  const state: FsWrappedStateV1 = {
    schema: 'WRAPPED_STATE',
    schema_version: 1,
    baseline_mode,
    generated_at_iso: nowIso,
    window: {
      prev_checkpoint_iso: prevIso,
      latest_checkpoint_iso: latestIso,
      from_inclusive_iso: fromIso,
      to_inclusive_iso: toIso,
      event_count: sincePrev.length,
    },
    latest_checkpoint: {
      id: latest ? fsRtGetId(latest) || null : null,
      iso: latestIso,
      severity: latest ? fsRtGetSeverity(latest) || null : null,
      title: latest ? fsRtGetTitle(latest) || null : null,
    },
    active_goals,
    known_issues,
    next_actions,
    scope_guard: ['UI-only (no backend changes)', 'No new endpoints', 'No runtime.jsonl rewrite'],
    included_event_ids,
  };

  return { state, sincePrev, latest, prev };
}

function buildFullSessionSummaryWithWrappedState(normalizedEvents: FsRtEvent[]): string {
  const eventsAsc = fsRtSortAscByIso(normalizedEvents || []);
  const { state, sincePrev } = buildWrappedStateV1(eventsAsc);

  const lines: string[] = [];
  lines.push('## SESSION SUMMARY');
  lines.push('');
  lines.push('Latest checkpoint:');
  lines.push(`ID: ${state.latest_checkpoint.id ?? '—'}`);
  lines.push(`TS: ${state.latest_checkpoint.iso ?? '—'}`);
  lines.push(`STATUS: ${state.latest_checkpoint.severity ?? '—'}`);
  lines.push('');

  lines.push('Events since previous checkpoint:');
  if (!sincePrev.length) {
    lines.push('- —');
  } else {
    for (const e of sincePrev) {
      const iso = e.__iso || '—';
      const t = fsRtGetType(e) || '—';
      const s = fsRtGetSeverity(e) || '—';
      const id = fsRtGetId(e);
      const title = fsRtGetTitle(e);
      const idPart = id ? ` ${id}` : '';
      const titlePart = title ? ` — ${title}` : '';
      lines.push(`- [${iso}] ${t}/${s}${idPart}${titlePart}`);
    }
  }

  lines.push('');
  lines.push('### WRAPPED_STATE (SCHEMA v1)');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(state, null, 2));
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

function buildSessionWrapContinueMarkdown(normalizedEvents: FsRtEvent[]): string {
  const eventsAsc = fsRtSortAscByIso(normalizedEvents || []);
  const { state, sincePrev } = buildWrappedStateV1(eventsAsc);

  const lines: string[] = [];
  lines.push('## SESSION SUMMARY');
  lines.push('');
  lines.push('Latest checkpoint:');
  lines.push(`ID: ${state.latest_checkpoint.id ?? '—'}`);
  lines.push(`TS: ${state.latest_checkpoint.iso ?? '—'}`);
  lines.push(`STATUS: ${state.latest_checkpoint.severity ?? '—'}`);
  lines.push('');

  if (state.baseline_mode === 'NO_CHECKPOINT_BASELINE') {
    lines.push('Baseline: NO_CHECKPOINT_BASELINE (no CHECKPOINT events found in fetch window)');
    lines.push('');
  }

  lines.push('Events since previous checkpoint:');
  if (!sincePrev.length) {
    lines.push('- —');
  } else {
    for (const e of sincePrev) {
      const iso = e.__iso || '—';
      const t = fsRtGetType(e) || '—';
      const s = fsRtGetSeverity(e) || '—';
      const id = fsRtGetId(e);
      const title = fsRtGetTitle(e);
      const idPart = id ? ` ${id}` : '';
      const titlePart = title ? ` — ${title}` : '';
      lines.push(`- [${iso}] ${t}/${s}${idPart}${titlePart}`);
    }
  }

  lines.push('');
  lines.push('### WRAPPED_STATE (SCHEMA v1)');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(state, null, 2));
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

void buildSessionWrapContinueMarkdown;

// -------------------- New Chat Start Generator --------------------
// Denne funksjonen genererer "New Chat Start"-meldingen som vises når
// en ny chat-sesjon starter. Meldingens struktur inneholder følgende:
//
// 1. **Key Documentation Links (for reference)**
//    - [Runbook Index](../docs/hub/content/runbook/00__RUNBOOK_INDEX.md)
//    - [HUB Rulebook](../HUB_RULEBOOK.md)
//    - [HUB State](../HUB_STATE.md)
//    - [Runtime Truth](../runtime-truth.md)
//
// 2. **Andre seksjoner som genereres:**
//    - NEXT ACTIONS, KNOWN ISSUES, SCOPE GUARD, INDEX, og PASTE TARGET LABELING.
//
// Når knappen trykkes, genereres denne meldingen dynamisk og blir tilgjengelig for brukerens chat-opplevelse.
// Lenker til de relevante dokumentene inkluderes for å gjøre navigasjonen enklere.
// Vi bruker disse lenkene for å sørge for at GPT kan hente informasjon fra eksisterende dokumenter i stedet for
// å gjøre unødvendige søk.

function pickLatestFactsBySchema(events: any[], schema: string) {
  for (const ev of events ?? []) {
    const f = ev?.facts ?? {};
    const direct = f?.schema;
    const nestedPayload = f?.payload?.schema;
    const nestedDocPaths = f?.doc_paths?.schema;
    const nestedPaths = f?.paths?.schema;

    if (
      direct === schema ||
      nestedPayload === schema ||
      nestedDocPaths === schema ||
      nestedPaths === schema
    ) {
      return f;
    }
  }
  return undefined;
}

function fsTryParseWrappedStateJsonFromMarkdown(md: string): any | null {
  if (!md || typeof md !== 'string') return null;

  const idx = md.indexOf('### WRAPPED_STATE');
  if (idx < 0) return null;

  const tail = md.slice(idx);
  const fenceStart = tail.indexOf('```json');
  if (fenceStart < 0) return null;

  const after = tail.slice(fenceStart + '```json'.length);
  const fenceEnd = after.indexOf('```');
  if (fenceEnd < 0) return null;

  const jsonText = after.slice(0, fenceEnd).trim();
  if (!jsonText) return null;

  try {
    const obj = JSON.parse(jsonText);
    if (obj && obj.schema === 'WRAPPED_STATE' && obj.schema_version === 1) return obj;
    return null;
  } catch {
    return null;
  }
}

function fsExtractLatestWrappedStateV1(events: any[]): any | null {
  let best: any | null = null;
  let bestTs = 0;

  for (const ev of events ?? []) {
    const ts = Date.parse(ev?.ts ?? ev?.timestamp ?? ev?.time ?? ev?.date ?? '');
    const t = Number.isNaN(ts) ? 0 : ts;

    const f = ev?.facts ?? {};
    const directSchema = f?.schema;
    const nestedSchema = f?.payload?.schema;

    let candidate: any | null = null;

    if (directSchema === 'WRAPPED_STATE') candidate = f;
    else if (nestedSchema === 'WRAPPED_STATE') candidate = f?.payload;

    if (!candidate) {
      const isSessionSummary = directSchema === 'SESSION_SUMMARY' || nestedSchema === 'SESSION_SUMMARY';
      let md: string | null = null;
      if (typeof f?.payload?.markdown === 'string') {
        md = f.payload.markdown;
      } else if (typeof f?.markdown === 'string') {
        md = f.markdown;
      }

      if (isSessionSummary && md) candidate = fsTryParseWrappedStateJsonFromMarkdown(md);
    }

    if (!candidate) continue;
    if (candidate.schema !== 'WRAPPED_STATE' || candidate.schema_version !== 1) continue;

    if (t >= bestTs) {
      bestTs = t;
      best = candidate;
    }
  }

  return best;
}

function fsAsStringArray(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x: any) => String(x).trim()).filter(Boolean);
}

function fsPickList(facts: any, key1: string, key2: string): string[] {
  return fsAsStringArray(facts?.[key1] ?? facts?.[key2] ?? []);
}

function fsRtGetTaskish(ev: any): string {
  return String(
    ev?.task_id ??
    ev?.taskId ??
    ev?.id ??
    ev?.name ??
    '',
  );
}

function fsPickLatestSessionWrapEvent(events: any[]): any | undefined {
  let best: any | undefined = undefined;
  let bestTs = 0;

  for (const ev of events ?? []) {
    const candidates = [
      ev?.task_id,
      ev?.taskId,
      ev?.id,
      ev?.event_id,
      ev?.name,
      fsRtGetTaskish(ev),
    ].map(v => String(v ?? ''));

    const isWrap = candidates.some(k => k.startsWith('HUB_SESSION_WRAP'));
    if (!isWrap) continue;

    const t = Date.parse(String(ev?.ts ?? ''));
    const ms = Number.isNaN(t) ? 0 : t;

    if (!best || ms > bestTs) {
      best = ev;
      bestTs = ms;
    }
  }

  return best;
}

function fsExtractDirectWrapFields(ev: any) {
  const facts = ev?.facts ?? ev?.payload?.facts ?? ev?.payload ?? {};
  const next = facts?.next_actions ?? facts?.nextActions ?? facts?.next ?? [];
  const issues = facts?.known_issues ?? facts?.knownIssues ?? facts?.issues ?? [];
  const status = facts?.status ?? facts?.STATUS ?? null;

  return {
    next: Array.isArray(next) ? next : [],
    issues: Array.isArray(issues) ? issues : [],
    status: typeof status === 'string' ? status : null,
  };
}

function checkpointStatus(ev: any) {
  const factsStatus = ev?.facts?.status;
  if (factsStatus) return String(factsStatus).toUpperCase();

  const summary = (ev?.summary ?? '').toString().toUpperCase();
  if (summary.startsWith('CHECKPOINT GREEN')) return 'GREEN';
  if (summary.startsWith('CHECKPOINT WARN')) return 'WARN';
  if (summary.startsWith('CHECKPOINT ERROR')) return 'ERROR';
  return 'UNKNOWN';
}

function relevanceScore(ev: any) {
  const task = fsRtGetTaskish(ev);

  if (task.includes('BACKSTAGE')) return 100;
  if (task.includes('HUB_DOCS')) return 90;
  if (task.includes('BACKUP')) return 85;
  if (task.includes('RUNTIME')) return 80;
  return 50;
}

function pickRelevantCheckpoints(events: any[], max = 8) {
  return (events ?? [])
    .filter(isCheckpointEvent)
    .sort((a, b) => {
      const r = relevanceScore(b) - relevanceScore(a);
      if (r !== 0) return r;
      return new Date(b.ts).getTime() - new Date(a.ts).getTime();
    })
    .slice(0, max);
}

function fmtCheckpointSmart(ev: any) {
  const status = checkpointStatus(ev);
  const tag =
    status === 'GREEN'
      ? '🟢'
      : status === 'WARN'
        ? '🟡'
        : status === 'ERROR'
          ? '🔴'
          : '⚪';

  return `${tag} ${ev?.ts} | ${fsRtGetTaskish(ev)} | ${ev?.summary}`;
}

function buildNewChatStartText(events: any[]) {
  const docPaths = pickLatestFactsBySchema(events, 'DOC_PATHS');
  const hashes = pickLatestFactsBySchema(events, 'DOC_PATHS_HASHES');
  const latestWrapEv = fsPickLatestSessionWrapEvent(events ?? []);
    const __dbgWrapKey =
      String(latestWrapEv?.task_id ?? latestWrapEv?.taskId ?? latestWrapEv?.id ?? latestWrapEv?.event_id ?? latestWrapEv?.name ?? '');
    const __dbgWrapTs = String(latestWrapEv?.ts ?? '');
    const __dbgEventsLen = Array.isArray(events) ? events.length : 0;
  const wrapDirect = latestWrapEv
    ? fsExtractDirectWrapFields(latestWrapEv)
    : { next: [], issues: [], status: null };
  const hasWrapEvent = Boolean(latestWrapEv);
  const wrapped = fsExtractLatestWrappedStateV1(events ?? []);
  const wrappedNext = wrapped?.next_actions ?? wrapped?.nextActions ?? [];
  const wrappedIssues = wrapped?.known_issues ?? wrapped?.knownIssues ?? [];
  const wrappedStatus = wrapped?.status ?? null;
  const wrapFactsSrc = (latestWrapEv ? fsRtGetFacts(latestWrapEv) : null) ?? latestWrapEv?.facts ?? {};

  const rulebook =
    docPaths?.paths?.HUB_RULEBOOK ??
    'C:\\Users\\danie\\OneDrive\\PROSJEKT SYNK\\BLENDER\\HUB\\HUB_RULEBOOK.md';
  const systems =
    docPaths?.paths?.HUB_SYSTEMS ??
    'C:\\Users\\danie\\OneDrive\\PROSJEKT SYNK\\BLENDER\\HUB\\HUB_SYSTEMS.md';
  const state =
    docPaths?.paths?.HUB_STATE ??
    'C:\\Users\\danie\\OneDrive\\PROSJEKT SYNK\\BLENDER\\HUB\\HUB_STATE.md';

  const shaRule = hashes?.sha256?.HUB_RULEBOOK;
  const shaSys = hashes?.sha256?.HUB_SYSTEMS;
  const shaState = hashes?.sha256?.HUB_STATE;

  const relevant = pickRelevantCheckpoints(events);
  const checkpointLines = relevant.map(fmtCheckpointSmart).join('\n');

  const directGoals = fsPickList(wrapFactsSrc, 'active_goals', 'activeGoals');

  const activeGoals = directGoals.length
    ? directGoals
    : fsAsStringArray(wrapped?.active_goals);
  const goalsText = activeGoals.length
    ? activeGoals.map((x: string) => `- ${x}`).join('\n')
    : '- —';

  const nextActions = wrapDirect.next.length
    ? wrapDirect.next
    : !hasWrapEvent && Array.isArray(wrappedNext)
      ? wrappedNext
      : [];
  const nextActionsText = nextActions.length
    ? nextActions.map((x: string) => `- ${x}`).join('\n')
    : '- —';
  const startFromHereLine = nextActions.length
    ? `Continue from last wrap: ${nextActions[0]}`
    : 'Continue work using HUB laws and INDEX above.';

  const knownIssues = wrapDirect.issues.length
    ? wrapDirect.issues
    : !hasWrapEvent && Array.isArray(wrappedIssues)
      ? wrappedIssues
      : [];
  const knownIssuesWithFallback =
    knownIssues.length === 0 && nextActions.length === 0
      ? hasWrapEvent
        ? ['⚠️ Latest HUB_SESSION_WRAP* event has no next_actions/known_issues in facts']
        : ['⚠️ No session wrap found']
      : knownIssues;
  const knownIssuesText = knownIssuesWithFallback.length
    ? knownIssuesWithFallback.map((x: string) => `- ${x}`).join('\n')
    : '- —';
  const status = wrapDirect.status ?? (typeof wrappedStatus === 'string' ? wrappedStatus : 'GREEN');
  const eventKind = String(
    latestWrapEv?.type ?? latestWrapEv?.event_type ?? 'UNKNOWN',
  );

  const now = new Date();
  const local = new Date(now.toLocaleString('sv-SE', { timeZone: 'Europe/Oslo' }));
  const ms = String(now.getUTCMilliseconds()).padStart(3, '0');
  const offsetMinutes = Math.round((local.getTime() - now.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const offH = String(Math.floor(absMinutes / 60)).padStart(2, '0');
  const offM = String(absMinutes % 60).padStart(2, '0');
  const nowOslo = `${local.toISOString().slice(0, 19)}.${ms}${sign}${offH}:${offM}`;

  return [
    '==================== NEW CHAT START — CONTROL_PLANE ====================',
    'MODE: READ ONLY',
    'TOOL: VSCAI_WSL',
    `__DEBUG_EVENTS_LEN: ${__dbgEventsLen}`,
    `__DEBUG_WRAP_PICKED_KEY: ${__dbgWrapKey || 'n/a'}`,
    `__DEBUG_WRAP_PICKED_TS: ${__dbgWrapTs || 'n/a'}`,
    `DATE/TZ: Europe/Oslo | ${nowOslo}`,
    `STATUS: ${status}`,
    '',
    'NEXT ACTIONS (FROM LAST SESSION WRAP)',
    nextActionsText,
    '',
    'KNOWN ISSUES (FROM LAST SESSION WRAP)',
    knownIssuesText,
    '',
    'EVENT TYPE',
    eventKind,
    '',
    '---',
    '',
    '### Key Documentation Links (for reference):',
    '- [Runbook Index](../docs/hub/content/runbook/00__RUNBOOK_INDEX.md)',
    '- [HUB Rulebook](../HUB_RULEBOOK.md)',
    '- [HUB State](../HUB_STATE.md)',
    '- [Runtime Truth](../runtime-truth.md)',
    '',
    '---',
    '',
    'SCOPE GUARD (CANONICAL — DO NOT EXPAND ARCHITECTURE)',
    '- NEW CHAT START is generated in the frontend runtime UI.',
    '- No new backend endpoints.',
    '- Only docs/hub may be modified unless explicitly ordered.',
    '- Runtime systems unchanged.',
    '- From last session: no backend endpoints added; dedupe intentionally deferred.',
    '',
    'INDEX — WHERE TO LOOK BEFORE GUESSING',
    `1) HUB_RULEBOOK.md  (laws + workflow)`,
    `   ${rulebook}${shaRule ? ' | sha256:' + shaRule : ''}`,
    '   (Canonical laws: see this file before acting)',
    `2) HUB_SYSTEMS.md   (paths + architecture map)`,
    `   ${systems}${shaSys ? ' | sha256:' + shaSys : ''}`,
    `3) HUB_STATE.md     (current operational state)`,
    `   ${state}${shaState ? ' | sha256:' + shaState : ''}`,
    '4) Local AI docs    → consult locally (no blind web search)',
    '5) Backup router v1 → /api/backup/* behavior in HUB_SYSTEMS',
    '',
    'OPERATIVE FOUNDATION (NON-NEGOTIABLE)',
    'ENVIRONMENT TAGS (MUST MATCH REAL CONTEXT)',
    '- VSCAI_WIN  → VS Code AI editing on Windows filesystem (C:\\, D:\\, F:\\).',
    '- VSCAI_WSL  → VS Code AI editing on WSL/Linux filesystem (/home, /mnt/c, ...).',
    '- PowerShell → Windows shell.',
    '- PowerShell (Administrator) → Elevated Windows shell (only when required).',
    '- WSL terminal → Linux shell inside WSL.',
    '',
    'PASTE TARGET LABELING (FOR OPERATOR)',
    '- Every copy-safe block MUST be preceded by a paste-target label OUTSIDE the block:',
    '  LIM RETT INN I → VSCAI_WIN | VSCAI_WSL | PowerShell | PowerShell (Administrator) | WSL terminal',
    '- Labels such as “LIM RETT INN I → …” are NOT executable commands. Do not paste labels into shells.',
    '',
    'CRITICAL COPY RULES (COPY-SAFE)',
    '1) Paste-target label MUST be OUTSIDE the block (never inside code fences).',
    '2) Content INSIDE code fences must be ONLY executable / file-relevant content for that target.',
    '3) No operator instructions, no commentary, no meta text inside code fences.',
    '4) Do not mix contexts (no PowerShell inside WSL blocks; no WSL paths inside Windows-only blocks unless explicitly bridged).',
    '5) If uncertain about target: STOP and consult INDEX docs before acting.',
    '',
    'PASTE DESTINATION DECISION RULE (3-LINE CHECKLIST)',
    '1) Where is the cursor physically?',
    '2) Which filesystem is being modified? (Windows vs WSL)',
    '3) Are elevated rights required?',
    '',
    'LABEL FORMAT (MANDATORY)',
    'LIM RETT INN I → <Eksakt miljø>',
    '',
    'LOCKED LAWS (HUB v4)',
    '- SAFE MODE: measure first, minimal diffs, additive only.',
    '- No refactor. No moving runtime systems.',
    '- Thin orchestration only: UI → backend → existing scripts.',
    '- One change block at a time: VSCAI_WSL / VSCAI_WIN / EXEC.',
    '- Always consult INDEX before inventing solutions.',
    '',
    'WORKFLOW',
    'Measure → Patch → Verify → Checkpoint.',
    'No assumptions. No architecture re-tracing.',
    '',
    'CHAT SUMMARY PUSH (MANDATORY AT END OF SESSION)',
    '- Before ending a chat: push CHECKPOINT task_id=HUB_SESSION_WRAP with facts.schema=SESSION_SUMMARY.',
    '- Must include: achievements, decisions_locked, changes_made, verification, known_issues, next_actions, scope_guard.',
    '- Then start next chat using COPY NEW CHAT START (avoid manual mixed context blocks).',
    '',
    'CANONICAL MAP',
    'Windows runtime truth:',
    '  C:\\AI_WORK\\FS_RUNTIME\\RUNTIME\\runtime.jsonl',
    '  C:\\AI_WORK\\FS_RUNTIME\\RUNTIME\\runtime.latest.json',
    'Vault:',
    '  F:\\HUB_VAULT',
    'WSL:',
    '  /home/danie/control_plane/backstage  (canonical measured path)',
    'Network:',
    '  Host/IP: [derived at runtime; do not hardcode]',
    '  Backend: ${BACKEND_BASE_URL}',
    '  UI: ${APP_BASE_URL}',
    '',
    'LATEST RELEVANT CHECKPOINTS (AUTO-PRIORITIZED)',
    checkpointLines || '- —',
    '',
    'ACTIVE GOALS',
    goalsText,
    '',
    'START FROM HERE (DO NOT RE-TRACE)',
    startFromHereLine,
    '=======================================================================',
    '',
  ].join('\n');
}

void buildNewChatStartText;

function buildNewChatStartTextV2(events: any[]) {
  const DEBUG = false;

  // 1) SSOT: latest session wrap
  const wrapEv = fsPickLatestSessionWrapEvent(events ?? []);
  const wrapKey = String(
    wrapEv?.task_id ?? wrapEv?.taskId ?? wrapEv?.id ?? wrapEv?.event_id ?? wrapEv?.name ?? '',
  );
  const wrapTs = String(wrapEv?.ts ?? '');

  // 2) Canonical facts source
  const wrapFacts = (wrapEv ? fsRtGetFacts(wrapEv) : null) ?? wrapEv?.facts ?? {};

  const nextActions = fsAsStringArray(
    wrapFacts?.next_actions ?? wrapFacts?.nextActions ?? wrapFacts?.next ?? [],
  );
  const knownIssues = fsAsStringArray(
    wrapFacts?.known_issues ?? wrapFacts?.knownIssues ?? wrapFacts?.issues ?? [],
  );
  const activeGoals = fsAsStringArray(
    wrapFacts?.active_goals ?? wrapFacts?.activeGoals ?? [],
  );

  // 3) Docs paths + hashes from latest facts-by-schema
  const docPaths = pickLatestFactsBySchema(events, 'DOC_PATHS');
  const hashes = pickLatestFactsBySchema(events, 'DOC_PATHS_HASHES');

  const rulebook =
    docPaths?.paths?.HUB_RULEBOOK ??
    'C:\\Users\\danie\\OneDrive\\PROSJEKT SYNK\\BLENDER\\HUB\\HUB_RULEBOOK.md';
  const systems =
    docPaths?.paths?.HUB_SYSTEMS ??
    'C:\\Users\\danie\\OneDrive\\PROSJEKT SYNK\\BLENDER\\HUB\\HUB_SYSTEMS.md';
  const state =
    docPaths?.paths?.HUB_STATE ??
    'C:\\Users\\danie\\OneDrive\\PROSJEKT SYNK\\BLENDER\\HUB\\HUB_STATE.md';

  const shaRule = hashes?.sha256?.HUB_RULEBOOK;
  const shaSys = hashes?.sha256?.HUB_SYSTEMS;
  const shaState = hashes?.sha256?.HUB_STATE;

  // 4) Relevant checkpoints
  const relevant = pickRelevantCheckpoints(events, 8);
  const checkpointLines = relevant.map(fmtCheckpointSmart).join('\n');

  // 5) Render

  const lines: string[] = [];
  lines.push('==================== NEW CHAT START — CONTROL_PLANE ====================');
  lines.push('MODE: READ ONLY');
  lines.push('TOOL: VSCAI_WSL');
  if (DEBUG) {
    lines.push(`__DEBUG_EVENTS_LEN: ${Array.isArray(events) ? events.length : 0}`);
    lines.push(`__DEBUG_WRAP_PICKED_KEY: ${wrapKey || 'n/a'}`);
    lines.push(`__DEBUG_WRAP_PICKED_TS: ${wrapTs || 'n/a'}`);
  }
  lines.push(`DATE/TZ: Europe/Oslo | ${wrapTs || 'n/a'}`);
  lines.push('STATUS: YELLOW (backend down; gate unknown)');
  lines.push('');
  lines.push('NEXT ACTIONS (FROM LAST SESSION WRAP)');
  if (nextActions.length) {
    for (const a of nextActions) lines.push(`- ${a}`);
  } else {
    lines.push('- —');
  }
  lines.push('');
  lines.push('KNOWN ISSUES (FROM LAST SESSION WRAP)');
  if (knownIssues.length) {
    for (const i of knownIssues) lines.push(`- ${i}`);
  } else {
    lines.push('- —');
  }
  lines.push('');
  lines.push('ACTIVE GOALS');
  if (activeGoals.length) {
    for (const g of activeGoals) lines.push(`- ${g}`);
  } else {
    lines.push('- —');
  }
  lines.push('');
  lines.push('EVENT TYPE');
  lines.push('CHECKPOINT');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('### Key Documentation Links (for reference):');
  lines.push('- [Runbook Index](../docs/hub/content/runbook/00__RUNBOOK_INDEX.md)');
  lines.push(`- [HUB Rulebook](${rulebook})${shaRule ? ` (sha256: ${shaRule})` : ''}`);
  lines.push(`- [HUB Systems](${systems})${shaSys ? ` (sha256: ${shaSys})` : ''}`);
  lines.push(`- [HUB State](${state})${shaState ? ` (sha256: ${shaState})` : ''}`);
  lines.push('- [Runtime Truth](../runtime-truth.md)');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('SCOPE GUARD (CANONICAL — DO NOT EXPAND ARCHITECTURE)');
  lines.push('- NEW CHAT START is generated in the frontend runtime UI.');
  lines.push('- No new backend endpoints.');
  lines.push('- Only docs/hub may be modified unless explicitly ordered.');
  lines.push('- Runtime systems unchanged.');
  lines.push('- From last session: no backend endpoints added; dedupe intentionally deferred.');
  lines.push('');
  lines.push('--------------------------------------------------------------------------------');
  lines.push('HOW TO PUSH CORRECTLY (DO THIS EVERY SESSION END)');
  lines.push('--------------------------------------------------------------------------------');
  lines.push('Tool choice: WSL terminal (NOT PowerShell)');
  lines.push('');
  lines.push('A) PUSH SESSION WRAP (SSOT) — ONE COMMAND');
  lines.push('/home/danie/control_plane/runtime_truth_store/fs_push_session_wrap.sh \\');
  lines.push('  --id "HUB_SESSION_WRAP__<SHORT_NAME>__YYYY-MM-DD" \\');
  lines.push('  --summary "<1–2 lines: what was achieved>" \\');
  lines.push('  --known-issue "<current blockers or —>" \\');
  lines.push('  --next-action "<exact next step>" \\');
  lines.push('  --goal "<the goal of next chat>" \\');
  lines.push('  --show');
  lines.push('');
  lines.push('Rules:');
  lines.push('- ID MUST start with: HUB_SESSION_WRAP__');
  lines.push('- If COPY NEW CHAT START looks stale: it usually means NO newer HUB_SESSION_WRAP exists.');
  lines.push('  Fix = run the push command above.');
  lines.push('');
  lines.push('B) QUICK VERIFY AFTER PUSH (READ ONLY)');
  lines.push('curl -sS http://127.0.0.1:7007/api/runtime/new-chat-start?debug=1 | head -c 1200');
  lines.push('Expect meta.wrapFound=true and wrapKey points to the wrap you just pushed.');
  lines.push('--------------------------------------------------------------------------------');
  lines.push('');
  lines.push('LATEST WRAP (SSOT)');
  lines.push(`- ${wrapKey || 'n/a'} | ${wrapTs || 'n/a'}`);
  lines.push('');
  lines.push('LATEST RELEVANT CHECKPOINTS (AUTO-PRIORITIZED)');
  lines.push(checkpointLines || '—');
  lines.push('');
  lines.push('START FROM HERE (DO NOT RE-TRACE)');
  lines.push(`Continue from last wrap: ${(nextActions[0] ?? '—')}`);
  lines.push('=======================================================================');

  return lines.join('\n');
}

export const RuntimeTruthPage = () => {
  const configApi = useApi(configApiRef);
  const alertApi = useApi(alertApiRef);
  const envBackendBaseUrl = (process.env.BACKEND_BASE_URL ?? '').trim();
  const cfgBackendBaseUrl = configApi.getOptionalString('backend.baseUrl');
  const normalizedCfg = (cfgBackendBaseUrl ?? '').trim();
  const origin = window.location.origin.replace(/\/$/, '');
  const backendBaseUrlRaw = (normalizedCfg || envBackendBaseUrl).replace(/\/$/, '');

  const backendBaseUrl =
    backendBaseUrlRaw === origin ? '' : backendBaseUrlRaw;
  const EVENTS_FETCH_LIMIT = 200;
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [manualCopyText, setManualCopyText] = useState<string | undefined>(undefined);
  const [newChatStartStale, setNewChatStartStale] = useState<boolean | undefined>(undefined);
  const [newChatStartMeta, setNewChatStartMeta] = useState<Record<string, unknown> | undefined>(undefined);
  const [generatorStatusMeta, setGeneratorStatusMeta] = useState<GeneratorStatusResponse['meta'] | undefined>(undefined);
  const [sessionSummaryMeta, setSessionSummaryMeta] = useState<SessionSummaryMetaResponse['meta'] | null>(null);
  const [sessionSummaryHub, setSessionSummaryHub] = useState<SessionSummaryHubMeta | null>(null);
  const [newChatStartSource, setNewChatStartSource] = useState<'endpoint' | 'fallback' | undefined>(undefined);
  const [actionsAnchorEl, setActionsAnchorEl] = useState<null | HTMLElement>(null);
  const [showDocsIndex, setShowDocsIndex] = useState(false);
  const [showCheckpoints, setShowCheckpoints] = useState(false);
  const [showRestorePacks, setShowRestorePacks] = useState(false);
  const [checkpointFilter, setCheckpointFilter] = useState<
    'ALL' | 'CHECKPOINT' | 'ANCHOR'
  >('ALL');
  const [hubPaths, setHubPaths] = useState<Record<string, string>>({});
  const [hubPathError, setHubPathError] = useState<string | undefined>(undefined);
  const [hubPathsInfo, setHubPathsInfo] = useState<
    { ok?: boolean; source?: string; reason?: string } | undefined
  >(undefined);
  const [hubFileMeta, setHubFileMeta] = useState<Record<string, HubFileMeta>>({});
  const [, setHubFileDetails] = useState<Record<string, HubFileResponse>>({});
  const [docPatchSummary, setDocPatchSummary] = useState<Record<string, HubPatchSummary>>({});
  const [restoreSummary, setRestoreSummary] = useState<Record<string, string>>({});
  const lastFpRef = useRef<string>('');
  const manualCopyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hubRefreshInFlightRef = useRef(false);
  const hubRefreshDebounceRef = useRef<number | undefined>(undefined);

  const getTimeValue = (value?: string) => {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const checkpointEvents = events.filter(isCheckpointEvent);
  let latestCheckpoint: RuntimeEvent | undefined;
  if (checkpointEvents.length === 0) {
    latestCheckpoint = undefined;
  } else {
    latestCheckpoint = checkpointEvents.reduce((latest, candidate) => {
      const latestTs = getTimeValue(latest.ts);
      const candidateTs = getTimeValue(candidate.ts);
      return candidateTs > latestTs ? candidate : latest;
    });
  }

  const summaryText = latestCheckpoint?.summary ?? '';
  const truncatedSummary =
    summaryText.length > 160 ? `${summaryText.slice(0, 157).trimEnd()}...` : summaryText;

  const latestUrls = (latestCheckpoint?.facts?.urls as RuntimeUrls | undefined) ?? undefined;
  const runtimeUiUrl =
    latestUrls?.runtime ||
    latestUrls?.ui ||
    `${window.location.origin.replace(/\/$/, '')}/runtime`;

  const checkpointApiCandidate = latestUrls?.api;
  const backendApiUrl =
    typeof checkpointApiCandidate === 'string' && /^https?:\/\//i.test(checkpointApiCandidate)
      ? checkpointApiCandidate
      : `${backendBaseUrl}/api/runtime/events?limit=${EVENTS_FETCH_LIMIT}`;

  const copyPack = (text: string, message: string) => {
    const result = copyTextRobustSync(text);
    if (result.ok) {
      setManualCopyText(undefined);
      alertApi.post({ message, severity: 'info' });
      return;
    }
    setManualCopyText(text);
    alertApi.post({
      message: 'Automatic copy blocked on this address; use Manual Copy dialog.',
      severity: 'warning',
    });
  };

  const closeActionsMenu = () => setActionsAnchorEl(null);

  const shortValue = (value?: string, max = 44) => {
    if (!value) return '—';
    return value.length > max ? `${value.slice(0, max - 3)}...` : value;
  };

  const copyFromRuntimeEndpoint = async (
    endpoint: string,
    copiedMessage: string,
    fallbackText?: string,
    fallbackCopiedMessage?: string,
  ) => {
    try {
      const base = backendBaseUrl.replace(/\/$/, '');
      const url = `${base}${endpoint}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (response.ok) {
        const json = (await response.json()) as RuntimeTextWithMetaResponse;
        const remoteText = json?.text ?? json?.newChatStartText;
        if (typeof remoteText === 'string' && remoteText.trim()) {
          copyPack(remoteText, copiedMessage);
          return true;
        }
      }
    } catch {
    }

    if (typeof fallbackText === 'string' && fallbackText.trim()) {
      copyPack(fallbackText, fallbackCopiedMessage ?? copiedMessage);
      return false;
    }

    alertApi.post({
      message: `${copiedMessage} failed`,
      severity: 'warning',
    });
    return false;
  };

  const handleCopyNewChatStart = async () => {
    try {
      const base = backendBaseUrl.replace(/\/$/, '');
      const url = `${base}/api/runtime/new-chat-start`;
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (r.ok) {
        const j = (await r.json()) as RuntimeTextWithMetaResponse;
        setNewChatStartMeta(j?.meta);
        const wrapFoundRaw = (j as any)?.meta?.wrapFound;
        const wrapFound = typeof wrapFoundRaw === 'boolean' ? wrapFoundRaw : undefined;
        setNewChatStartStale(
          wrapFound === false ? true : wrapFound === true ? false : undefined
        );
        const remoteText = j?.text ?? j?.newChatStartText;
        const txt = typeof remoteText === 'string' ? remoteText : '';
        if (txt.trim()) {
          setNewChatStartSource('endpoint');
          if (wrapFound === false) {
            const staleTxt = [
              '⚠️ STALE: meta.wrapFound=false — push a HUB_SESSION_WRAP in WSL terminal, then copy again.',
              '',
              txt,
            ].join('\n');
            copyPack(staleTxt, 'Copied NEW CHAT START (stale)');
            return;
          }
          if (wrapFound === true) {
            copyPack(txt, 'Copied NEW CHAT START (fresh)');
            return;
          }
          copyPack(txt, 'Copied NEW CHAT START');
          return;
        }
      }
    } catch {
    }

    const txt = buildNewChatStartTextV2
      ? buildNewChatStartTextV2(events ?? [])
      : buildNewChatStartText(events ?? []);
    setNewChatStartSource('fallback');
    copyPack(txt, 'Copied NEW CHAT START');
  };

  const onCopyResumeFromEndpoint = async () => {
    closeActionsMenu();
    await copyFromRuntimeEndpoint('/api/runtime/resume', 'Copied Resume');
  };

  const onCopyPushWrapCommand = async () => {
    closeActionsMenu();
    const fallback = [
      '/home/danie/control_plane/runtime_truth_store/fs_push_session_wrap.sh \\',
      '  --id "HUB_SESSION_WRAP__<SHORT_NAME>__YYYY-MM-DD" \\',
      '  --summary "<1–2 lines: what was achieved>" \\',
      '  --known-issue "<current blockers or —>" \\',
      '  --next-action "<exact next step>" \\',
      '  --goal "<the goal of next chat>" \\',
      '  --show',
    ].join('\n');
    await copyFromRuntimeEndpoint(
      '/api/runtime/session-wrap-command',
      'Copied Push Wrap Command',
      fallback,
      'Copied Push Wrap Command (fallback)',
    );
  };

  const onCopyFullSessionSummary = async () => {
    closeActionsMenu();
    const fromEndpoint = await copyFromRuntimeEndpoint(
      '/api/runtime/session-summary',
      'Copied Full Session Summary',
    );
    if (fromEndpoint) return;

    try {
      let src = (events ?? []).filter(Boolean);
      if (!src.length) {
        const limit = 200;
        const url = `${backendBaseUrl.replace(/\/$/, '')}/api/runtime/events?limit=${limit}`;
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = (await response.json()) as RuntimeEventsResponse;
        src = (json.events ?? []).map((event, idx) => normalizeRuntimeEvent(event, idx));
      }

      const md = buildFullSessionSummaryWithWrappedState(src);
      copyPack(md, 'Copied Full Session Summary (fallback)');
    } catch {
      alertApi.post({ message: 'Copy Full Session Summary failed', severity: 'warning' });
    }
  };

  const refreshSessionSummaryHubPreview = async () => {
    try {
      const base = backendBaseUrl.replace(/\/$/, '');
      const response = await fetch(`${base}/api/runtime/session-summary?hub=1&debug=1`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        setSessionSummaryMeta(null);
        setSessionSummaryHub({ enabled: false, parseError: `HTTP ${response.status}` });
        return;
      }
      const json = (await response.json()) as SessionSummaryMetaResponse;
      const hub = json?.meta?.hub ?? null;
      setSessionSummaryMeta(json?.meta ?? null);
      setSessionSummaryHub(hub);
    } catch {
      setSessionSummaryMeta(null);
      setSessionSummaryHub({ enabled: false, parseError: 'fetch failed' });
    }
  };

  const openInNewTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const isDocEvent = (event: RuntimeEvent) => {
    const tags = Array.isArray(event.tags) ? event.tags : [];
    const hasDocTag = tags.some(tag => /^doc:/i.test(tag));
    const taskId = event.task_id ?? '';
    const summary = event.summary ?? '';
    return hasDocTag || /^DOC_/i.test(taskId) || /^DOC:/i.test(summary);
  };

  const docs = useMemo(() => {
    return events.filter(isDocEvent);
  }, [events]);

  const docsNewestFirst = useMemo(() => {
    return [...docs].sort((a, b) => (b.ts ?? '').localeCompare(a.ts ?? ''));
  }, [docs]);

  const getDocPayload = (event: RuntimeEvent) => {
    const facts = event.facts;
    const docText =
      facts && typeof facts === 'object'
        ? (facts.doc as { text?: unknown } | undefined)?.text
        : undefined;
    const factsText =
      facts && typeof facts === 'object' ? (facts.text as unknown) : undefined;
    const hasFactsObject = Boolean(facts && Object.keys(facts).length);
    if (typeof docText === 'string' && docText.trim()) return docText;
    if (typeof factsText === 'string' && factsText.trim()) return factsText;
    if (hasFactsObject) return JSON.stringify(facts, null, 2);
    return 'Doc event has no payload';
  };

  const formatDocBlock = (event: RuntimeEvent) => {
    const title = event.summary || event.task_id || 'DOC event';
    const body = getDocPayload(event);

    return [
      `=== DOC: ${title} ===`,
      `TS: ${event.ts ?? 'n/a'}`,
      '',
      `${body}`,
    ].join('\n');
  };

  const handleCopyDoc = (event: RuntimeEvent) => {
    const text = formatDocBlock(event);
    copyPack(text, 'Copied DOC to clipboard');
  };

  const handleCopyCheckpoint = (event: RuntimeEvent) => {
    const text = JSON.stringify(event, null, 2);
    copyPack(text, 'Copied CHECKPOINT event JSON');
  };

  const runtimeApiBase = `${backendBaseUrl.replace(/\/$/, '')}/api/runtime`;

  const parseErrorMessage = async (response: Response) => {
    try {
      const json = (await response.json()) as { error?: string };
      return json.error || `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  };

  const refreshHubPaths = async () => {
    if (hubRefreshInFlightRef.current) return;
    hubRefreshInFlightRef.current = true;
    try {
      const response = await fetch(`${runtimeApiBase}/hub/paths`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        setHubPaths({});
        setHubFileMeta({});
        setHubPathsInfo(undefined);
        setHubPathError(await parseErrorMessage(response));
        return;
      }
      const json = (await response.json()) as HubPathsResponse;
      setHubPathsInfo({
        ok: (json as any)?.ok,
        source: (json as any)?.source,
        reason: (json as any)?.reason,
      });
      const docPaths = json.docPaths ?? {};
      setHubPaths(docPaths);

      const nextMeta: Record<string, HubFileMeta> = {};
      await Promise.all(
        KNOWN_HUB_FILES.map(async name => {
          const livePath = docPaths[name];
          if (!livePath) {
            return;
          }
          try {
            const fileResponse = await fetch(
              `${runtimeApiBase}/hub/file?name=${encodeURIComponent(name)}`,
              { headers: { Accept: 'application/json' } },
            );
            if (!fileResponse.ok) {
              nextMeta[name] = {
                ok: false,
                error: await parseErrorMessage(fileResponse),
              };
              return;
            }
            const fileJson = (await fileResponse.json()) as HubFileResponse;
            nextMeta[name] = {
              ok: true,
              sha256: fileJson.sha256,
              mtime: fileJson.mtime,
              size: fileJson.size,
            };
          } catch (e) {
            nextMeta[name] = { ok: false, error: (e as Error).message };
          }
        }),
      );
      setHubFileMeta(nextMeta);
      setHubPathError(undefined);
      alertApi.post({ message: 'HUB paths refreshed', severity: 'info' });
    } catch (e) {
      setHubPaths({});
      setHubFileMeta({});
      setHubPathsInfo(undefined);
      setHubPathError((e as Error).message);
      alertApi.post({ message: 'Failed to refresh HUB paths', severity: 'error' });
    } finally {
      hubRefreshInFlightRef.current = false;
    }
  };

  const handleOpenHubFile = async (name: string) => {
    try {
      const response = await fetch(
        `/api/runtime/hub/file?name=${encodeURIComponent(name)}`,
        { headers: { Accept: 'application/json' } },
      );
      if (!response.ok) {
        alertApi.post({
          message: await parseErrorMessage(response),
          severity: 'error',
        });
        return;
      }
      const json = (await response.json()) as HubFileResponse;
      setHubFileDetails(prev => ({ ...prev, [name]: json }));
      const windowHandle = window.open('', '_blank');
      if (!windowHandle) {
        return;
      }
      windowHandle.document.write(
        "<pre style='white-space:pre-wrap;font-family:monospace'></pre>",
      );
      const pre = windowHandle.document.querySelector('pre');
      if (pre) {
        pre.textContent = typeof json.content === 'string' ? json.content : '';
      }
      alertApi.post({ message: `Opened ${name}`, severity: 'info' });
    } catch {
      alertApi.post({ message: `Failed to open ${name}`, severity: 'error' });
    }
  };

  const fsToVscodeFileUrl = (absPath: string): string | null => {
    if (absPath.startsWith('/mnt/c/')) {
      const win = `C:\\${absPath.slice('/mnt/c/'.length).replace(/\//g, '\\\\')}`;
      return `vscode://file/${encodeURIComponent(win)}`;
    }
    if (/^[A-Za-z]:\\/.test(absPath)) {
      return `vscode://file/${encodeURIComponent(absPath)}`;
    }
    return null;
  };

  const handleOpenInVSCode = (sourcePath: string) => {
    const url = fsToVscodeFileUrl(sourcePath);
    if (!url) {
      alertApi.post({ message: 'VS Code open unsupported for this path', severity: 'warning' });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const inferHubNameFromDoc = (event: RuntimeEvent) => {
    const tags = Array.isArray(event.tags) ? event.tags : [];
    if (tags.includes('doc:rules')) return 'HUB_RULEBOOK.md';
    if (tags.includes('doc:state')) return 'HUB_STATE.md';
    if (tags.includes('doc:systems')) return 'HUB_SYSTEMS.md';
    const joined = `${event.task_id ?? ''} ${event.summary ?? ''}`.toUpperCase();
    if (joined.includes('RULEBOOK') || joined.includes('RULES')) return 'HUB_RULEBOOK.md';
    if (joined.includes('STATE')) return 'HUB_STATE.md';
    if (joined.includes('SYSTEMS')) return 'HUB_SYSTEMS.md';
    return undefined;
  };

  const applyHubPatch = async (
    event: RuntimeEvent,
    dryRun: boolean,
    nameOverride?: string,
  ) => {
    const docName = nameOverride || inferHubNameFromDoc(event);
    if (!docName) {
      alertApi.post({ message: 'DOC event does not map to HUB target', severity: 'warning' });
      return;
    }
    if (!dryRun) {
      const ok = window.confirm(
        `Apply live patch to ${docName}? This writes to the live HUB file.`,
      );
      if (!ok) return;
    }

    const patchBody = {
      name: docName,
      dryRun,
      patch: {
        op: 'append',
        text: getDocPayload(event),
      },
    };
    try {
      const response = await fetch(`${runtimeApiBase}/hub/patch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(patchBody),
      });
      const key = `${event.ts ?? 'n/a'}|${event.task_id ?? 'n/a'}|${docName}`;
      if (!response.ok) {
        const message = await parseErrorMessage(response);
        setDocPatchSummary(prev => ({ ...prev, [key]: { error: message } }));
        alertApi.post({ message, severity: 'error' });
        return;
      }
      const json = (await response.json()) as HubPatchSummary;
      setDocPatchSummary(prev => ({ ...prev, [key]: json }));
      alertApi.post({
        message: dryRun ? 'Dry-run patch completed' : 'Patch applied',
        severity: 'info',
      });
      if (!dryRun) {
        void handleOpenHubFile(docName);
      }
    } catch {
      alertApi.post({ message: 'Patch request failed', severity: 'error' });
    }
  };

  const getCheckpointId = (event: RuntimeEvent) => {
    const facts = event.facts;
    if (facts && typeof facts.checkpoint_id === 'string' && facts.checkpoint_id) {
      return facts.checkpoint_id;
    }
    return event.task_id;
  };

  const runRestore = async (event: RuntimeEvent, dryRun: boolean) => {
    const checkpointId = getCheckpointId(event);
    if (!checkpointId) {
      const key = `${event.ts ?? 'n/a'}|${event.task_id ?? 'n/a'}`;
      setRestoreSummary(prev => ({ ...prev, [key]: 'No checkpoint_id/task_id available' }));
      return;
    }
    if (!dryRun) {
      const ok = window.confirm(
        `Restore HUB files from checkpoint ${checkpointId}? This writes to live files.`,
      );
      if (!ok) return;
    }
    try {
      const response = await fetch(`${runtimeApiBase}/hub/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ checkpoint_id: checkpointId, dryRun }),
      });
      const key = `${event.ts ?? 'n/a'}|${event.task_id ?? 'n/a'}`;
      if (!response.ok) {
        const message = await parseErrorMessage(response);
        setRestoreSummary(prev => ({ ...prev, [key]: message }));
        alertApi.post({ message, severity: response.status === 409 ? 'warning' : 'error' });
        return;
      }
      const json = (await response.json()) as { files?: Array<Record<string, unknown>> };
      setRestoreSummary(prev => ({
        ...prev,
        [key]: JSON.stringify(json, null, 2),
      }));
      alertApi.post({
        message: dryRun ? 'Dry-run restore complete' : 'Restore complete',
        severity: 'info',
      });
    } catch {
      alertApi.post({ message: 'Restore request failed', severity: 'error' });
    }
  };

  const timelineEvents = useMemo(() => {
    const hasTag = (event: RuntimeEvent, tag: string) =>
      (Array.isArray(event.tags) ? event.tags : []).some(next =>
        typeof next === 'string' ? next.toLowerCase() === tag : false,
      );
    const filtered = events.filter(event => {
      const kind = eventTypeNorm(event);
      return (
        isCheckpointEvent(event) ||
        kind === 'ANCHOR' ||
        hasTag(event, 'checkpoint') ||
        hasTag(event, 'anchor')
      );
    });
    return filtered.sort((a, b) => (b.ts ?? '').localeCompare(a.ts ?? ''));
  }, [events]);

  const filteredTimelineEvents = useMemo(() => {
    if (checkpointFilter === 'ALL') return timelineEvents;
    if (checkpointFilter === 'CHECKPOINT') {
      return timelineEvents.filter(isCheckpointEvent);
    }
    return timelineEvents.filter(event => eventTypeNorm(event) === 'ANCHOR');
  }, [timelineEvents, checkpointFilter]);

  const hubDocTargets = [
    {
      tag: 'doc:rules',
      fileName: 'HUB_RULEBOOK.md',
      path: 'C:\\Users\\danie\\OneDrive\\PROSJEKT SYNK\\BLENDER\\HUB\\HUB_RULEBOOK.md',
    },
    {
      tag: 'doc:state',
      fileName: 'HUB_STATE.md',
      path: 'C:\\Users\\danie\\OneDrive\\PROSJEKT SYNK\\BLENDER\\HUB\\HUB_STATE.md',
    },
    {
      tag: 'doc:systems',
      fileName: 'HUB_SYSTEMS.md',
      path: 'C:\\Users\\danie\\OneDrive\\PROSJEKT SYNK\\BLENDER\\HUB\\HUB_SYSTEMS.md',
    },
  ] as const;

  const getDocByTag = (tag: string) =>
    docsNewestFirst.find(event =>
      (Array.isArray(event.tags) ? event.tags : []).some(next => next === tag),
    );

  const buildHubDocMarkdown = (event: RuntimeEvent) => {
    const title = event.summary || event.task_id || 'Runtime DOC';
    const payload = getDocPayload(event);
    return [
      `# ${title}`,
      `(${event.ts ?? 'n/a'}, ${event.project ?? 'n/a'}, ${event.task_id ?? 'n/a'})`,
      '',
      payload,
    ].join('\n');
  };

  const wslHealthPack = [
    'cd [workspace-local checkout]',
    'curl -s ${BACKEND_BASE_URL}/api/runtime/events?limit=${EVENTS_FETCH_LIMIT} | head -n 20',
    "ss -ltnp | grep -E ':(3000|7007)\\b' || echo NO_LISTENERS",
    "systemctl --user --no-pager --full status backstage-dev.service | sed -n '1,40p'",
  ].join('\n');

  const windowsHealthPack = [
    'Set-StrictMode -Version Latest',
    '$ErrorActionPreference = "Stop"',
    'Test-NetConnection 127.0.0.1 -Port 3000',
    'Test-NetConnection 127.0.0.1 -Port 7007',
    'if (Test-Path "C:\\AI_WORK\\FS_RUNTIME\\RUNTIME\\runtime.latest.json") {',
    '  Get-Content "C:\\AI_WORK\\FS_RUNTIME\\RUNTIME\\runtime.latest.json" -Head 40',
    '} else {',
    '  Write-Host "runtime.latest.json not found"',
    '}',
  ].join('\n');

  const fullGreenRecoveryChecklist = [
    '- Verify listeners on ports 3000 and 7007',
    '- Verify curl ${BACKEND_BASE_URL}/api/runtime/events?limit=3 returns 200 JSON',
    '- Open ${APP_BASE_URL}/runtime',
    '- Confirm latest checkpoint line is populated (not n/a)',
    '- Confirm docs index loads DOC items and copy works',
  ].join('\n');

  useEffect(() => {
    let alive = true;
    const fetchGeneratorStatus = async () => {
      try {
        const base = backendBaseUrl.replace(/\/$/, '');
        const response = await fetch(`${base}/api/runtime/generator-status`, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) return;
        const json = (await response.json()) as GeneratorStatusResponse;
        if (!alive) return;
        setGeneratorStatusMeta(json?.meta);
      } catch {
      }
    };

    void fetchGeneratorStatus();
    return () => {
      alive = false;
    };
  }, [backendBaseUrl]);

  useEffect(() => {
    // startup refresh (best effort)
    void refreshHubPaths();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Debounce so rapid polling/event updates don't spam backend.
    // Only refresh if hub paths are unknown OR backend previously said not-ready.
    const shouldRefresh =
      !hubPathsInfo ||
      hubPathsInfo.ok === false ||
      Object.keys(hubPaths || {}).length === 0;

    if (!shouldRefresh) return;

    if (hubRefreshDebounceRef.current) {
      window.clearTimeout(hubRefreshDebounceRef.current);
    }

    hubRefreshDebounceRef.current = window.setTimeout(() => {
      void refreshHubPaths();
    }, 750);

    return () => {
      if (hubRefreshDebounceRef.current) {
        window.clearTimeout(hubRefreshDebounceRef.current);
      }
    };
  }, [events]);

  useEffect(() => {
    if (!showCheckpoints) return;
    void refreshSessionSummaryHubPreview();
  }, [showCheckpoints]);

  useEffect(() => {
    function fsSafeFactsDigest(ev: any): string {
      try {
        const key = String(ev?.task_id ?? ev?.taskId ?? ev?.id ?? ev?.event_id ?? ev?.name ?? '');
        const isWrap = key.startsWith('HUB_SESSION_WRAP');
        if (!isWrap) return '';
        const facts = ev?.facts ?? ev?.payload?.facts ?? ev?.payload ?? null;
        if (!facts || typeof facts !== 'object') return '';
        return JSON.stringify(facts);
      } catch {
        return '';
      }
    }

    const fingerprint = (nextEvents: RuntimeEvent[]) =>
      JSON.stringify((nextEvents ?? []).map((ev: any) => ([
        String(ev?.ts ?? ''),
        String(fsRtGetTaskish(ev) ?? ''),
        String(ev?.summary ?? ''),
        fsSafeFactsDigest(ev),
      ])));

    const fetchEvents = async ({ silent }: { silent: boolean }) => {
      if (!silent) setLoading(true);
      try {
        const limit = EVENTS_FETCH_LIMIT;
        const url = `${backendBaseUrl.replace(/\/$/, '')}/api/runtime/events?limit=${limit}`;
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = (await response.json()) as RuntimeEventsResponse;
        const nextEvents = (json.events ?? []).map((event, idx) =>
          normalizeRuntimeEvent(event, idx),
        );
        const fp = fingerprint(nextEvents);
        if (fp !== lastFpRef.current) {
          lastFpRef.current = fp;
          setEvents(nextEvents);
        }
        setError(undefined);
      } catch (e) {
        setError(e as Error);
      } finally {
        if (!silent) setLoading(false);
      }
    };

    let alive = true;
    (async () => {
      if (!alive) return;
      await fetchEvents({ silent: false });
    })();
    const id = window.setInterval(() => {
      if (!alive) return;
      void fetchEvents({ silent: true });
    }, 2000);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [backendBaseUrl]);

  const freshnessWrapKeyRaw =
    String(generatorStatusMeta?.latestWrapKey ?? (newChatStartMeta?.wrapKey as string | undefined) ?? '');
  const freshnessWrapTs =
    String(generatorStatusMeta?.latestWrapTs ?? (newChatStartMeta?.wrapTs as string | undefined) ?? '');
  const freshnessGateOk =
    typeof generatorStatusMeta?.gateOk === 'boolean'
      ? generatorStatusMeta.gateOk
      : typeof newChatStartMeta?.gateOk === 'boolean'
      ? (newChatStartMeta.gateOk as boolean)
      : undefined;
  const freshnessGateTs =
    String(generatorStatusMeta?.latestGateTs ?? (newChatStartMeta?.gateTs as string | undefined) ?? '');
  const freshnessTemplateVersion =
    String(
      generatorStatusMeta?.versions?.newChatStart ??
      (newChatStartMeta?.templateVersion as string | undefined) ??
      '',
    );
  const freshnessWrapFound =
    typeof newChatStartMeta?.wrapFound === 'boolean'
      ? (newChatStartMeta.wrapFound as boolean)
      : Boolean(freshnessWrapKeyRaw);

  return (
    <Page themeId="tool">
      <Header title="Runtime Truth" />
      <Content>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Resume</div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>
              <strong>Latest checkpoint:</strong>{' '}
              {latestCheckpoint
                ? `${latestCheckpoint.ts ?? 'n/a'} | ${latestCheckpoint.project ?? 'n/a'} | ${truncatedSummary || 'n/a'}`
                : 'n/a'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button variant="contained" color={newChatStartStale === true ? 'secondary' : 'primary'} onClick={handleCopyNewChatStart}>
              {newChatStartStale === true
                ? 'New Chat Start (stale)'
                : newChatStartStale === false
                  ? 'New Chat Start (fresh)'
                  : 'New Chat Start'}
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={event => setActionsAnchorEl(event.currentTarget)}
            >
              Actions ▾
            </Button>
            <Menu
              anchorEl={actionsAnchorEl}
              keepMounted
              open={Boolean(actionsAnchorEl)}
              onClose={closeActionsMenu}
            >
              <MenuItem onClick={() => void onCopyResumeFromEndpoint()}>Copy Resume</MenuItem>
              <MenuItem onClick={() => void onCopyPushWrapCommand()}>Copy Push Wrap Command</MenuItem>
              <MenuItem onClick={() => void onCopyFullSessionSummary()}>Copy Full Session Summary</MenuItem>
            </Menu>
            <Button variant="outlined" onClick={() => openInNewTab(runtimeUiUrl)}>
              OPEN RUNTIME UI
            </Button>
            <Button variant="outlined" onClick={() => openInNewTab(backendApiUrl)}>
              OPEN BACKEND API
            </Button>
            <Button variant="outlined" onClick={() => setShowDocsIndex(prev => !prev)}>
              DOCS INDEX
            </Button>
            <Button variant="outlined" onClick={() => setShowCheckpoints(prev => !prev)}>
              CHECKPOINTS
            </Button>
            <Button variant="outlined" onClick={() => setShowRestorePacks(prev => !prev)}>
              RESTORE PACKS
            </Button>
          </div>
        </div>
        <div style={{ marginTop: -8, marginBottom: 12, fontSize: 12, opacity: 0.85 }}>
          <strong>Freshness:</strong>{' '}
          wrap {shortValue(freshnessWrapKeyRaw)} @ {freshnessWrapTs || '—'} | gate{' '}
          {typeof freshnessGateOk === 'boolean' ? (freshnessGateOk ? 'OK' : 'FAIL') : '—'} @ {freshnessGateTs || '—'} | template {freshnessTemplateVersion || '—'} | source{' '}
          {newChatStartSource ?? '—'}{' '}
          {!freshnessWrapFound && (
            <span style={{ color: '#b71c1c', fontWeight: 600 }}>| STALE/NO WRAP</span>
          )}
        </div>
        {manualCopyText && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1300,
              padding: 16,
            }}
          >
            <div
              style={{
                width: 'min(920px, 100%)',
                maxHeight: '90vh',
                background: '#fff',
                borderRadius: 6,
                padding: 16,
                overflow: 'auto',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Manual Copy</div>
              <div style={{ marginBottom: 12 }}>
                Automatisk kopiering er blokkert på denne adressen (HTTP over IP). Marker og kopier manuelt.
              </div>
              <textarea
                ref={manualCopyTextareaRef}
                readOnly
                value={manualCopyText}
                style={{ width: '100%', minHeight: 240, resize: 'vertical', marginBottom: 12 }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    const next = manualCopyTextareaRef.current;
                    if (!next) return;
                    next.focus();
                    next.select();
                  }}
                >
                  Markér alt
                </Button>
                <Button variant="contained" color="primary" onClick={() => setManualCopyText(undefined)}>
                  Lukk
                </Button>
              </div>
            </div>
          </div>
        )}
        {showDocsIndex && (
          <div style={{ marginBottom: 16, padding: 12, border: '1px solid #ddd', borderRadius: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Docs Index</div>
            {docs.length === 0 ? (
              <div style={{ fontSize: 14 }}>No DOC events found.</div>
            ) : (
              docsNewestFirst.map((doc, idx) => {
                const docTitle = doc.summary || doc.task_id || `DOC #${idx + 1}`;
                const hasPayload = !!(doc.facts && Object.keys(doc.facts).length);
                const hubDocName = inferHubNameFromDoc(doc);
                const patchKey = `${doc.ts ?? 'n/a'}|${doc.task_id ?? 'n/a'}|${hubDocName ?? 'none'}`;
                const patchSummary = docPatchSummary[patchKey];
                return (
                  <div key={`${doc.ts ?? 'n/a'}-${doc.task_id ?? idx}`} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #eee' }}>
                    <div style={{ fontWeight: 600 }}>{docTitle}</div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
                      {doc.ts ?? 'n/a'} | {doc.project ?? 'n/a'}
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 6 }}>
                      {hasPayload ? 'Payload available' : 'Doc event has no payload'}
                    </div>
                    <Button size="small" variant="outlined" onClick={() => handleCopyDoc(doc)}>
                      COPY
                    </Button>
                    {hubDocName && (
                      <>
                        <Button
                          size="small"
                          variant="outlined"
                          style={{ marginLeft: 8 }}
                          onClick={() => void applyHubPatch(doc, true, hubDocName)}
                        >
                          DRY-RUN APPLY PATCH
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          style={{ marginLeft: 8 }}
                          onClick={() => void applyHubPatch(doc, false, hubDocName)}
                        >
                          APPLY PATCH
                        </Button>
                      </>
                    )}
                    {patchSummary && (
                      <pre style={{ marginTop: 8, marginBottom: 0, padding: 8, overflowX: 'auto' }}>
                        {JSON.stringify(patchSummary, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })
            )}

            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 16, marginBottom: 8 }}>
              HUB Docs (resolved from runtime DOC_PATHS checkpoint; fallback enabled)
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
              {hubPathsInfo?.ok === false ? (
                <>
                  HUB paths: <b>NOT READY</b> (source: {hubPathsInfo?.source ?? '—'}) —{' '}
                  {hubPathsInfo?.reason ?? '—'}
                </>
              ) : hubPathsInfo?.ok === true ? (
                <>
                  HUB paths: <b>OK</b> (source: {hubPathsInfo?.source ?? '—'})
                </>
              ) : (
                <>
                  HUB paths: <b>UNKNOWN</b>
                </>
              )}
            </div>
            <div style={{ marginBottom: 10 }}>
              <Button size="small" variant="outlined" onClick={() => void refreshHubPaths()}>
                REFRESH HUB PATHS
              </Button>
            </div>
            {hubPathError && (
              <div style={{ fontSize: 13, marginBottom: 8 }}>HUB paths error: {hubPathError}</div>
            )}
            {hubDocTargets.map(target => {
              const doc = getDocByTag(target.tag);
              const livePath = hubPaths[target.fileName];
              const fileMeta = hubFileMeta[target.fileName];
              const status = !livePath
                ? `MISSING (no path)${hubPathsInfo?.ok === false ? ' (see header reason)' : ''}`
                : fileMeta?.ok === true
                ? 'FOUND'
                : fileMeta?.ok === false
                ? 'MISSING'
                : 'UNKNOWN';
              return (
                <div key={target.tag} style={{ marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #eee' }}>
                  <div style={{ fontWeight: 600 }}>{target.fileName}</div>
                  <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>{livePath ?? 'No DOC_PATHS entry'}</div>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>Status: {status}</div>
                  {fileMeta?.ok === false && fileMeta.error && (
                    <div style={{ fontSize: 12, marginBottom: 6 }}>error: {fileMeta.error}</div>
                  )}
                  {fileMeta?.sha256 && (
                    <div style={{ fontSize: 12, marginBottom: 6 }}>sha256: {fileMeta.sha256}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => doc && copyPack(buildHubDocMarkdown(doc), `Copied ${target.fileName}`)}
                      disabled={!doc}
                    >
                      COPY {target.fileName}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => void handleOpenHubFile(target.fileName)}
                      disabled={!livePath}
                    >
                      OPEN
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => (livePath ? handleOpenInVSCode(livePath) : undefined)}
                      disabled={!livePath}
                    >
                      OPEN IN VS CODE
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        livePath
                          ? copyPack(livePath, `Copied path for ${target.fileName}`)
                          : undefined
                      }
                      disabled={!livePath}
                    >
                      COPY PATH
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        fileMeta?.ok === true && fileMeta.sha256
                          ? copyPack(fileMeta.sha256, `Copied SHA for ${target.fileName}`)
                          : undefined
                      }
                      disabled={fileMeta?.ok !== true || !fileMeta.sha256}
                    >
                      COPY SHA
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        copyPack(
                          `Paste into file: ${livePath ?? '[DOC_PATHS missing]'} (replace entire file).`,
                          'Copied PATCH INSTRUCTIONS',
                        )
                      }
                    >
                      COPY PATCH INSTRUCTIONS
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {showCheckpoints && (
          <div style={{ marginBottom: 16, padding: 12, border: '1px solid #ddd', borderRadius: 4 }}>
            <div style={{ marginBottom: 10, padding: 10, border: '1px dashed #ddd', borderRadius: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Session Summary — HUB relevance</div>
                <button
                  type="button"
                  onClick={() => void refreshSessionSummaryHubPreview()}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    color: '#1976d2',
                    cursor: 'pointer',
                    fontSize: 12,
                    textDecoration: 'underline',
                  }}
                >
                  Refresh
                </button>
              </div>
              {sessionSummaryHub?.enabled ? (
                <div style={{ fontSize: 12 }}>
                  <div>hub.enabled: true</div>
                  <div>hub.indexPath: {sessionSummaryHub.indexPath || '—'}</div>
                  <div>hub.parsedEntries: {sessionSummaryHub.parsedEntries ?? 0}</div>
                  <div>hub.droppedCount: {sessionSummaryHub.droppedCount ?? 0}</div>
                  <div>hub.parseError: {sessionSummaryHub.parseError || '—'}</div>
                  <div style={{ marginTop: 6, fontWeight: 600 }}>Selected</div>
                  {(sessionSummaryHub.selected ?? []).slice(0, 7).length > 0 ? (
                    (sessionSummaryHub.selected ?? []).slice(0, 7).map((item, idx) => (
                      <div key={`${item.title ?? 'n/a'}-${item.path ?? idx}`}>
                        • {item.title ?? '—'} — {item.path ?? '—'} (score {item.score ?? 0})
                      </div>
                    ))
                  ) : (
                    <div>• —</div>
                  )}
                  {(sessionSummaryHub.selected ?? []).slice(0, 3).some(item => Array.isArray(item.why) && item.why.length) && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontWeight: 600 }}>Why (first 3)</div>
                      {(sessionSummaryHub.selected ?? []).slice(0, 3).map((item, idx) => (
                        <div key={`why-${item.title ?? idx}`}>
                          - {(item.title ?? '—')}: {(item.why ?? []).join(', ') || '—'}
                        </div>
                      ))}
                    </div>
                  )}
                  {sessionSummaryHub.debug && (
                    <div style={{ marginTop: 6 }}>
                      <div>hub.debug.tokens sample: {(sessionSummaryHub.debug.tokens ?? []).slice(0, 12).join(', ') || '—'}</div>
                      <div>hub.debug.tags sample: {(sessionSummaryHub.debug.tags ?? []).slice(0, 12).join(', ') || '—'}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 12 }}>
                  <div>hub.disabled</div>
                  <div>Suggestion: call /api/runtime/session-summary?hub=1&debug=1</div>
                  {sessionSummaryHub?.parseError && <div>hub.parseError: {sessionSummaryHub.parseError}</div>}
                </div>
              )}
              {!sessionSummaryHub && !sessionSummaryMeta && (
                <div style={{ fontSize: 12 }}>No preview fetched yet.</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <Button size="small" variant={checkpointFilter === 'ALL' ? 'contained' : 'outlined'} onClick={() => setCheckpointFilter('ALL')}>ALL</Button>
              <Button size="small" variant={checkpointFilter === 'CHECKPOINT' ? 'contained' : 'outlined'} onClick={() => setCheckpointFilter('CHECKPOINT')}>CHECKPOINT</Button>
              <Button size="small" variant={checkpointFilter === 'ANCHOR' ? 'contained' : 'outlined'} onClick={() => setCheckpointFilter('ANCHOR')}>ANCHOR</Button>
            </div>
            {filteredTimelineEvents.length === 0 ? (
              <div style={{ fontSize: 14 }}>No timeline events found.</div>
            ) : (
              filteredTimelineEvents.map((event, idx) => {
                const summary = event.summary ?? '';
                const trimmedSummary = summary.length > 120 ? `${summary.slice(0, 117).trimEnd()}...` : summary;
                return (
                  <div key={`${event.ts ?? 'n/a'}-${event.task_id ?? idx}`} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #eee' }}>
                    <div style={{ flex: 1, fontSize: 13 }}>
                      {event.ts ?? 'n/a'} | {event.event_type ?? 'n/a'} | {event.task_id ?? 'n/a'} | {trimmedSummary || 'n/a'}
                    </div>
                    <Button size="small" variant="outlined" onClick={() => handleCopyCheckpoint(event)}>COPY</Button>
                    <Button size="small" variant="outlined" onClick={() => void runRestore(event, true)}>
                      DRY-RUN RESTORE HUB (this checkpoint)
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => void runRestore(event, false)}>
                      RESTORE HUB
                    </Button>
                  </div>
                );
              })
            )}
            {filteredTimelineEvents.map((event, idx) => {
              const key = `${event.ts ?? 'n/a'}|${event.task_id ?? 'n/a'}`;
              const summary = restoreSummary[key];
              if (!summary) return null;
              return (
                <pre key={`restore-${key}-${idx}`} style={{ marginTop: 0, marginBottom: 8, padding: 8, overflowX: 'auto' }}>
                  {summary}
                </pre>
              );
            })}
          </div>
        )}
        {showRestorePacks && (
          <div style={{ marginBottom: 16, padding: 12, border: '1px solid #ddd', borderRadius: 4 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="outlined" onClick={() => copyPack(wslHealthPack, 'Copied WSL HEALTH PACK')}>
                COPY WSL HEALTH PACK
              </Button>
              <Button variant="outlined" onClick={() => copyPack(windowsHealthPack, 'Copied WINDOWS HEALTH PACK (PWS)')}>
                COPY WINDOWS HEALTH PACK (PWS)
              </Button>
              <Button variant="outlined" onClick={() => copyPack(fullGreenRecoveryChecklist, 'Copied FULL GREEN RECOVERY CHECKLIST')}>
                COPY FULL GREEN RECOVERY CHECKLIST
              </Button>
            </div>
          </div>
        )}
        {loading && <Progress />}
        {!loading && error && <ResponseErrorPanel error={error} />}
        {!loading && !error && (
          <Table
            title="Runtime Truth"
            options={{ paging: true, pageSize: 20, search: false }}
            columns={[
              { title: 'ts', field: 'ts' },
              { title: 'project', field: 'project' },
              { title: 'event_type', field: 'event_type' },
              { title: 'severity', field: 'severity' },
              { title: 'summary', field: 'summary' },
            ]}
            data={events}
          />
        )}
      </Content>
    </Page>
  );
};