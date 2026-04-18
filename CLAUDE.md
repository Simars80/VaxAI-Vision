# CLAUDE.md — VaxAI Vision Build & Development Rules

This file contains hard-won rules for working on the VaxAI Vision codebase.
Every instruction here exists because ignoring it broke production. Follow them exactly.

---

## 1. Repository Architecture

This is a **monorepo** with three independent build targets:

| Directory    | Framework       | Deploys to              | Trigger               |
|-------------|-----------------|-------------------------|-----------------------|
| `src/`      | Next.js 14.2.4  | Vercel → vaxaivision.com | Push to `main`        |
| `frontend/` | Vite + React    | GitHub Pages → app.vaxaivision.com | Push to `main` (GH Actions) |
| `backend/`  | Python FastAPI  | AWS EC2 (Docker Compose) | Manual / GH Actions   |

**Critical implication:** Any file change under `src/`, `package.json`, `next.config.mjs`,
or root config files triggers a Vercel production build. Backend-only or frontend/-only
changes are safe, but touching root files affects the landing page build.

---

## 2. Next.js 14 — Mandatory Build Rules

The landing page uses **Next.js 14.2.4** (NOT v15). The following rules are non-negotiable:

### 2.1 No `import.meta` in Client Bundles

Next.js 14's Terser minifier **cannot parse `import.meta`** in client-side chunks.
Any npm package whose ESM entry uses `import.meta` will break the production build
with: `'import.meta' cannot be used outside of module code`.

**Before adding ANY npm dependency:**
1. Check if its `dist/` files use `import.meta` — run `grep -r "import\.meta" node_modules/<pkg>/dist/`
2. If yes, you MUST add a webpack alias in `next.config.mjs` pointing to the CJS/UMD build
3. Use **absolute paths** for aliases (see onnxruntime-web example below)

### 2.2 webpack 5 `exports` Field Overrides Aliases

webpack 5 resolves the `"exports"` field in a package's `package.json` **before**
`resolve.alias`. A relative alias like `"onnxruntime-web": "onnxruntime-web/dist/ort.min.js"`
will be silently ignored.

**Fix:** Always use `path.resolve(__dirname, "node_modules/<pkg>/dist/<file>")` for aliases
that need to override a package's exports map. See `next.config.mjs` for the working pattern.

### 2.3 `useSearchParams()` Requires Suspense Boundary

In Next.js 14, any page component that calls `useSearchParams()` **must** be wrapped in a
`<Suspense>` boundary. Without it, static pre-rendering fails with:

```
useSearchParams() should be wrapped in a suspense boundary
Error occurred prerendering page "/<path>"
```

**Pattern — always use this when adding `useSearchParams`:**
```tsx
"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

export default function MyPage() {
  return (
    <Suspense fallback={<div />}>
      <MyPageInner />
    </Suspense>
  );
}

function MyPageInner() {
  const params = useSearchParams();
  // ... rest of the component
}
```

### 2.4 Next.js 14 vs 15 Config Keys

| Next.js 14 key                                         | Next.js 15 equivalent         |
|--------------------------------------------------------|-------------------------------|
| `experimental.serverComponentsExternalPackages`        | `serverExternalPackages`      |
| `experimental.appDir` (true by default)                | removed                       |

**Do NOT use Next.js 15 config keys.** The build will warn "Unrecognized key" and ignore them.

### 2.5 Google Fonts / `next/font`

The project uses `next/font/google` for Montserrat. This fetches fonts at build time.
If the build environment has no network (CI sandbox), the build fails. This is expected
in sandboxed local testing but succeeds on Vercel.

---

## 3. onnxruntime-web — Special Handling Required

`onnxruntime-web` v1.24+ is used in `src/app/demo/vision/stock-count/lib/inference.ts`
for the AR stock counter's WASM-based YOLOv8 inference.

**The problem:** The package's default ESM entry (`ort.bundle.min.mjs`) uses `import.meta.url`
and `createRequire` — constructs that Terser cannot parse. The CJS build (`ort.min.js`) has
zero `import.meta` occurrences and works fine.

**The fix is already in `next.config.mjs`** — do NOT remove or simplify it:
```js
const ortCjsPath = path.resolve(__dirname, "node_modules/onnxruntime-web/dist/ort.min.js");
config.resolve.alias = { ...config.resolve.alias, "onnxruntime-web": ortCjsPath };
```

**If upgrading onnxruntime-web:**
1. Check if `ort.min.js` still exists and has zero `import.meta` references
2. Run `npx next build` locally before pushing
3. If the new version changes its dist structure, update the alias path

