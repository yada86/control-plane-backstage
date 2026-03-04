# Jarvis — Entrypoints

## Canonical WSL entrypoints (do not confuse with Windows wrapper)

**Truth (measured):** On WSL, Jarvis is invoked via installed `console_scripts` entrypoints (not by running `jarvis_cli.py` directly).

### Entry points (WSL)
- `jarvis-query`
- `jarvis-agent-pack`

These resolve to the current venv binaries:
- `jarvis-query` → `/home/danie/ai_envs/jarvis_wsl_312/bin/jarvis-query`
- `jarvis-agent-pack` → `/home/danie/ai_envs/jarvis_wsl_312/bin/jarvis-agent-pack`

And each entrypoint maps to the module `main()` function via `pyproject.toml`:

```toml
[project.scripts]
jarvis-query = "jarvis_local.query_v2:main"
jarvis-agent-pack = "jarvis_local.agent_pack:main"
```

## 🔒 Canonical Entry Points — WSL vs Windows Wrapper (LOCKED)

**Status: Normativ. Ikke tolk. Ikke avvik.**

### 1️⃣ WSL — Canonical CLI Entry Points (Authoritative)

Følgende er de eneste gyldige entrypoints inne i WSL:

- `jarvis-query`
- `jarvis-agent-pack`

Disse er:

- Native WSL-kommandoer
- Dokumentert i runbook
- Brukt i alle smoke-tester
- Forventet å finnes i WSL PATH

Ingen annen `jarvis` binær i PATH er forventet eller nødvendig.

Hvis en `jarvis` binær dukker opp i WSL PATH → behandle som avvik til det er eksplisitt dokumentert.

---

### 2️⃣ Windows Wrapper — Navn og Rolle (Non-Authoritative Runtime Layer)

Windows-wrapperen:

- Er kun et kall videre til WSL
- Er ikke en egen runtime
- Skal ikke redefinere defaults
- Skal ikke inneholde logikk som divergerer fra WSL CLI

Den **injiserer model-environment deterministisk**, eksempel:

- `FS_JARVIS_MODEL=qwen2.5:7b-instruct`

Dette er en transportmekanisme — ikke en alternativ konfigurasjonskilde.

All kanonisk dokumentasjon refererer til **WSL entrypoints**, ikke wrapper.

---

### 3️⃣ Rule — Debugging og Smoke

Ved feil:

1. Test alltid i WSL først (`jarvis-query`, `jarvis-agent-pack`)
2. Verifiser at smoke passerer
3. Deretter test Windows wrapper

Aldri feilsøk wrapper før WSL CLI er grønn.

---

### 4️⃣ Governance Law

- WSL CLI = Source of Truth
- Windows wrapper = Convenience layer
- Runbook refererer alltid til WSL entrypoints
- Nye entrypoints må dokumenteres før bruk (DOC LAW)
