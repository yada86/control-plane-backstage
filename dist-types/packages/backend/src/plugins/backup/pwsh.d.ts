export declare function runPwshJson(pwshCommand: string, command: string): Promise<any>;
export declare function runPwshFile(pwshCommand: string, scriptPath: string): Promise<{
    exitCode: number | null;
    signal: string | null;
    stdout: string;
    stderr: string;
    errorMessage?: string | null;
}>;
