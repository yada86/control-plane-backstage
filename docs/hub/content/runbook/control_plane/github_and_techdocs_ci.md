# GitHub default branch + TechDocs CI (Canonical)

Scope:
- This runbook documents the operational steps to:
  1) ensure GitHub default branch is correct (main),
  2) set minimal branch protection (optional),
  3) run TechDocs generation in CI without committing generated artifacts.

Non-goals:
- No new services/endpoints. No repo refactors. No hidden state.

## Preconditions (measure first)
- Repo exists on GitHub and `main` branch is present.
- Local docs build works (TechDocs generation works locally) OR is at least understood.
- Policy: generated TechDocs artifacts are NOT committed to git (artifact-only).

## Step A — Set GitHub default branch to `main` (UI)
1. Open GitHub repo → Settings → Branches
2. Default branch: set to `main`
3. Verify: GitHub shows `main` as default on repo home.

Optional hardening (only if you want it):
- Add branch protection rule for `main`:
  - Require PR (or not), require status checks (once CI exists), block force-push.

## Step B — TechDocs CI strategy (no committed artifacts)
Policy:
- TechDocs output is a build artifact produced by CI.
- Do NOT add generated site files into git.

Two acceptable outputs:
- (Preferred) Deploy to GitHub Pages (published docs site)
- (Simplest) Upload build as CI artifact (downloadable)

### B1 — Minimal CI artifact publish (lowest risk)
Goal:
- On every push to `main`, generate TechDocs site and upload as workflow artifact.

Checklist:
- Workflow runs `yarn install` / build prerequisites
- Runs TechDocs generate command
- Uploads generated site directory as artifact

Notes:
- This proves pipeline health without deciding hosting yet.

### B2 — GitHub Pages deploy (if you want a public docs URL)
Goal:
- Generate TechDocs site in CI and deploy output to Pages (no git-commit of artifacts).

Checklist:
- Workflow generates site
- Deploy step publishes output to Pages

## Verification (must be true)
- Runbook Index links to this page.
- After CI is added later:
  - CI run succeeds on `main`
  - Artifact exists (or Pages updates)
  - No generated TechDocs files are committed to the repo.

## Known pitfalls
- Accidentally committing generated docs (breaks artifact policy).
- CI runs on wrong branch because default branch is still `master`.
- TechDocs generation depends on local-only paths; fix by documenting env and making it deterministic.

## Next actions (after docs are merged)
- Implement CI workflow (PATCH) with minimal scope.
- Verify: CI success + artifact produced.
- Push wrap documenting the new invariant.
