# VSCAI Header (Canonical)

<!-- VSCAI_HEADER_START -->

Follow HUB_v4_CANONICAL.md laws, structure, and SAFE MODE strictly.

Step 0 — BACKUP HUB (PowerShell):
- Run the HUB backup command.
- Paste the produced backup path into the chat as proof before applying any edit.

You may only perform the explicitly requested change.
Do not refactor, reinterpret, or modify any locked sections.
Verify before and after state and confirm completion.

LAW — DOC OR IT DOESN’T EXIST
- DOCS = ARKITEKTUR (NON-NEGOTIABLE)
- Når vi gjør endringer i systemet må vi:
	1) finne riktig docs-seksjon
	2) legge inn endringen der
	3) oppdatere Runbook Index
	4) verifisere søkbarhet (TechDocs search + grep)
- Ikke bare “legge noe i en fil”.
- Dette MÅ holdes for en deterministisk dokumentert plattform.
- Docs behandles som arkitektur, ikke bare tekst.

- Any newly discovered or decided paths, commands, defaults, env vars, ports, policies, or integration rules MUST be written to docs BEFORE proceeding.
- The documentation must be reachable from Runbook Index.
- If it is not in docs + indexed, it is treated as NON-EXISTENT (hidden state violation).

DISCOVERABILITY REQUIREMENT
- Every canonical path/command must be searchable via:
	docs/hub/content/runbook/00__RUNBOOK_INDEX.md
- Add/update index entry whenever documentation is added.

Rules:
• No VSCAI task may run without this header
• Any output violating HUB laws is invalid
• Precision beats creativity
• Governance beats convenience

<!-- VSCAI_HEADER_END -->
