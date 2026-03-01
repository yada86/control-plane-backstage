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
export declare const readRuntimeJsonl: (jsonlPath: string) => RuntimeJsonEvent[];
export declare const validateRestorePack: (pack: unknown) => RestorePackV1;
export declare const findRestorePackByCheckpointId: (jsonlPath: string, checkpointId: string) => RestorePackV1 | null;
export declare const buildRestorePlan: (hubRootAbs: string, pack: RestorePackV1) => RestorePlanItem[];
export declare const applyRestoreTransactional: (hubRootAbs: string, pack: RestorePackV1) => Promise<{
    restored: number;
    backups: number;
    files: ApplyResultItem[];
    txnId: string;
    committed: boolean;
    rolledBack: boolean;
    fileCount: number;
    manifestPath: string;
}>;
export {};
