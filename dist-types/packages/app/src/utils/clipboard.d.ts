export type CopyResult = {
    ok: true;
    method: 'execCommand';
} | {
    ok: false;
    method: 'manual';
    reason: string;
    error?: unknown;
};
/**
 * Deterministic over http://IP:
 * - MUST be called directly inside click handler (no await before).
 * - Uses legacy sync copy; if blocked, caller must offer manual copy UI.
 */
export declare function copyTextRobustSync(text: string): CopyResult;
