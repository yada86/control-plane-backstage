import React from 'react';
import {
  Page,
  Header,
  Content,
  ContentHeader,
  SupportButton,
  InfoCard,
  Progress,
  WarningPanel,
} from '@backstage/core-components';
import { discoveryApiRef, useApi } from '@backstage/core-plugin-api';
import { Button, Grid, Typography, Divider } from '@material-ui/core';

type BackupRunResult = {
  ok?: boolean;
  exitCode?: number;
  stderr?: string;
  logTail?: string;
  startedAt?: string;
  finishedAt?: string;
};

type FetchState<T> = {
  loading: boolean;
  refreshing?: boolean;
  error?: string;
  data?: T;
  fetchedAt?: string;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`);
  }
  return (await res.json()) as T;
}

async function postJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`);
  }
  return (await res.json()) as T;
}

function usePolling<T>(url: string, intervalMs: number) {
  const [state, setState] = React.useState<FetchState<T>>({ loading: true });

  const load = React.useCallback(async () => {
    setState(s => {
      const isFirst = !s.data && !s.error;
      return {
        ...s,
        loading: isFirst,
        refreshing: !isFirst,
        error: undefined,
      };
    });
    try {
      const data = await getJson<T>(url);
      setState(s => ({
        ...s,
        loading: false,
        refreshing: false,
        data,
        fetchedAt: new Date().toISOString(),
        error: undefined,
      }));
    } catch (e: any) {
      setState(s => ({
        ...s,
        loading: false,
        refreshing: false,
        error: e?.message ?? String(e),
        fetchedAt: new Date().toISOString(),
        data: s.data,
      }));
    }
  }, [url]);

  React.useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      await load();
    };
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [load, intervalMs]);

  return { ...state, reload: load };
}

