# 17) CURRENT STATE + NEXT ACTION (LIVE)

## Legacy content (imported from monolithic HUB_v4_CANONICAL)
17) CURRENT STATE + NEXT ACTION (LIVE)
====================================================================

CHECKPOINT — Runtime Capacity Baseline (Hardware) LOCKED (2026-02-19)
STATUS: LOCKED — VERIFIED (SAFE MODE)

PROOF:
- Hardware scan report: C:\Users\danie\OneDrive\PROSJEKT SYNK\BLENDER\_LOGS\hardware_scan_2026-02-19_15-56-58.txt
- Report SHA256: B04977F3B229F2B2918BED04FE1A6EC2A9F6DB36C186AAC8538B31F4191BABE5
- HUB SHA256 (post-insert proof): 7A60800058AE4D72C5BC742707846E464172A53DD9ADB5BD117DE06E27A484A3

CAPACITY SUMMARY (CANONICAL):
- OS: Windows 11 Pro (Build 26200)
- CPU: i7-9700K (8C/8T)
- RAM: 32 GB
- GPU: RTX 4060 (VRAM ≈ 8 GB)

Defined per work thread.

CHECKPOINT — Dev Pipeline v4 GREEN (2026-02-18)
Status: STABLE (runtime verified + reproducible + logs + rollback)

Verified:
- External safety header active: live_header.py executed before payload on F9
- Payload-only workflow: live_payload.py is the only file edited (Ctrl+A → Ctrl+V ok)
- Robust Start-Process logging: stdout -> blender_YYYY-MM-DD_HH-MM-SS.out.log, stderr -> blender_YYYY-MM-DD_HH-MM-SS.err.log
- FS_LOG_ROOT = C:\Users\danie\OneDrive\PROSJEKT SYNK\BLENDER\_LOGS
- Auto-open: VS Code opens live_payload.py and latest out/err logs on launch
- Log follower: follows latest out + err logs; default spam filter active (anim.driver suppressed); opt-out via FS_LOG_NOFILTER=1
- No console chaos: dev loop usable; F9 output visible in logs

Paths (canonical):
- FS_SUPER_ROOT = C:\Users\danie\OneDrive\PROSJEKT SYNK\BLENDER
- DEV scripts  = FS_SUPER_ROOT\DEV_TOOLS\blender_dev\scripts\
	- live_header.py
	- live_payload.py

Files changed (record if already tracked elsewhere; otherwise note briefly):
- launch_blender.ps1
- open_live_and_log.ps1
- follow_latest_log.ps1
- fs_dev_runner (patched to exec header + payload flow)

CHECKPOINT — Graphviz Observability v1 — Live/Dead Overlay Bulletproof (OVR idempotent + fillcolor preserved)
DATE/TIME: 2026-02-18 (Europe/Oslo)

WHAT WAS FIXED (FACTS, MEASURED):
- OVR stacking eliminated (no graph_OVR_OVR.dot generated anymore)
- Confirmed by PowerShell “PES TEST: OVR STACKING (NO AUTO-CLOSE)”
	- snapshots: STACKED = 0
	- renders:   STACKED = 0
- Prior stacked file was legacy artifact; timestamp proof showed it was not being regenerated after patch
- Fillcolor preservation confirmed (overlay does not clobber existing node fill colors; visual verification in rendered output)

FILES / AREA (NO GUESSES):
- Changes applied inside: fs_gn_graphviz_observability\dot_post\

CHECKPOINT — Graphviz Observability v1.1 — Flow Typing Overlay (Curve/Mesh)
DATE/TIME: 2026-02-18 (Europe/Oslo)

WHAT WAS FIXED (FACTS, MEASURED):
- Implemented `overlay_flow_type.py` to classify edges as Curve (Orange) or Mesh (Blue)
- Logic uses existing node metadata `bl_idname` or `label` ("MeshToCurve", "CurveToMesh", etc.) to infer flow
- Edge styling applied idempotently (overwrites style/color/penwidth only)
- Registered in `__init__.py` pipeline after Live/Dead styling

NEXT GOAL (carry forward):
- Verify visualization in Blender (runtime executable check)
- Refine detection logic if heuristics miss complex nodes

-------------------------------------------------------------------------------
CHECKPOINT: DEFAULT_BLEND_DETERMINISTIC_CLEAN_BOOT__2026-02-18

STATUS: LOCKED — VERIFIED CLEAN

SUMMARY:
- FS_SNAPSHOT_ROOT unified to canonical:
	C:\Users\danie\OneDrive\PROSJEKT SYNK\BLENDER\DEV_ADDONS\blender_snapshot
- HUB v4 guard implemented:
	• Forbids pointing to \snapshots
	• Validates path existence
	• Fails fast on drift
- Launcher deterministic DEFAULT_BLEND support added:
	• Uses __FS_DEFAULT_START.blend in SUPER_ROOT
	• Explicit quoting of blend path (space-safe)
	• ArgumentList passed as array (no string splitting)
- __FS_DEFAULT_START.blend cleaned:
	• Removed invalid driver:
			modifiers["FS_TUBE_CE_TEST_GN"]["__drv_test"][0]
	• Saved file explicitly
