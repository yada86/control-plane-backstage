# fs_push_session_wrap.sh — hardening notes (BASE + --show)

## BASE is forced (7007)
- Script forces BASE to http://127.0.0.1:7007 to avoid stale env leaks (e.g. 7008).
- Any environment variable BASE is ignored.

## SSOT write order is protected
- Append to runtime.jsonl happens first.
- runtime.latest.json rebuild happens immediately after append.
- Any optional network activity happens after SSOT writes.

## --show is non-fatal
- --show performs a curl preview as a convenience.
- curl failure prints WARN and does not abort the wrap push.
- Network failures never affect RuntimeTruth state.

## Optional hygiene: warn if BASE env is set
- Suggested behavior: if BASE is set in the shell, print:
  [WARN] BASE env ignored (forced to 7007)
