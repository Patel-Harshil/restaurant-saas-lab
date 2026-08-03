# Restaurant SaaS Lab — 10-Day Learning Sprint

## Why this exists
Job-prep for a US-based SaaS product dev opportunity (referred by brother). Company
builds SaaS restaurant management software and allows AI-assisted development — the
goal isn't to hand-build everything, it's to **understand deeply enough to review AI
output, debug it when it breaks, and plan work for 1-2 juniors.**

One cumulative app, built incrementally, so every concept below is a real piece of one
system instead of a disposable tutorial. ~10 hrs/day for 10 days.

## Ground rules
- Every day: read every line of what gets built, don't just accept it. Break something
  on purpose and fix it from the error/logs — that loop is the actual skill.
- Keep each day's addition "just enough to prove the concept," not polished — scope
  creep on Day 1's login screen is the #1 way to never reach Day 10.
- Log progress at the end of each day below so a new session can pick up mid-sprint.

## Day-by-day
1. **React + Node foundation** — Express API + React (Vite) frontend, basic auth,
   menu CRUD. In-memory data store for now.
2. **Real database** — Postgres, multi-tenant schema (restaurants, menu_items, orders,
   users, staff), migrations, indexes. Replace the in-memory store.
3. **System design practice** — 2-3 HLD problems (URL shortener, notifications) +
   detailed LLD for one feature of this app.
4. **SaaS mechanics** — tenant_id scoping, config/feature-flag system, RBAC admin
   panel, signup-to-trial onboarding flow.
5. **AWS** — deploy backend (EC2/Lambda), DB path via RDS, assets to S3, IAM roles,
   CloudWatch logs.
6. **Docker** — multi-stage Dockerfile, docker-compose (frontend+backend+db), break
   and debug a container from logs alone.
7. **Kubernetes** — local cluster, deployment/service manifests, scale, force and fix
   a CrashLoopBackOff via kubectl.
8. **Kafka** — "order placed" event → inventory-update + kitchen-notify consumers,
   induce and diagnose a stuck consumer.
9. **Observability** — Prometheus + Grafana, app metrics, structured logs, find a
   planted bug via the dashboard instead of the code.
10. **Integration + capstone** — everything running together; design doc + ticket
    breakdown for juniors; PR-review checklist; explain every piece out loud.

## Progress log
### Day 1 — done
- Backend (`backend/`): Express API, in-memory data store (`src/data/store.js` — swap
  target for Day 2), JWT auth (`/api/auth/register`, `/api/auth/login`, bcrypt-hashed
  passwords), menu CRUD (`/api/menu` — public GET, auth-required POST/PUT/DELETE via
  `requireAuth` middleware). JWT secret loaded from `.env` (git-ignored), never
  hardcoded. 5/5 tests passing (`npm test` in `backend/`).
- Frontend (`frontend/`): Vite + React. `AuthPanel` (login/register, toggles mode),
  `MenuManager` (list, add, toggle availability, delete — write controls only render
  when logged in), session persisted to `localStorage`. Talks to the API via `src/api.js`.
- Both wired into `.claude/launch.json` as `restaurant-saas-lab-backend` (port 4000)
  and `restaurant-saas-lab-frontend` (port 5173) — use `preview_start` with those
  names to run them.
- **Browser-verified end-to-end**: register → login → session persists on reload →
  add/toggle/delete menu items while authed → logged-out view correctly hides owner
  controls → direct unauthenticated API write correctly returns 401. No console errors.
- **What "Day 1" deliberately skipped**: no real database (that's Day 2), no
  multi-tenancy (Day 4), no styling polish beyond basic layout/contrast — don't add
  any of that early, it's scoped for later days on purpose.

### Day 2 — not started
Next up: replace `store.js` with real Postgres (schema for restaurants, menu_items,
orders, users, staff + migrations + indexes), still behind the same API surface.