---

## 4. Pre-Push Checklist

Before pushing **any** change that touches `src/`, `package.json`, `next.config.mjs`,
or root config files, run:

```bash
npx next build
```

If the build fails on Google Fonts (network error in sandbox), that's OK — confirm
there are **no other errors** (especially Terser, module resolution, or prerender errors).

**Grep the build output for real problems:**
```bash
npx next build 2>&1 | grep -i "terser\|import\.meta\|cannot be used\|prerender\|useSearchParams" 
```
If that returns anything, fix it before pushing.

---

## 5. Deployment Architecture

### Vercel (Landing Page — vaxaivision.com)
- Auto-deploys from `main` branch on GitHub
- Builds `src/` using `next build`
- **No environment variables needed** — the landing page is static
- Build cache restored from last successful deploy — if builds have been failing for
  multiple commits, the cache may be stale

### GitHub Pages (Dashboard — app.vaxaivision.com)
- Deployed via `.github/workflows/deploy-pages.yml`
- Builds `frontend/` using `tsc -b && vite build`
- SPA routing handled by `frontend/public/404.html` → sessionStorage redirect
- Demo mode: `?demo=true` URL param sets localStorage tokens; 404.html persists
  demo state through the SPA redirect

### AWS EC2 (Backend API — api.vaxaivision.com)
- EC2 t3.medium at `3.144.69.140`
- Docker Compose: FastAPI + PostgreSQL + Redis + Celery workers
- Nginx reverse proxy with Let's Encrypt SSL on ports 80/443
- Docker Compose maps `8080:8000` (API container) behind Nginx
- SSH via PEM key (not in repo — `.gitignore` blocks `*.pem`)

---

## 6. File Safety Rules

### Never Commit
- `*.pem`, `*.key`, `*.p12`, `*.pfx` — private keys
- `.env` files (except `.env.example` and `frontend/.env.production`)
- `backend/data/vvm_models/*.pkl|*.pt|*.onnx` — ML model artifacts
- `backend/data/vvm_synthetic/` — generated training data
- `backend/data/demo_scenarios/` — generated demo data

### Always Check Before Adding Dependencies
- New `dependencies` in root `package.json` → affects Vercel build
- New `dependencies` in `frontend/package.json` → affects GitHub Pages build
- New `requirements` in `backend/requirements.txt` → affects Docker build
- Any package with native Node.js bindings or `import.meta` in ESM entry → needs webpack config

---

## 7. Common Gotchas

| Symptom | Cause | Fix |
|---------|-------|-----|
| Vercel: `'import.meta' cannot be used outside of module code` | Package ESM uses import.meta, Terser can't parse it | Add absolute-path webpack alias to CJS build in next.config.mjs |
| Vercel: `useSearchParams() should be wrapped in suspense boundary` | Missing `<Suspense>` around useSearchParams | Wrap component in `<Suspense>` (see pattern in §2.3) |
| Vercel: `Unrecognized key 'serverExternalPackages'` | Using Next.js 15 config in v14 project | Use `experimental.serverComponentsExternalPackages` instead |
| Vercel: webpack alias ignored for npm package | webpack 5 `exports` field takes priority | Use `path.resolve()` absolute path for alias |
| GitHub Pages: SPA routes return 404 | GitHub Pages doesn't know about client-side routes | Ensure `frontend/public/404.html` exists with sessionStorage redirect |
| GitHub Pages: `?demo=true` lost after redirect | Demo params stripped during 404→index redirect | 404.html writes localStorage before redirect (already fixed) |
| EC2: Docker "container name already in use" | Stale containers from previous deploy | Run `docker compose down --remove-orphans` before `up -d` |
| EC2: Docker build timeout via SSH | Long builds exceed SSH/terminal timeout | Use `ssh -f` with background execution + log polling |

---

## 8. For Paperclip Agents

If you are a Paperclip agent working on this codebase:

1. **Always run `npx next build`** before creating a PR that touches `src/` or root configs
2. **Never add a new npm dependency** to root `package.json` without checking for import.meta compatibility
3. **Never use `useSearchParams()` without a Suspense wrapper** — this is a hard Next.js 14 requirement
4. **Do not modify `next.config.mjs`** unless you understand the onnxruntime-web alias — removing it breaks production
5. **Test frontend/ changes separately** with `cd frontend && npm run build` — this is a different build pipeline
6. When in doubt, check the last successful Vercel deploy and compare what changed since
