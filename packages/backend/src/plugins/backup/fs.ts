import fs from 'fs/promises';
import path from 'path';

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function listNewestFiles(
  dir: string,
  limit: number,
): Promise<Array<{ name: string; fullPath: string; size: number; mtimeMs: number }>> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const fp = path.join(dir, e.name);
    const st = await fs.stat(fp);
    files.push({ name: e.name, fullPath: fp, size: st.size, mtimeMs: st.mtimeMs });
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files.slice(0, limit);
}

export async function readTail(filePath: string, maxBytes: number): Promise<string> {
  const st = await fs.stat(filePath);
  const start = Math.max(0, st.size - maxBytes);
  const fh = await fs.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(st.size - start);
    await fh.read(buf, 0, buf.length, start);
    return buf.toString('utf8');
  } finally {
    await fh.close();
  }
}
