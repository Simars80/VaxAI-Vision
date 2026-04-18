## What does this PR do?

<!-- One or two sentences describing the change -->

## Which part of the monorepo does this touch?

- [ ] `src/` — Landing page (Next.js → Vercel)
- [ ] `frontend/` — Dashboard (Vite → GitHub Pages)
- [ ] `backend/` — API (FastAPI → AWS EC2)
- [ ] Root config files (`package.json`, `next.config.mjs`, `tsconfig.json`)

## Pre-merge checklist

### If touching `src/` or root configs:
- [ ] Ran `npx next build` locally — no Terser or prerender errors
- [ ] Any new npm dependency checked for `import.meta` in its dist files
- [ ] No bare `useSearchParams()` without `<Suspense>` wrapper
- [ ] `next.config.mjs` onnxruntime-web alias is intact
- [ ] Not using Next.js 15 config keys (`serverExternalPackages`, etc.)

### If touching `frontend/`:
- [ ] Ran `cd frontend && npm run build` — builds clean
- [ ] `frontend/public/404.html` SPA redirect still works
- [ ] Demo mode (`?demo=true`) tested if auth flow changed

### If touching `backend/`:
- [ ] Ran `pytest tests/ -v` — all tests pass
- [ ] `ruff check app/` and `ruff format --check app/` clean
- [ ] No secrets or `.env` values committed
- [ ] Docker build tested if Dockerfile or requirements.txt changed

## How was this tested?

<!-- Describe how you verified the change works -->