function KeyVal({ k, v }: { k: string; v: any }) {
  const text =
    v === null || v === undefined
      ? '—'
      : typeof v === 'string'
      ? v
      : JSON.stringify(v);
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
      <Typography variant="body2" style={{ minWidth: 160, opacity: 0.8 }}>
        {k}
      </Typography>
      <Typography
        variant="body2"
        style={{ flex: 1, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
      >
        {text}
      </Typography>
    </div>
  );
}

function RunResultCard({
  title,
  result,
}: {
  title: string;
  result?: BackupRunResult;
}) {
  return (
    <InfoCard title={title}>
      {!result ? (
        <Typography variant="body2" style={{ opacity: 0.8 }}>
          No run yet.
        </Typography>
      ) : (
        <>
          <KeyVal k="ok" v={result.ok} />
          <KeyVal k="exitCode" v={result.exitCode} />
          <KeyVal k="stderr" v={result.stderr} />
          <Divider style={{ margin: '12px 0' }} />
          <Typography variant="body2" style={{ opacity: 0.8, marginBottom: 6 }}>
            logTail
          </Typography>
          <Typography
            variant="body2"
            style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
          >
            {result.logTail ?? '—'}
          </Typography>
        </>
      )}
    </InfoCard>
  );
}

export const BackupRecoveryPage = () => {
  const discoveryApi = useApi(discoveryApiRef);
  const fallbackBackendBaseUrl = React.useMemo(
    () => `http://${window.location.hostname}:7007`,
    [],
  );
  const [backendBaseUrl, setBackendBaseUrl] = React.useState(fallbackBackendBaseUrl);

  React.useEffect(() => {
    let active = true;
    const loadBaseUrl = async () => {
      try {
        const baseUrl = await discoveryApi.getBaseUrl('backend');
        if (active) {
          setBackendBaseUrl(baseUrl.replace(/\/$/, ''));
        }
      } catch {
        if (active) {
          setBackendBaseUrl(fallbackBackendBaseUrl);
        }
      }
    };
    loadBaseUrl();
    return () => {
      active = false;
    };
  }, [discoveryApi, fallbackBackendBaseUrl]);

  const backupApiBase = `${backendBaseUrl}/api/backup`;

  const status = usePolling<any>(`${backupApiBase}/status`, 20_000);
  const snapshots = usePolling<any>(`${backupApiBase}/snapshots`, 30_000);
  const mirrors = usePolling<any>(`${backupApiBase}/mirrors`, 30_000);

  const [running, setRunning] = React.useState<string | null>(null);
  const [lastRun, setLastRun] = React.useState<
    Record<string, BackupRunResult | undefined>
  >({});

  const run = React.useCallback(
    async (key: string, url: string) => {
      setRunning(key);
      try {
        const res = await postJson<BackupRunResult>(url);
        setLastRun(prev => ({ ...prev, [key]: res }));
      } catch (e: any) {
        setLastRun(prev => ({
          ...prev,
          [key]: {
            ok: false,
            exitCode: -1,
            stderr: e?.message ?? String(e),
            logTail: '',
          },
        }));
      } finally {
        setRunning(null);
        await Promise.allSettled([status.reload(), snapshots.reload(), mirrors.reload()]);
      }
    },
    [status, snapshots, mirrors],
  );

  const anyLoading = status.loading || snapshots.loading || mirrors.loading;

  return (
    <Page themeId="tool">
      <Header
        title="Backup & Recovery"
        subtitle="Thin UI over existing HUB_VAULT job scripts (SAFE v1)"
      >
        <SupportButton>
          Runs mirror/snapshot/retention/restore-test via backend router. No
          restore-live in v1.
        </SupportButton>
      </Header>

      <Content>
        <ContentHeader title="Live status">
          <Button
            variant="contained"
            color="primary"
            onClick={() =>
              Promise.allSettled([status.reload(), snapshots.reload(), mirrors.reload()])
            }
          >
            Refresh
          </Button>
        </ContentHeader>

        {(status.error || snapshots.error || mirrors.error) && (
          <WarningPanel title="Backend/API not reachable via UI proxy">
            <Typography variant="body2" style={{ marginBottom: 8 }}>
              This page calls <span style={{ fontFamily: 'monospace' }}>/api/backup/*</span> from the browser.
              If the dev-server proxy is misconfigured, you’ll see errors here.
            </Typography>
            {status.error && <KeyVal k="status error" v={status.error} />}
            {snapshots.error && <KeyVal k="snapshots error" v={snapshots.error} />}
            {mirrors.error && <KeyVal k="mirrors error" v={mirrors.error} />}
          </WarningPanel>
        )}

        {anyLoading && <Progress />}

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <InfoCard title="Vault health / status">
              <KeyVal k="fetchedAt" v={status.fetchedAt} />
              <Divider style={{ margin: '12px 0' }} />
              <Typography variant="body2" style={{ opacity: 0.8, marginBottom: 6 }}>
                payload
              </Typography>
              <Typography
                variant="body2"
                style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
              >
                {status.data ? JSON.stringify(status.data, null, 2) : '—'}
              </Typography>
            </InfoCard>
          </Grid>

          <Grid item xs={12} md={4}>
            <InfoCard title="Snapshots inventory">
              <KeyVal k="fetchedAt" v={snapshots.fetchedAt} />
              <Divider style={{ margin: '12px 0' }} />
              <Typography
                variant="body2"
                style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
              >
                {snapshots.data ? JSON.stringify(snapshots.data, null, 2) : '—'}
              </Typography>
            </InfoCard>
          </Grid>

          <Grid item xs={12} md={4}>
            <InfoCard title="Mirrors status">
              <KeyVal k="fetchedAt" v={mirrors.fetchedAt} />
              <Divider style={{ margin: '12px 0' }} />
              <Typography
                variant="body2"
                style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
              >
                {mirrors.data ? JSON.stringify(mirrors.data, null, 2) : '—'}
              </Typography>
            </InfoCard>
          </Grid>

          <Grid item xs={12}>
            <InfoCard title="SAFE actions (v1)">
              <Typography variant="body2" style={{ marginBottom: 12 }}>
                v1 is intentionally conservative: mirror/snapshot/retention + restore-test only.
                <b> Restore-live is NOT implemented.</b>
              </Typography>

              <Grid container spacing={2}>
                <Grid item>
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={!!running}
                    onClick={() => run('mirror', `${backupApiBase}/run-mirror`)}
                  >
                    {running === 'mirror' ? 'Running…' : 'Mirror now'}
                  </Button>
                </Grid>

                <Grid item>
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={!!running}
                    onClick={() => run('snapshot', `${backupApiBase}/run-snapshot`)}
                  >
                    {running === 'snapshot' ? 'Running…' : 'Snapshot now'}
                  </Button>
                </Grid>

                <Grid item>
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={!!running}
                    onClick={() => run('retention', `${backupApiBase}/run-retention`)}
                  >
                    {running === 'retention' ? 'Running…' : 'Retention now'}
                  </Button>
                </Grid>

                <Grid item>
                  <Button
                    variant="contained"
                    color="secondary"
                    disabled={!!running}
                    onClick={() =>
                      run('restoreTest', `${backupApiBase}/run-restore-test`)
                    }
                  >
                    {running === 'restoreTest' ? 'Running…' : 'Restore-test now'}
                  </Button>
                </Grid>
              </Grid>
            </InfoCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <RunResultCard title="Last run: Mirror" result={lastRun.mirror} />
          </Grid>

          <Grid item xs={12} md={6}>
            <RunResultCard title="Last run: Snapshot" result={lastRun.snapshot} />
          </Grid>

          <Grid item xs={12} md={6}>
            <RunResultCard title="Last run: Retention" result={lastRun.retention} />
          </Grid>

          <Grid item xs={12} md={6}>
            <RunResultCard title="Last run: Restore-test" result={lastRun.restoreTest} />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
