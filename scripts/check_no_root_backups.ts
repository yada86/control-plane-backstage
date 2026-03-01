// @ts-nocheck
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const args = process.argv.slice(2);
const fix = args.includes('--fix');

const getArgValue = (name: string) => {
  const index = args.findIndex(arg => arg === name);
  if (index >= 0 && index + 1 < args.length) {
    return args[index + 1];
  }
  const withEquals = args.find(arg => arg.startsWith(`${name}=`));
  if (withEquals) {
    return withEquals.slice(name.length + 1);
  }
  return undefined;
};

const extractHubRootFromConfig = (yamlText: string): string | undefined => {
  const lines = yamlText.split(/\r?\n/);
  let inHubDocs = false;
  let hubIndent = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = line.match(/^\s*/)?.[0].length ?? 0;

    if (!inHubDocs) {
      if (/^hubDocs:\s*$/.test(trimmed)) {
        inHubDocs = true;
        hubIndent = indent;
      }
      continue;
    }

    if (indent <= hubIndent) {
      inHubDocs = false;
      if (/^hubDocs:\s*$/.test(trimmed)) {
        inHubDocs = true;
        hubIndent = indent;
      }
      continue;
    }

    if (/^rootPath:\s*/.test(trimmed)) {
      const raw = trimmed.replace(/^rootPath:\s*/, '').trim();
      return raw.replace(/^['\"]/, '').replace(/['\"]$/, '').replace(/\r/g, '');
    }
  }

  return undefined;
};

const resolveHubRoot = async () => {
  const fromArg = getArgValue('--hub-root');
  if (fromArg) return fromArg;
  if (process.env.HUB_ROOT?.trim()) return process.env.HUB_ROOT.trim();

  const configFiles = ['app-config.local.yaml', 'app-config.yaml'];
  for (const configName of configFiles) {
    const abs = path.join(cwd, configName);
    if (!fsSync.existsSync(abs)) continue;
    const text = await fs.readFile(abs, 'utf8');
    const parsed = extractHubRootFromConfig(text);
    if (parsed) return parsed;
  }

  throw new Error(
    'Cannot resolve HUB root. Provide --hub-root <absPath> or set HUB_ROOT env.',
  );
};

const listRootBackups = async (hubRoot: string) => {
  const entries = await fs.readdir(hubRoot, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && entry.name.includes('.bak_'))
    .map(entry => path.join(hubRoot, entry.name));
};

async function main() {
  const hubRoot = await resolveHubRoot();
  const absHubRoot = path.resolve(hubRoot.replace(/\r/g, '').trim());
  if (!fsSync.existsSync(absHubRoot)) {
    throw new Error(`HUB root does not exist: ${absHubRoot}`);
  }
  const backups = await listRootBackups(absHubRoot);

  if (backups.length === 0) {
    console.log(`OK: no root backups in ${absHubRoot}`);
    return;
  }

  if (!fix) {
    console.error(`ERROR: found ${backups.length} backup file(s) in HUB root:`);
    for (const file of backups) {
      console.error(` - ${file}`);
    }
    console.error('Run with --fix to move them into HUB/_BACKUPS');
    process.exit(1);
    return;
  }

  const moveDir = path.join(absHubRoot, '_BACKUPS', '_ROOT_GUARD_MOVED');
  fsSync.mkdirSync(moveDir, { recursive: true });

  for (const src of backups) {
    const dst = path.join(moveDir, path.basename(src));
    await fs.rename(src, dst);
  }

  console.log(`FIXED: moved ${backups.length} file(s) to ${moveDir}`);
}

main().catch(error => {
  console.error(`ERROR: ${(error as Error).message}`);
  process.exit(1);
});
