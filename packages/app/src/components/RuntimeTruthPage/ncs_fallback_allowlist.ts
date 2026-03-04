/**
 * NCS_FRONTEND_FALLBACK_V1
 * - Deterministic allowlist for Tier 0/1 runbook links when backend is down.
 * - Duplicated from backend runtime.ts (FS_RUNBOOK_TIER01_ALLOWLIST) by design.
 * - NO network calls, NO caching, NO heuristics beyond stable token scoring.
 */

export type NcsRunbookAllowlistEntry = {
  key: string;
  path: string;
  title: string;
  keywords?: string[];
};

/**
 * IMPORTANT:
 * Copy these entries 1:1 from packages/backend/src/plugins/runtime.ts (FS_RUNBOOK_TIER01_ALLOWLIST).
 * Keep ordering stable; do not "improve" it unless explicitly ordered.
 */
export const FS_RUNBOOK_TIER01_ALLOWLIST: NcsRunbookAllowlistEntry[] = [
  {
    key: 'baseline_v1_verifier',
    title: 'Baseline v1 verifier',
    path: '../docs/hub/content/runbook/baseline_v1_verifier/',
    keywords: ['baseline', 'verifier', 'green', 'audit', 'healthcheck', 'hub-docs'],
  },
  {
    key: 'new_chat_start_generator_contract',
    title: 'New Chat Start generator contract',
    path: '../docs/hub/content/docs/runtime/new-chat-start-generator/',
    keywords: ['new-chat-start', 'wrap', 'ssot', 'runtime', 'generator', 'debug', 'wrapkey'],
  },
  {
    key: 'runtime_truth_schema',
    title: 'Runtime Truth schema',
    path: '../runtime-truth.md',
    keywords: ['runtime', 'jsonl', 'facts', 'schema', 'event', 'checkpoint', 'wrap'],
  },
  {
    key: 'techdocs_flow_troubleshooting',
    title: 'TechDocs flow + publish troubleshooting',
    path: '../docs/hub/content/runbook/techdocs_flow_troubleshooting/',
    keywords: ['techdocs', 'mkdocs', 'publish', 'publisher', 'publishdirectory', 'docs', 'hub-docs'],
  },
  {
    key: 'backend_port_guard',
    title: 'Backend port / EADDRINUSE guard',
    path: '../docs/hub/content/runbook/backend_port_guard/',
    keywords: ['eaddrinuse', 'port', '7007', 'backend', 'launcher', 'guard'],
  },
  {
    key: 'graphviz_snapshot_renderer',
    title: 'Graphviz snapshot renderer',
    path: '../docs/hub/content/runbook/graphviz_renderer/',
    keywords: ['graphviz', 'snapshot', 'dot', 'renderer', 'png', 'observability'],
  },
  {
    key: 'safe_mode_measure_patch_verify',
    title: 'SAFE MODE (measure → patch → verify)',
    path: '../HUB_RULEBOOK.md',
    keywords: ['safe', 'measure', 'patch', 'verify', 'governance', 'laws'],
  },
  {
    key: 'runbook_index',
    title: 'Runbook Index',
    path: '../docs/hub/content/runbook/00__RUNBOOK_INDEX.md',
    keywords: ['runbook', 'index', 'triage', 'recovery', 'patterns'],
  },
];

export function fsTokenizeTrack(input: string): string[] {
  const s = (input || '').toLowerCase();
  const raw = s
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/g)
    .filter(Boolean);
  return raw.slice(0, 24);
}

export function fsScoreEntry(tokens: string[], e: NcsRunbookAllowlistEntry): number {
  if (!tokens.length) return 0;
  const hay = [e.key, e.title, e.path, ...(e.keywords ?? [])].join(' ').toLowerCase();

  let score = 0;
  for (const token of tokens) {
    if (token.length < 2) continue;
    if (hay.includes(token)) score += 1;
  }
  return score;
}

export function fsPickRelevantRunbooksFrontend(
  activeTrack: string,
  max: number,
): NcsRunbookAllowlistEntry[] {
  const tokens = fsTokenizeTrack(activeTrack);
  const scored = FS_RUNBOOK_TIER01_ALLOWLIST.map(e => ({
    e,
    s: fsScoreEntry(tokens, e),
  }));

  scored.sort((a, b) => {
    if (b.s !== a.s) return b.s - a.s;
    const t = a.e.title.localeCompare(b.e.title);
    if (t !== 0) return t;
    return a.e.path.localeCompare(b.e.path);
  });

  return scored
    .filter(x => x.s >= 1)
    .slice(0, Math.max(0, max))
    .map(x => x.e);
}
