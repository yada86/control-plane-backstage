# TechDocs på GitHub Pages (uten genererte artefakter i git)

## Formål
Publisere Control Plane TechDocs offentlig via GitHub Pages, uten å committe genererte TechDocs-filer til repoet.
Policy: **"no generated artifacts in git"** beholdes. Publisering skjer via **GitHub Actions**.

## Forutsetninger (må være sant)
- Repo: `yada86/control-plane-backstage`
- Default branch: `main`
- TechDocs build i CI fungerer og produserer artefakt (f.eks. `techdocs-site`)
- Lokal policy: `site/` eller `docs-site/` eller tilsvarende generert output er **ikke** tracked i git

## Oversikt (hva som skjer)
1. GitHub Actions bygger TechDocs (samme som CI, men med Pages-steg).
2. Output publish-es til GitHub Pages via Actions (ikke via commit).

## GitHub Settings (en gang)
Gå til:
- **GitHub → Repo → Settings → Pages**
- Under **Build and deployment**:
  - **Source = GitHub Actions**

Dette er den kritiske “koblingen”. Uten den kan workflow kjøre, men Pages blir ikke aktivert.

## Workflow (i repoet)
Canonical workflowfil:
- `.github/workflows/techdocs-pages.yml`

Kontrakt:
- Bygger TechDocs
- Laster opp Pages artifact
- Deploy-er til Pages

Merk: workflowen skal IKKE committe genererte filer.

## Verifisering
Når Pages er aktivert og en deploy har gått grønt:
- Repo → Actions: siste run = success
- Repo → Settings → Pages: viser publisert URL
- URL forventes typisk:
  - `https://yada86.github.io/control-plane-backstage/`

## Feilsøking
- 404 på Pages:
  - Sjekk at **Settings → Pages → Source** faktisk er satt til **GitHub Actions**
  - Sjekk at workflow deploy-jobben kjørte (ikke bare build)
- Workflow grønner, men ingen Pages:
  - Pages-kilden står feil (ofte “Deploy from branch” eller “Disabled”)

## Rollback / disable
- Settings → Pages → sett Source til “Disabled” (eller fjern workflow om ønskelig)
- Dette endrer ikke repo-innholdet (ingen genererte filer committed)

## SSOT-note
Når dette er aktivert:
- Push en `HUB_SESSION_WRAP__...` som sier:
  - Pages enabled + Source=Actions
  - techdocs-pages.yml lagt til
  - URL verifisert (eller known-issue hvis ikke)
