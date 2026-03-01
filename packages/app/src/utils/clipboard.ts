export type CopyResult =
  | { ok: true; method: 'execCommand' }
  | { ok: false; method: 'manual'; reason: string; error?: unknown };

function execCommandCopySync(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', 'true');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '0';
  ta.style.opacity = '0';
  ta.style.pointerEvents = 'none';

  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, ta.value.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  } finally {
    document.body.removeChild(ta);
  }
  return ok;
}

/**
 * Deterministic over http://IP:
 * - MUST be called directly inside click handler (no await before).
 * - Uses legacy sync copy; if blocked, caller must offer manual copy UI.
 */
export function copyTextRobustSync(text: string): CopyResult {
  try {
    const ok = execCommandCopySync(text);
    if (ok) return { ok: true, method: 'execCommand' };
  } catch (error) {
    // keep for debugging if needed
    // eslint-disable-next-line no-console
    console.debug('[copyTextRobustSync] execCommand failed', error);
    return { ok: false, method: 'manual', reason: 'execCommand threw', error };
  }
  return {
    ok: false,
    method: 'manual',
    reason: 'Clipboard blocked/denied in this context (likely http over IP), manual copy required.',
  };
}
