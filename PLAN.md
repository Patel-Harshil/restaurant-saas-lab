# Restaurant SaaS Lab — 10-Day Learning Sprint

## Why this exists
Job-prep for a US-based SaaS product dev opportunity (referred by brother). Company
builds SaaS restaurant management software and allows AI-assisted development — the
goal isn't to hand-build everything, it's to **understand deeply enough to review AI
output, debug it when it breaks, and plan work for 1-2 juniors.**

One cumulative app, built incrementally, so every concept below is a real piece of one
system instead of a disposable tutorial. ~10 hrs/day for 10 days.

## Personal tutoring workflow
Coding milestones alone left a gap: reviewing AI-generated code is not the same as
actually learning the concept behind it. To fix that structurally (not just for Day 1),
every day now pairs its **coding milestone** with a **learning milestone**, and the
learning itself is captured somewhere durable instead of living only in chat.

- `learning/` (project root) is a living personal textbook — one Markdown chapter per
  topic, indexed in `learning/README.md`.
- Every chapter ends with two sections the learner fills in himself:
  - **My notes** — in his own words, whatever's worth keeping.
  - **Things I found hard (ask for a deeper explanation)** — flagged gaps.
- When something gets flagged as hard, the fix is to **expand that chapter in place**
  with a simpler or more detailed explanation — not to answer it once in conversation
  and let it evaporate. The textbook accumulates; nothing learned gets lost between
  days or sessions.

## Ground rules
- Every day: read every line of what gets built, don't just accept it. Break something
  on purpose and fix it from the error/logs — that loop is the actual skill.
- Every day: complete both the coding milestone and the paired learning milestone —
  reviewing generated code is not a substitute for the dedicated concept-learning pass.
- Keep each day's addition "just enough to prove the concept," not polished — scope
  creep on Day 1's login screen is the #1 way to never reach Day 10.
- Log progress at the end of each day below so a new session can pick up mid-sprint.

## Day-by-day
1. **React + Node foundation** — Express API + React (Vite) frontend, basic auth,
   menu CRUD. In-memory data store for now.
   - **Learning milestone** — covered by 5 chapters in `learning/`:
     [01-http-and-rest.md](learning/01-http-and-rest.md),
     [02-nodejs-and-express.md](learning/02-nodejs-and-express.md),
     [03-react-fundamentals.md](learning/03-react-fundamentals.md),
     [04-auth-concepts.md](learning/04-auth-concepts.md),
     [05-javascript-async.md](learning/05-javascript-async.md).
2. **Real database** — Postgres, multi-tenant schema (restaurants, menu_items, orders,
   users, staff), migrations, indexes. Replace the in-memory store.
   - **Learning milestone** — relational database fundamentals:
     - What a table/row/column is, and primary vs foreign keys.
     - One-to-many vs many-to-many relationships, and why normalization matters.
     - What an index actually does and why it speeds up reads.
     - Basic SQL joins; what a migration is and why schema changes are versioned.
3. **System design practice** — 2-3 HLD problems (URL shortener, notifications) +
   detailed LLD for one feature of this app.
   - **Learning milestone** — system design vocabulary:
     - HLD vs LLD in plain terms.
     - Horizontal vs vertical scaling.
     - What caching solves and its risks (staleness); load balancing basics; rate
       limiting.
     - Why an API contract matters before writing implementation code.
4. **SaaS mechanics** — tenant_id scoping, config/feature-flag system, RBAC admin
   panel, signup-to-trial onboarding flow.
   - **Learning milestone** — SaaS architecture patterns:
     - Multi-tenancy models (shared DB with tenant_id vs DB-per-tenant) and their
       tradeoffs.
     - What RBAC actually means.
     - Config/feature-flag patterns and why they beat hardcoded behavior.
     - What "time to first value" means in onboarding design.
5. **AWS** — deploy backend (EC2/Lambda), DB path via RDS, assets to S3, IAM roles,
   CloudWatch logs.
   - **Learning milestone** — cloud fundamentals:
     - What "the cloud" actually is (someone else's managed servers, not magic).
     - The core AWS building blocks: EC2 = a server, S3 = file storage, RDS = a
       managed database, Lambda = code that runs without you managing a server,
       IAM = who is allowed to do what.
     - Why region/latency matters.
6. **Docker** — multi-stage Dockerfile, docker-compose (frontend+backend+db), break
   and debug a container from logs alone.
   - **Learning milestone** — containers:
     - The actual problem Docker solves ("works on my machine").
     - Image vs container.
     - What a layer is and why layer order affects build speed; what a volume is for.
     - How docker-compose differs from running containers by hand.
7. **Kubernetes** — local cluster, deployment/service manifests, scale, force and fix
   a CrashLoopBackOff via kubectl.
   - **Learning milestone** — orchestration:
     - Why you'd need something on top of Docker once you have more than one
       container.
     - What a pod/deployment/service actually are.
     - What "self-healing" and "scaling" mean concretely.
     - How to read the most common failure signals.
8. **Kafka** — "order placed" event → inventory-update + kitchen-notify consumers,
   induce and diagnose a stuck consumer.
   - **Learning milestone** — event-driven architecture:
     - The difference between calling an API directly and publishing an event.
     - What a message broker solves.
     - Producer/consumer/topic/partition/consumer-group vocabulary.
     - Why ordering and at-least-once delivery are genuinely hard problems.
9. **Observability** — Prometheus + Grafana, app metrics, structured logs, find a
   planted bug via the dashboard instead of the code.
   - **Learning milestone** — observability:
     - The three pillars (logs, metrics, traces) and when to reach for each.
     - What a dashboard is actually showing.
     - The difference between monitoring and alerting.
     - Why "tests pass" and "it works in production" are different claims.
10. **Integration + capstone** — everything running together; design doc + ticket
    breakdown for juniors; PR-review checklist; explain every piece out loud.
    - **Learning milestone** — consolidation: no new concept. This day is about being
      able to explain the whole system end to end in your own words, and recognizing
      which concept from Days 1-9 explains any given part of it.

## Progress log
### Day 1 — done (coding + learning)
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
- **Learning milestone — retroactively covered**: reviewing generated code isn't the
  same as a dedicated concept pass, so 5 chapters were added to `learning/` covering
  Day 1's concepts: HTTP/REST, Node.js + Express, React fundamentals, auth concepts,
  and JavaScript async. See the links under Day 1 above, or `learning/README.md` for
  the index.

### Day 2 — not started
Next up: replace `store.js` with real Postgres (schema for restaurants, menu_items,
orders, users, staff + migrations + indexes), still behind the same API surface.
Learning milestone: relational database fundamentals (see Day 2 above).
