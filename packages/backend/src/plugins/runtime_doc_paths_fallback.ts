import fs from 'node:fs/promises';

/**
 * Scan runtime.jsonl backwards to find newest event whose payload schema matches "DOC_PATHS".
 * We accept payload nested at: ev.payload OR ev.data OR ev.event.payload (contract-safe).
 */
export async function findNewestDocPathsPayloadFromJsonl(
  jsonlPath: string,
): Promise<any | null> {
  const raw = await fs.readFile(jsonlPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    let ev: any;
    try {
      ev = JSON.parse(line);
    } catch {
      throw new Error('runtime.jsonl contains invalid JSON line');
    }

    const payload =
      ev?.payload ??
      ev?.data ??
      ev?.event?.payload ??
      ev?.facts?.payload ??
      null;
    if (!payload) continue;

    const schema = payload?.schema ?? null;
    if (schema === 'DOC_PATHS') {
      return payload;
    }
  }

  return null;
}
