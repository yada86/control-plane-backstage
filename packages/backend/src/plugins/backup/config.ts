import { Config } from '@backstage/config';
import { BackupConfig } from './types';

function mustGetString(cfg: Config, key: string): string {
  const v = cfg.getOptionalString(key);
  if (!v || !v.trim()) {
    throw new Error(`backup config missing required string: ${key}`);
  }
  return v;
}

export function readBackupConfig(config: Config): BackupConfig {
  const base = config.getConfig('backup');

  const vaultRoot = mustGetString(base, 'vaultRoot');
  const jobsDir = base.getOptionalString('jobsDir') ?? `${vaultRoot}/LOGS/jobs`;

  const mirrorDir =
    base.getOptionalString('logs.mirrorDir') ?? `${vaultRoot}/LOGS/MIRROR`;
  const wslDir = base.getOptionalString('logs.wslDir') ?? `${vaultRoot}/LOGS/WSL`;

  const fullDir =
    base.getOptionalString('snapshots.fullDir') ??
    `${vaultRoot}/SNAPSHOTS/WSL/FULL`;

  const scripts = base.getOptionalConfig('scripts');
  const pwshCommand = base.getOptionalString('pwshCommand') ?? 'pwsh.exe';

  const scheduledTasks = base.getOptionalStringArray('scheduledTasks') ?? [];

  return {
    vaultRoot,
    jobsDir,
    logs: { mirrorDir, wslDir },
    snapshots: { fullDir },
    scripts: {
      mirror: scripts?.getOptionalString('mirror') ?? 'hub_mirror.ps1',
      snapshot:
        scripts?.getOptionalString('snapshot') ?? 'hub_wsl_full_snapshot.ps1',
      retention:
        scripts?.getOptionalString('retention') ??
        'hub_wsl_full_retention.ps1',
      restoreTest:
        scripts?.getOptionalString('restoreTest') ?? 'hub_wsl_restore_test.ps1',
    },
    pwshCommand,
    scheduledTasks,
  };
}
