# VaxAI Vision — Development Workflow

This document defines how code gets from "idea" to "production" for VaxAI Vision.
It applies to all contributors: human developers, Paperclip agents, and Cowork sessions.

---

## The One Rule

**Nothing goes to `main` without passing CI.**

The `main` branch auto-deploys to three production targets (Vercel, GitHub Pages, AWS).
A broken push to `main` means broken production. Every change goes through a pull request
with automated build checks.

---

## Branching Strategy

```
main (protected — auto-deploys to production)
 ├── feat/inventory-alerts      ← new features
 ├── fix/scan-page-crash        ← bug fixes
 ├── chore/update-deps          ← maintenance
 └── paperclip/ar-stock-counter ← Paperclip agent work
```

### Branch naming

| Prefix       | Use for                              | Example                          |
|-------------|--------------------------------------|----------------------------------|
| `feat/`     | New features                         | `feat/dhis2-integration`         |
| `fix/`      | Bug fixes                            | `fix/vercel-terser-error`        |
| `chore/`    | Dependencies, CI, docs               | `chore/update-onnxruntime`       |
| `paperclip/`| Any code written by Paperclip agents | `paperclip/cold-chain-dashboard` |

### Creating a branch

```bash
git checkout main
git pull origin main
git checkout -b feat/my-feature
```

### Merging to main

```bash
git push -u origin feat/my-feature
# Then open a PR on GitHub — CI runs automatically
# Merge only after CI Gate passes
```

---

## CI Pipeline

Every PR triggers automated checks based on which files changed:

| Files changed               | CI job that runs              | What it checks                           |
|-----------------------------|-------------------------------|------------------------------------------|
| `src/`, `package.json`, `next.config.mjs` | **Landing page build** | `npx next build` — catches Terser, Suspense, config errors |
| `frontend/**`               | **Dashboard build**           | `npm run build` in frontend/             |
| `backend/**`                | **Backend lint + tests**      | Ruff lint, mypy, pytest with real Postgres |

A final **CI Gate** job aggregates all results. If any applicable check fails, the PR cannot merge.

---

## Who Does What

### You (Abdulhafeez)
- Define what needs to be built — features, priorities, direction
- Review PRs before merging (or ask Cowork to review)
- Run `scripts/setup-branch-protection.sh` once to enable branch protection
- Final decision on merges to main

### Cowork (Claude)
- **Review role**: Check PRs for build compatibility, code quality, security
- **Implementation**: Build features on branches, never push to main directly
- **Firefighting**: Debug production issues, but the goal is preventing them
- **Process**: Help maintain CI, update CLAUDE.md, manage deployments

### Paperclip Agents
- **Always work on `paperclip/*` branches** — never commit directly to main
- Read `CLAUDE.md` before writing code that touches `src/` or root configs
- Follow the 5 rules in CLAUDE.md Section 8
- Open PRs for review — don't self-merge

---

## Deployment Targets

| Target                     | Deploys from | Trigger           | URL                        |
|---------------------------|-------------|-------------------|----------------------------|
| Landing page (Vercel)     | `main`       | Auto on push       | vaxaivision.com            |
| Dashboard (GitHub Pages)  | `main`       | GitHub Actions      | app.vaxaivision.com        |
| Backend API (AWS EC2)     | `main`       | GitHub Actions/Manual | api.vaxaivision.com      |

Because all three deploy from `main`, protecting `main` protects all production environments.

---

## Adding Dependencies

### Root `package.json` (affects Vercel landing page)

Before adding ANY npm package:

```bash
# 1. Install it
npm install <package>

# 2. Check for import.meta (breaks Next.js 14 Terser)
grep -r "import\.meta" node_modules/<package>/dist/

# 3. If found, you MUST add a webpack alias in next.config.mjs
#    pointing to the CJS/UMD build. See CLAUDE.md §2.1 for the pattern.

# 4. Test the build
npx next build
```

### `frontend/package.json` (affects GitHub Pages)

```bash
cd frontend
npm install <package>
npm run build  # verify it works
```

### `backend/requirements.txt` (affects Docker/EC2)

```bash
cd backend
pip install <package>
# Add to requirements.txt
docker compose build  # verify Docker build works
```

---

## Common Workflows

### "I want to add a new page to the landing site"

```bash
git checkout -b feat/new-page
# Create your page in src/app/new-page/page.tsx
# If using useSearchParams(), wrap in <Suspense> (see CLAUDE.md §2.3)
npx next build            # verify locally
git add . && git commit
git push -u origin feat/new-page
# Open PR → CI runs → merge when green
```

### "Paperclip built a feature, how do I ship it?"

```bash
# 1. Check what branch Paperclip pushed to
git fetch origin
git log origin/paperclip/feature-name --oneline -10

# 2. Ask Cowork to review the PR
#    "Review the PR from paperclip/feature-name, check for build issues"

# 3. If CI passes and review looks good, merge the PR
```

### "Production is broken, I need to fix it NOW"

```bash
git checkout -b fix/urgent-fix
# Make the fix
npx next build            # ALWAYS verify before pushing
git add . && git commit -m "fix: description of urgent fix"
git push -u origin fix/urgent-fix
# Open PR → CI should pass → merge immediately
# If branch protection blocks you: you can bypass as admin (enforce_admins is off)
```

---

## Quick Reference

| I want to...                        | Do this                                            |
|------------------------------------|----------------------------------------------------|
| Start a new feature                | `git checkout -b feat/name`                        |
| Check if my code will deploy       | `npx next build` (landing) or `cd frontend && npm run build` (dashboard) |
| See why Vercel failed              | Check Vercel dashboard or `npx next build 2>&1 \| grep -i "terser\|import.meta\|suspense"` |
| Add a npm package safely           | Install → grep for import.meta → test build → commit |
| Review Paperclip's work            | Open Cowork → "Review the PR from paperclip/branch" |
| Deploy backend manually            | SSH to EC2 → `docker compose pull && docker compose up -d` |
| Enable branch protection           | Run `scripts/setup-branch-protection.sh` with `gh` CLI |
