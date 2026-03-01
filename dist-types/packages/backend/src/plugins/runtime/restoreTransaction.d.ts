export type RestoreWriteOp = {
    absPath: string;
    bytes: Buffer;
    mode?: number;
};
export type RestoreTxnResult = {
    txnId: string;
    baseDir: string;
    lockPath: string;
    stageDir: string;
    backupDir: string;
    manifestPath: string;
    committed: boolean;
    rolledBack: boolean;
    fileCount: number;
};
export declare function withRestoreTransaction(ops: RestoreWriteOp[], fnNameForAudit: string, baseDirOverride?: string): Promise<RestoreTxnResult>;
