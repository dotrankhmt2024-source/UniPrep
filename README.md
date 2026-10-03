# UniPrep

**UniPrep – An Online Learning Platform.**

UniPrep is a learning platform whose long-term goal is *Learning Analytics and early warning*:
dashboards for learning behaviour and results, detection of learners at risk of falling behind,
and explainable interventions for teachers. The LMS itself (courses, lessons, materials, quizzes,
progress tracking) is the source of the behavioural data that feeds analytics. Lesson content is
text, slides and video — the platform is not tied to any particular subject.

> **Status: foundation (E0) done, business modules not started.** The database schema is now fully
> defined by entities + migrations (25 tables), a reproducible seed fills it with demo data, and CI
> lints, builds and verifies migrations. Authentication, course/lesson APIs, the queue and the AI
> service are **not implemented yet** — see [Roadmap](#roadmap).

---

## Table of contents

- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Database workflow](#database-workflow)
- [Seed data](#seed-data)
- [API conventions](#api-conventions)
- [Frontend conventions](#frontend-conventions)
- [Routes](#routes)
- [Scripts](#scripts)
- [CI/CD and deployment](#cicd-and-deployment)
- [Roadmap](#roadmap)

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite 6 | SPA, route-level code splitting via `React.lazy` |
| Styling | Tailwind CSS 4 + Ant Design 6 | Material 3 design tokens mapped onto antd's theme |
| Editor | TipTap 3 | Rich text editor used for lesson/announcement content |
| HTTP client | Axios | Thin wrapper in `frontend/src/config/query-method` |
| Client state | Redux Toolkit + React context | Context for the theme; `@reduxjs/toolkit` + `react-redux` are installed for cross-page state (no store folder yet — see Roadmap) |
| Backend | NestJS 11 + TypeScript | Modular REST API, Swagger/OpenAPI docs |
| ORM / DB | TypeORM 0.3 + PostgreSQL 13+ | **`synchronize: false` everywhere** — the schema only changes through migrations (see [Database workflow](#database-workflow)) |
| Validation | `class-validator` / `class-transformer` | Global `ValidationPipe` with flattened error messages |
| Password hashing | `bcryptjs` | Pure JS (no native build); used by the seed and by E1 auth |
| Git hooks | husky + lint-staged (root `package.json`) | Lint/format only the staged files before each commit |
| CI/CD | GitHub Actions | CI on push/PR, deploy through a self-hosted Windows runner |

Planned but not present yet: Redis + BullMQ (AI job queue), an independent FastAPI (Python)
inference service, JWT/Passport auth with RBAC.

---

## Repository layout

```
UniPrep/
├── package.json             root scripts + husky/lint-staged (NOT npm workspaces)
├── lint-staged.config.mjs   per-package lint/format commands for staged files
├── .husky/pre-commit        runs `npx lint-staged`
├── backend/                 NestJS API
│   ├── src/
│   │   ├── common/          response envelope, exception filter, base entity, union types
│   │   ├── config/          Swagger config shared by `main.ts` and the OpenAPI export script
│   │   ├── database/        data-source.ts (TypeORM CLI) + migrations/ + seeds/
│   │   ├── health/          GET /api/health (pings the database)
│   │   ├── <domain>/entities/  one folder per future module (user, course, lesson, exercise,
│   │   │                       discussion, learning-activity, analytics, ai-gateway,
│   │   │                       intervention, notification, admin)
│   │   ├── app.module.ts    config + TypeORM wiring, feature module imports
│   │   └── main.ts          global prefix, CORS, pipes, Swagger bootstrap
│   └── .env.example         copy to .env and fill in
├── frontend/                React SPA
│   ├── src/
│   │   ├── apis/            one folder per feature, wraps queryMethod
│   │   ├── components/      shared UI kit (see components/README.md)
│   │   ├── config/          axios wrapper, antd theme, sidebar menu
│   │   ├── contexts/        theme provider
│   │   ├── layouts/private/ Header + Sider + <Outlet />
│   │   ├── mocks/           temporary mock data (courses)
│   │   ├── pages/           one folder per route
│   │   ├── routes/          createBrowserRouter route table
│   │   ├── styles/          M3 tokens, scrollbar, table, editor CSS
│   │   └── types/           shared domain types
│   ├── design/              static HTML mockups — reference only, never a component source
│   └── .env.example         copy to .env
├── deploy/                  Windows deploy scripts (stop → pull → build → start)
└── .github/                 workflows (ci.yml, deploy.yml), issue/PR templates, labels.yml
```

---

## Prerequisites

- **Node.js 20+** (CI uses Node 24) and npm
- **PostgreSQL 13+** (the schema uses the built-in `gen_random_uuid()`), running locally, with an
  empty database created:

  ```sql
  CREATE DATABASE uniprep;
  ```

- Windows only if you intend to use the scripts in `deploy/`.

---

## Getting started

### 1. Git hooks (once per clone, from the repository root)

```bash
npm ci          # installs husky + lint-staged and registers the pre-commit hook
```

### 2. Backend

```bash
cd backend
cp .env.example .env      # Windows: copy .env.example .env
npm ci
npm run migration:run     # creates the 25 core tables (and drops the legacy `students` table)
npm run seed              # demo accounts, 2 courses, 28 lessons, quizzes, 30 learners + activity
npm run dev               # nest start --watch
```

The API listens on `http://localhost:3000`, Swagger UI is served at
`http://localhost:3000/docs`. Tables are **never** created by the ORM: `synchronize` is `false`
in every environment, so a fresh clone must run `npm run migration:run` at least once.

Other scripts: `npm run build`, `npm run prod` (runs `dist/main.js`), `npm run lint`
(ESLint with `--fix`), `npm run lint:ci` (same without `--fix`, exactly what CI runs).

### 3. Frontend

```bash
cd frontend
cp .env.example .env      # Windows: copy .env.example .env
npm ci
npm run dev
```

The app runs on `http://localhost:5173`. Vite proxies `/api` to `http://localhost:3000`, so
requests work both with the absolute URL in `.env.example` and with a relative `/api` base URL.

Other scripts: `npm run build` (`tsc -b && vite build`), `npm run lint`, `npm run preview`.

### 4. Verify

```bash
curl http://localhost:3000/api/health
# {"error":false,"data":{"status":"ok","uptimeSeconds":12.3,"timestamp":"...","database":"up"},"message":"Thành công"}
```

A `database: "down"` value means the API process is up but the Postgres connection failed —
check the `DB_*` values in `backend/.env`.

---

## Database workflow

**The entities are the schema; migrations are the only way it changes.** `synchronize` is `false`
in `app.module.ts` and in `src/database/data-source.ts`, and CI fails if the two drift apart.

| Command | Effect |
|---|---|
| `npm run migration:run` | Apply every pending migration |
| `npm run migration:revert` | Roll back the last migration |
| `npm run migration:show` | List applied/pending migrations |
| `npm run migration:generate -- src/database/migrations/<Name>` | **Generate** a migration from the entity diff |
| `npm run schema:log` | Print the SQL needed to reconcile entities with the live DB — CI requires this to be empty |

Adding a column therefore means: edit the entity → run `migration:generate` → review the generated
file → commit both in the same PR. A few indexes cannot be expressed with TypeORM decorators
(`DESC`, expressions such as `lower(email)`/`COALESCE(...)`, GIN on `to_tsvector`); those live as a
clearly marked hand-written block at the end of `up()` in the baseline migration, and each one has
a matching `@Index('<name>', { synchronize: false })` placeholder plus its DDL in the entity that
owns it — change one, change the other.

Conventions: table/column names are `snake_case` English, TypeScript fields are camelCase and
**every `@Column` declares `name`** (there is no `SnakeNamingStrategy`). Enum-like values are
TypeScript union types in `src/common/types/`, never `enum`.

---

## Seed data

`npm run seed` fills a freshly migrated database with data that a dashboard, an RBAC test or the
risk model can use. It is **idempotent**: every id is derived from a natural key
(`src/database/seeds/seed-random.ts`), so re-running updates rows instead of duplicating them.

| Content | Amount |
|---|---|
| Accounts | admin, 2 teachers, 1 demo student + 30 virtual learners (`sv0001@example.test` …) |
| Catalogue | 3 categories, 2 published courses (MATH101 "Giải tích 1", PHY101 "Vật lý đại cương") |
| Content | 7 sections, 28 lessons, 33 materials, 2 quizzes (10 questions / 40 options) |
| Learning | 46 enrollments, 324 lesson-progress rows, ~1 170 learning events over 8 weeks, 15 graded submissions |
| Analytics/AI | 1 rule-based `model_version` (v0) and 1 global `alert_settings` row |

- Demo password comes from `SEED_DEMO_PASSWORD` in `backend/.env` (never hard-coded); the demo
  accounts are `admin@uniprep.test`, `giangvien1@uniprep.test`, `giangvien2@uniprep.test`,
  `hocvien@uniprep.test`.
- The random values are reproducible: `npm run seed -- --seed=123` (or `SEED_RANDOM_SEED` in
  `.env`) produces the same dataset. Timestamps are anchored to *now* on purpose so the dashboard
  always has recent activity.
- The script refuses to run when `NODE_ENV=production`.
- `risk_predictions` are **not** seeded by hand — they must come out of the prediction pipeline
  (E9) or the demo would prove nothing.

---

## API conventions

**Base path:** every route is prefixed with `/api` (`app.setGlobalPrefix('api')`).

**Response envelope:** every response — success or failure — has the same shape, produced by
`TransformResponseInterceptor` and `AllExceptionsFilter`:

```jsonc
// success
{ "error": false, "data": { /* payload */ }, "message": "Thành công" }

// failure
{ "error": true, "data": null, "message": "Không tìm thấy khoá học với ID ..." }
```

Failures keep their HTTP status code, but the body always carries a human-readable Vietnamese
`message`; the filter substitutes a sensible default when the exception has no message of its own.

**Validation:** a global `ValidationPipe` runs with `transform` and `whitelist` (unknown fields are
stripped). Validation errors are flattened to `"<field path>: <constraint message>"` strings, so a
DTO nested error surfaces as `profile.address: address should not be empty`.

**Current endpoints:** only `GET /api/health` (liveness + database connectivity). The reference
`student` CRUD module was removed together with its legacy `students` table — the real schema uses
`users` + `enrollments`.

**OpenAPI export:** `npm run openapi:export` (in `backend/`) writes `backend/openapi.json` from the
running application and the same `DocumentBuilder` configuration that serves Swagger UI. It needs
Postgres to be running because it boots the real `AppModule`. Commit the file together with any
endpoint change so the diff shows what the API contract did.

---

## Frontend conventions

Read **`frontend/src/components/README.md` before writing any page.** The short version:

1. **Data flow is always `apis/<feature>` → `types/<feature>` → `pages/<feature>`.**
2. **Never copy HTML out of `frontend/design/*.html`.** Those files are layout/colour mockups,
   not a component source.
3. **Never hand-write `<button>`, `<table>`, `<label>` + `<input>`, or status pills.** Use
   `ISolidBtn` / `IOutLinedBtn` / `IconBtn`, `ITable`, antd `<Form>` + `FormItem`, and `Badge`.
   Errors are rendered with `ErrorBadge`.
4. **Pages render content only.** The header, sidebar and `<Outlet />` belong to
   `layouts/private`. To add a nav entry, edit `config/sider-options/index.tsx` — it is the single
   source of truth for navigation.
5. **Theming is centralised.** Material 3 tokens live in `styles/theme.css` (`@theme { ... }`) and
   the antd theme in `config/antd-theme/index.ts`, loaded once in `App.tsx`. Class names such as
   `bg-surface-container-lowest`, `text-on-surface-variant`, `p-gutter` come from those tokens.

Formatting: `.prettierrc` (tabs, single quotes, trailing commas) applies to the frontend too, and
the pre-commit hook runs `eslint --fix` + `prettier --write` on staged files.

---

## Routes

| Path | Page | Data source |
|---|---|---|
| `/` | My courses | `mocks/course.ts` (mock — to be replaced by the real catalog API in E3-T6) |
| `/courses/:courseId` | Course content | `mocks/course.ts` (mock) |

---

## Scripts

Root `package.json` (convenience wrappers; backend and frontend stay independent packages):

| Script | Effect |
|---|---|
| `npm run lint` | `eslint --fix` in backend, then `eslint` in frontend |
| `npm run lint:ci` | Same but without `--fix` in the backend — run this before opening a PR |
| `npm run build` | `nest build` in backend, then `tsc -b && vite build` in frontend |

Backend-only scripts of note: `lint:ci`, `typeorm`, `migration:generate/run/revert/show`,
`schema:log`, `seed`, `openapi:export`.

---

## CI/CD and deployment

**CI** (`.github/workflows/ci.yml`) runs on pushes and pull requests to `develop`, `main` and
`Thien_dev`, with a concurrency group that cancels superseded runs. Three jobs, each on Node 24:

| Job | Steps |
|---|---|
| Frontend | `npm ci` → `npm run lint` → `npm run build` |
| Backend | `npm ci` → `npx eslint "src/**/*.ts"` → `npm run build` |
| Migrations | `npm ci` → `migration:run` → revert every migration → `migration:run` again → fail if `schema:log` is not empty (entity/migration drift) |

> The backend CI step deliberately calls `npx eslint` directly instead of `npm run lint`: that
> script passes `--fix`, and CI must **report** problems rather than silently fix them. Run
> `npm run lint:ci` locally to match it.

The migrations job uses a `postgres:17` service container, so it never touches the real dev
database.

**Deploy** (`.github/workflows/deploy.yml`) runs on pushes to `main` or manually via
`workflow_dispatch`, on the self-hosted Windows runner labelled `uniprep`. It deliberately does
**not** use `actions/checkout`, because the default `git clean -ffdx` would delete gitignored
runtime files (`.env`, `node_modules`, `dist`). Instead it calls `deploy/deploy.bat`, which:

1. stops the running services (`deploy/stop.ps1`, kills whatever listens on ports 3000/5173),
2. `git fetch` + `git checkout <branch>` + `git pull --ff-only` — this **refuses** instead of
   overwriting if the live tree has uncommitted changes,
3. `npm ci` + `npm run build` in `backend/`, `npm ci` in `frontend/`,
4. restarts both services detached (`deploy/start.vbs`), each with its own log file.

> **Migrations are not run by the deploy script yet.** Before the first deployment that relies on
> a schema change, run `npm run migration:run` (and `npm run seed` for a demo environment) by hand;
> wiring it into `deploy.bat` is part of E14-T6.

Manual operations from `deploy/`:

| Script | Effect |
|---|---|
| `deploy.bat [branch]` | Full deploy pipeline (default branch: `main`) |
| `start.bat` / `stop.bat` / `restart.bat` | Control the backend `:3000` and frontend `:5173` |
| `backend.log`, `frontend.log` | Runtime logs (gitignored) |

`start.vbs` runs the backend from the prebuilt `dist/` and the frontend as a Vite dev server, then
ensures the shared Cloudflare tunnel is up. The Vite server whitelists the public hostname in
`vite.config.ts` and proxies `/api` to the backend.

---

## Roadmap

Ordered roughly by dependency. Nothing below exists in the codebase yet except where noted.

- [x] **Migrations & seed** — `synchronize: false`, baseline migration for the 25 core tables,
      idempotent seed, CI drift check.
- [x] **Git hooks & CI lint** — husky + lint-staged, `lint:ci`, lint steps in CI.
- [ ] **Client state store** — `@reduxjs/toolkit` + `react-redux` are installed, but `src/store/`
      does not exist yet. Create the store (`configureStore` + slices) with the first feature that
      needs state shared across pages (login/session).
- [ ] **Auth & RBAC** — `AuthModule`/`UserModule`, JWT access + refresh tokens, Passport
      strategies, `student` / `teacher` / `admin` roles, route guards.
- [ ] **Course domain** — `CourseModule` / `LessonModule` / `ExerciseModule` services, controllers
      and DTOs on top of the existing entities; replacing `frontend/src/mocks/course.ts` with a real
      `apis/course`.
- [ ] **Learning activity** — the `learning_events` writer endpoint (the table and its indexes
      already exist).
- [ ] **Analytics** — aggregation endpoints (trends, cohort comparison) for the teacher dashboard.
- [ ] **AI service** — independent FastAPI service for at-risk prediction and result explanations,
      reachable only from the internal network.
- [ ] **Queue** — Redis + BullMQ so NestJS never blocks on a heavy inference job.
- [ ] **Explainability & interventions** — `risk_predictions`, feature contributions and the
      resulting intervention/audit trail.
- [ ] **Notifications** — in-app/email alerts when a learner is flagged.
- [ ] **Tests** — Jest is configured on the backend but there are no specs yet; adding unit and e2e
      coverage is E13.

---

## Known limitations

- No authentication or authorisation anywhere — every endpoint is public.
- No test suite yet (deferred by decision on 2026-10-03); the CI `test` job is not present.
- Course pages read mock data.
- `risk_feature_contributions`, `password_reset_tokens`, `course_instructors`, `cohorts` and the two
  analytics materialized views are **not** in the baseline migration — the epics that need them
  (E8, E9, E1-T4, E2/E3) add their own migrations.
- `enrollments.cohort_id` is a plain nullable `uuid` column without a foreign key until `cohorts`
  exists (tracked as `TODO(E2-T3)` in the entity).
- UI copy and API messages are in Vietnamese. Code comments are mixed: older files use Vietnamese,
  newer ones English. This README is English; `frontend/src/components/README.md` is Vietnamese.
