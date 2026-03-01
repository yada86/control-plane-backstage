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
export declare function evaluateRestorePolicy(args: EvaluateRestorePolicyArgs): {
    ok: boolean;
    violations: string[];
    policy: {
        hubRootAbs: string;
        allowHolyOverwrite: boolean;
        holyFiles: string[];
        maxFiles: number;
        maxBytesNew: number;
    };
};
export {};
