export declare function pathExists(p: string): Promise<boolean>;
export declare function listNewestFiles(dir: string, limit: number): Promise<Array<{
    name: string;
    fullPath: string;
    size: number;
    mtimeMs: number;
}>>;
export declare function readTail(filePath: string, maxBytes: number): Promise<string>;