- Verified via latest OUT/ERR logs:
	• err.log size = 0
	• No anim.driver / __drv_test warnings
	• Clean boot confirmed

ARCHITECTURE IMPACT:
- Eliminates startup contamination from unsaved scene
- Eliminates environment drift from stale FS_SNAPSHOT_ROOT
- Enforces deterministic launch state
- Establishes canonical clean boot contract for all future sessions

NEXT SAFE STATE:
System ready for continued Graphviz Observability development
without runtime noise or environment ambiguity.
-------------------------------------------------------------------------------

--------------------------------------------------------------------
APPEND (2026-02-22) — LINUX FOUNDATION GREEN — LINUX_FOUNDATION_GREEN_LOCKED_MARKER
--------------------------------------------------------------------
CHECKPOINT — LINUX_FOUNDATION_GREEN__2026-02-22

STATUS: LOCKED — VERIFIED GREEN BASE

FACTS (VERIFIED):
- Virtualization: ON
- WSL2 kernel: OK
- Ubuntu: OK
- Filesystem bridge: OK

RULE:
- All future work builds on this locked base.
--------------------------------------------------------------------

--------------------------------------------------------------------
APPEND (2026-02-22) — WSL2 + CONTAINER FOUNDATION GREEN — WSL2_CONTAINER_FOUNDATION_GREEN_LOCKED_MARKER
--------------------------------------------------------------------
CHECKPOINT — WSL2_CONTAINER_FOUNDATION_GREEN__2026-02-22

DATE: 2026-02-22
STATUS: VERIFIED GREEN — CORE DEV INFRA STABLE

LINUX LAYER (LOCKED FACTS):
- WSL2 active with real kernel: OK
- Ubuntu installed: OK
- User: danie
- sudo: OK

CONTAINER LAYER (LOCKED FACTS):
- Podman installed: podman 4.9.3
- Image pulls: OK
- Container networking: OK
- hello-world: OK

LOCKED ARCHITECTURE RULE:
- Backstage/Node projects MUST live on Linux filesystem: ~/control_plane
- DO NOT place on /mnt/c (NTFS) due to EPERM + instability

ROLE SPLIT (LOCKED):
- Windows is used only as: editor, browser, orchestration layer
- Linux is runtime truth
--------------------------------------------------------------------

--------------------------------------------------------------------
APPEND (2026-02-22) — BIOS + STORAGE + PCIe OPTIMALISERING — BIOS_STORAGE_PCIE_OPT_2026_02_22_MARKER
--------------------------------------------------------------------
CHECKPOINT — BIOS_STORAGE_PCIE_OPTIMALISERING_LOCKED__2026-02-22

STATUS: LOCKED — VERIFIED (hardware tuning applied + stable)

HARDWARE (VERIFIED):
- CPU: i7-9700K
- RAM: 32 GB DDR4 @ 3600 MHz (XMP aktiv)
- GPU: RTX 4060 → PCIe 3.0 x8 aktiv (GPU-Z verifisert)
- NVMe M.2: 128 GB (gammel laptop-disk) — scratch/cache
- SATA SSD: Windows systemdisk

BIOS-ENDRINGER (FAKTISK GJORT):
CPU / System:
- Intel VMX Virtualization: Enabled
- Intel Speed Shift: Enabled
- CPU C-States: Enabled
- Turbo Mode: Enabled

RAM:
- XMP Profile: aktiv (3600 MHz @ 1.35V)

PCIe / GPU:
- Above 4G Decoding: Enabled
- Re-Size BAR: Disabled (kort støtter; plattform gir lite effekt)
- PCIe Link Speed: Gen3 (stabilitet)
- DMI Link Speed: Gen3

Display:
- Primary Display: PCIe
- iGPU Multi-Monitor: Enabled (spacedesk / ekstra skjermer)

STORAGE / LANES (LOCKED FACT):
- Når PCIe x4 mode brukes → SATA porter 5/6 blir deaktivert
- Windows-disken flyttet til SATA 3/4 → boot OK
- M.2 brukes som rask scratch-disk (ikke OS)

YTELSEREALITET (PRAKTISK):
- RTX 4060 på PCIe 3.0 x8: ~0–5% tap i praksis (uproblematisk)
- NVMe 128GB: best til cache/scratch — ikke Windows
- SATA SSD: mer enn rask nok for OS

DISK-STRATEGI (LÅST):
- Windows + spill → SATA SSD
- Blender / AI scratch → M.2 NVMe
- IKKE flytt pagefile eller Windows core

NOTE (HUB GOVERNANCE):
- Hardware scan baseline (seksjon 2) viste tidligere Configured_MHz=2133; dette er en senere verifisert tilstand (XMP@3600).
- For å oppdatere selve LOCKED baseline-blokka: kjør ny hardware scan + ny SHA proof (additivt, ingen destruktiv edit).
--------------------------------------------------------------------

====================================================================

## Dedupe / consolidation notes
- Verbatim import. Do not dedupe yet.

## Crosslinks
- Runbook Index: `00__RUNBOOK_INDEX.md`
- Knowledge Buffer Governance: `16__CH_15__KNOWLEDGE_BUFFER_GOVERNANCE.md`
