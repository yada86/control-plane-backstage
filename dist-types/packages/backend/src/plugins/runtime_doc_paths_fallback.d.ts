/**
 * Scan runtime.jsonl backwards to find newest event whose payload schema matches "DOC_PATHS".
 * We accept payload nested at: ev.payload OR ev.data OR ev.event.payload (contract-safe).
 */
export declare function findNewestDocPathsPayloadFromJsonl(jsonlPath: string): Promise<any | null>;
