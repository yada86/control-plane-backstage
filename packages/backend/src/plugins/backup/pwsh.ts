import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function toWindowsPathIfNeeded(p: string): Promise<string> {
  // Convert WSL mount paths (/mnt/f/...) to Windows paths (F:\...)
  if (!p.startsWith('/mnt/')) return p;

  const { stdout, stderr } = await execFileAsync('wslpath', ['-w', p], {
    maxBuffer: 1024 * 1024,
  });

  const out = (stdout ?? '').toString().trim();
  if (!out) {
    throw new Error(
      `wslpath -w produced empty output for: ${p}. stderr=${(stderr ?? '')
        .toString()
        .trim()}`
    );
  }

  return out;
}

export async function runPwshJson(
  pwshCommand: string,
  command: string,
): Promise<any> {
  const args = ['-NoProfile', '-NonInteractive', '-Command', command];
  const { stdout, stderr } = await execFileAsync(pwshCommand, args, {
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (stderr && stderr.trim()) {
    if (!stdout || !stdout.trim()) {
      throw new Error(`pwsh stderr: ${stderr.trim()}`);
    }
  }
  const text = stdout.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`failed to parse pwsh JSON. stdout=${text.slice(0, 500)}`);
  }
}

export async function runPwshFile(
  pwshCommand: string,
  scriptPath: string,
): Promise<{
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  errorMessage?: string | null;
}> {
  return new Promise((resolve) => {
    (async () => {
      let filePath = scriptPath;

      try {
        filePath = await toWindowsPathIfNeeded(scriptPath);
      } catch (e: any) {
        resolve({
          exitCode: 999,
          signal: null,
          stdout: '',
          stderr: `Path conversion failed: ${String(e?.message ?? e)}`,
        });
        return;
      }

      const args = [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        filePath,
      ];

      let execCommand = pwshCommand;
      let execArgs = args;

      if (process.platform === 'linux') {
        let pwshForCmd = pwshCommand;
        if (pwshForCmd.startsWith('/mnt/')) {
          try {
            pwshForCmd = await toWindowsPathIfNeeded(pwshForCmd);
          } catch (e: any) {
            resolve({
              exitCode: 999,
              signal: null,
              stdout: '',
              stderr: `pwsh command path conversion failed: ${String(e?.message ?? e)}`,
              errorMessage: String(e?.message ?? e),
            });
            return;
          }
        }

        const quoteForCmd = (value: string) => `"${value.replace(/"/g, '""')}"`;
        const commandLine = [quoteForCmd(pwshForCmd), ...args.map(quoteForCmd)].join(' ');
        execCommand = 'cmd.exe';
        execArgs = ['/c', commandLine];
      }

      const child = execFile(
        execCommand,
        execArgs,
        { windowsHide: true, maxBuffer: 50 * 1024 * 1024 },
        (error, stdout, stderr) => {
          const anyErr = error as any;
          const exitCode = error
            ? typeof anyErr?.code === 'number'
              ? anyErr.code
              : 1
            : 0;

          resolve({
            exitCode,
            signal: anyErr?.signal ?? null,
            stdout: stdout ?? '',
            stderr: stderr ?? '',
            errorMessage: anyErr?.message ?? null,
          });
        }
      );

      child.on('error', (e) => {
        resolve({
          exitCode: 999,
          signal: null,
          stdout: '',
          stderr: String(e),
        });
      });
    })().catch((e) => {
      resolve({
        exitCode: 999,
        signal: null,
        stdout: '',
        stderr: `Unexpected error: ${String(e)}`,
      });
    });
  });
}
