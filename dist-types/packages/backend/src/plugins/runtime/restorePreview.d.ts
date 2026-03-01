import { RestoreWriteOp } from './restoreTransaction';
type RestorePreviewFile = {
    absPath: string;
    existed: boolean;
    bytes_new: number;
    sha256_new: string;
    bytes_old?: number;
    sha256_old?: string;
    action: 'CREATE' | 'OVERWRITE';
};
type RestorePreview = {
    files: RestorePreviewFile[];
    totals: {
        files: number;
        creates: number;
        overwrites: number;
        bytes_new: number;
    };
};
export declare function buildRestorePreview(ops: RestoreWriteOp[]): RestorePreview;
export {};
