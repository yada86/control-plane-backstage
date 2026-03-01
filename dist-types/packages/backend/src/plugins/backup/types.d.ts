export type BackupConfig = {
    vaultRoot: string;
    jobsDir: string;
    logs: {
        mirrorDir: string;
        wslDir: string;
    };
    snapshots: {
        fullDir: string;
    };
    scripts: {
        mirror: string;
        snapshot: string;
        retention: string;
        restoreTest: string;
    };
    pwshCommand: string;
    scheduledTasks: string[];
};
export type JobRunResult = {
    ok: boolean;
    exitCode: number | null;
    signal: string | null;
    stdout: string;
    stderr: string;
    logTail?: string;
    startedAt: string;
    finishedAt: string;
};
