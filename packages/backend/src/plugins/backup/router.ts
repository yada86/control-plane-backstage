import express from 'express';
import Router from 'express-promise-router';
import path from 'path';

import { LoggerService } from '@backstage/backend-plugin-api';
import { BackupConfig, JobRunResult } from './types';
import { pathExists, listNewestFiles, readTail } from './fs';
import { runPwshFile, runPwshJson } from './pwsh';

function isoNow() {
  return new Date().toISOString();
}

async function getVaultDf(vaultRoot: string): Promise<any> {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);
  try {
    const { stdout } = await execFileAsync('df', ['-B1', vaultRoot], {
      maxBuffer: 2 * 1024 * 1024,
    });
    const lines = stdout.trim().split('\n');
    if (lines.length < 2) return null;
    const parts = lines[1].split(/\s+/);
    return {
      filesystem: parts[0] ?? null,
      totalBytes: parts[1] ? Number(parts[1]) : null,
      usedBytes: parts[2] ? Number(parts[2]) : null,
      freeBytes: parts[3] ? Number(parts[3]) : null,
      usedPct: parts[4] ?? null,
      mountedOn: parts[5] ?? null,
    };
  } catch {
    return null;
  }
}

async function getScheduledTasks(
  pwshCommand: string,
  taskNames: string[],
): Promise<any[]> {
  if (!taskNames.length) return [];
  const safeList = taskNames.map(n => n.replace(/"/g, ''));
  const ps = `
$ErrorActionPreference='Stop'
$names = @(${safeList.map(n => `"${n}"`).join(',')})
$out = @()
foreach ($n in $names) {
  $t = Get-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue
  if (-not $t) {
    $out += [pscustomobject]@{ name=$n; exists=$false }
    continue
  }
  $i = Get-ScheduledTaskInfo -TaskName $n
  $out += [pscustomobject]@{
    name=$n
    exists=$true
    state = $t.State.ToString()
    lastRunTime = $i.LastRunTime
    lastTaskResult = $i.LastTaskResult
    nextRunTime = $i.NextRunTime
  }
}
$out | ConvertTo-Json -Depth 6
`.trim();

  try {
    const json = await runPwshJson(pwshCommand, ps);
    if (!json) return [];
    return Array.isArray(json) ? json : [json];
  } catch (e: any) {
    return [
      {
        name: 'SCHEDULED_TASKS',
        exists: false,
        error: String(e?.message ?? e),
        note: 'If backend runs in WSL, ensure interop can call pwsh.exe and tasks are visible from that context.',
      },
    ];
  }
}

export async function createBackupRouter(opts: {
  logger: LoggerService;
  config: BackupConfig;
}): Promise<express.Router> {
  const { logger, config } = opts;
  const router = Router();

  router.get('/status', async (_req, res) => {
    const vaultExists = await pathExists(config.vaultRoot);
    const jobsExists = await pathExists(config.jobsDir);
    const mirrorLogDirExists = await pathExists(config.logs.mirrorDir);
    const wslLogDirExists = await pathExists(config.logs.wslDir);
    const fullSnapshotsDirExists = await pathExists(config.snapshots.fullDir);

    const df = vaultExists ? await getVaultDf(config.vaultRoot) : null;

    const tasks = await getScheduledTasks(config.pwshCommand, config.scheduledTasks);

    res.json({
      ok: true,
      time: isoNow(),
      config: {
        vaultRoot: config.vaultRoot,
        jobsDir: config.jobsDir,
        logs: config.logs,
        snapshots: config.snapshots,
        pwshCommand: config.pwshCommand,
        scheduledTasks: config.scheduledTasks,
      },
      exists: {
        vaultRoot: vaultExists,
        jobsDir: jobsExists,
        mirrorLogDir: mirrorLogDirExists,
        wslLogDir: wslLogDirExists,
        fullSnapshotsDir: fullSnapshotsDirExists,
      },
      vault: {
        df,
      },
      scheduledTasks: tasks,
    });
  });

  router.get('/snapshots', async (_req, res) => {
    const dirOk = await pathExists(config.snapshots.fullDir);
    if (!dirOk) {
      res.status(500).json({
        ok: false,
        error: `snapshots.fullDir not found: ${config.snapshots.fullDir}`,
      });
      return;
    }
    const files = await listNewestFiles(config.snapshots.fullDir, 25);
    res.json({
      ok: true,
      time: isoNow(),
      fullDir: config.snapshots.fullDir,
      snapshots: files.map(f => ({
        name: f.name,
        path: f.fullPath,
        size: f.size,
        mtimeMs: f.mtimeMs,
        mtimeIso: new Date(f.mtimeMs).toISOString(),
      })),
    });
  });

  router.get('/mirrors', async (_req, res) => {
    const out: any = { ok: true, time: isoNow(), logs: {} };

    const mirrorOk = await pathExists(config.logs.mirrorDir);
    if (mirrorOk) {
      const latest = await listNewestFiles(config.logs.mirrorDir, 1);
      if (latest[0]) {
        out.logs.mirror = {
          latest: latest[0].name,
          mtimeIso: new Date(latest[0].mtimeMs).toISOString(),
          size: latest[0].size,
          tail: await readTail(latest[0].fullPath, 32 * 1024),
        };
      }
    } else {
      out.logs.mirror = {
        error: `mirror log dir not found: ${config.logs.mirrorDir}`,
      };
    }

    const wslOk = await pathExists(config.logs.wslDir);
    if (wslOk) {
      const latest = await listNewestFiles(config.logs.wslDir, 1);
      if (latest[0]) {
        out.logs.wsl = {
          latest: latest[0].name,
          mtimeIso: new Date(latest[0].mtimeMs).toISOString(),
          size: latest[0].size,
          tail: await readTail(latest[0].fullPath, 32 * 1024),
        };
      }
    } else {
      out.logs.wsl = { error: `wsl log dir not found: ${config.logs.wslDir}` };
    }

    res.json(out);
  });

  async function runJob(
    scriptFileName: string,
    logDirHint?: string,
  ): Promise<JobRunResult> {
    const startedAt = isoNow();
    const scriptPath = path.join(config.jobsDir, scriptFileName);

    const jobsDirOk = await pathExists(config.jobsDir);
    if (!jobsDirOk) {
      return {
        ok: false,
        exitCode: 500,
        signal: null,
        stdout: '',
        stderr: `jobsDir not found: ${config.jobsDir}`,
        startedAt,
        finishedAt: isoNow(),
      };
    }

    const scriptOk = await pathExists(scriptPath);
    if (!scriptOk) {
      return {
        ok: false,
        exitCode: 404,
        signal: null,
        stdout: '',
        stderr: `script not found: ${scriptPath}`,
        startedAt,
        finishedAt: isoNow(),
      };
    }

    logger.info(`backup: running script ${scriptPath}`);
    const r = await runPwshFile(config.pwshCommand, scriptPath);
    const finishedAt = isoNow();

    let logTail: string | undefined = undefined;
    if (logDirHint) {
      const logDirOk = await pathExists(logDirHint);
      if (logDirOk) {
        const latest = await listNewestFiles(logDirHint, 1);
        if (latest[0]) {
          logTail = await readTail(latest[0].fullPath, 48 * 1024);
        }
      }
    }

    return {
      ok: r.exitCode === 0,
      exitCode: r.exitCode,
      signal: r.signal,
      stdout: r.stdout,
      stderr: r.stderr,
      logTail,
      startedAt,
      finishedAt,
    };
  }

  router.post('/run-mirror', async (_req, res) => {
    const result = await runJob(config.scripts.mirror, config.logs.mirrorDir);
    const mirrorOk =
      result.ok ||
      (typeof result.exitCode === 'number' && result.exitCode >= 0 && result.exitCode < 8);
    const payload = mirrorOk === result.ok ? result : { ...result, ok: mirrorOk };
    res.status(payload.ok ? 200 : 500).json(payload);
  });

  router.post('/run-snapshot', async (_req, res) => {
    const result = await runJob(config.scripts.snapshot, config.logs.wslDir);
    const snapshotOk =
      typeof result.exitCode === 'number' && result.exitCode >= 0 && result.exitCode <= 1;
    const payload = snapshotOk === result.ok ? result : { ...result, ok: snapshotOk };
    res.status(payload.ok ? 200 : 500).json(payload);
  });

  router.post('/run-retention', async (_req, res) => {
    const result = await runJob(config.scripts.retention, config.logs.wslDir);
    res.status(result.ok ? 200 : 500).json(result);
  });

  router.post('/run-restore-test', async (_req, res) => {
    const scriptPath = path.join(config.jobsDir, config.scripts.restoreTest);
    const ok = await pathExists(scriptPath);
    if (!ok) {
      res.status(501).json({
        ok: false,
        error: `restore-test script not found: ${scriptPath}`,
        note: 'Add script or set backup.scripts.restoreTest in app-config.yaml',
      });
      return;
    }
    const result = await runJob(config.scripts.restoreTest, config.logs.wslDir);
    res.status(result.ok ? 200 : 500).json(result);
  });

  router.use((err: any, _req: any, res: any, _next: any) => {
    logger.error(`backup router error: ${String(err?.stack ?? err)}`);
    res.status(500).json({ ok: false, error: String(err?.message ?? err) });
  });

  return router;
}
