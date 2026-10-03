# UniPrep

**UniPrep – An Online Learning Platform.**

UniPrep is a learning platform whose long-term goal is *Learning Analytics and early warning*:
dashboards for learning behaviour and results, detection of learners at risk of falling behind,
and explainable interventions for teachers. The LMS itself (courses, lessons, materials, quizzes,
progress tracking) is the source of the behavioural data that feeds analytics. Lesson content is
text, slides and video — the platform is not tied to any particular subject.

> **Status: foundation (E0) and authentication (E1) done, business modules not started.** The database
> schema is defined by entities + migrations (25 core tables plus `password_reset_tokens`), a
> reproducible seed fills it with demo data, authentication/RBAC protects every route, and CI lints,
> builds and verifies migrations. Course/lesson APIs, the queue and the AI service are **not
> implemented yet** — see [Roadmap](#roadmap).

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
| HTTP client | Axios | Thin wrapper in `frontend/src/config/query-method` — attaches the access token and retries once after a transparent refresh on `401` |
| Client state | Redux Toolkit + React context | Redux store holds the auth session; React context still owns the theme |
| Backend | NestJS 11 + TypeScript | Modular REST API, Swagger/OpenAPI docs |
| ORM / DB | TypeORM 0.3 + PostgreSQL 13+ | **`synchronize: false` everywhere** — the schema only changes through migrations (see [Database workflow](#database-workflow)) |
| Validation | `class-validator` / `class-transformer` | Global `ValidationPipe` with flattened error messages |
| Auth | Passport (`local` + `jwt`) + `@nestjs/jwt` | Access token 15 min, refresh token 7 days with rotation/revocation; `JwtAuthGuard` + `RolesGuard` registered globally |
| Password hashing | `bcryptjs` (cost 10) | Pure JS (no native build); used by the seed and by the auth module |
| Git hooks | husky + lint-staged (root `package.json`) | Lint/format only the staged files before each commit |
| CI/CD | GitHub Actions | CI on push/PR, deploy through a self-hosted Windows runner |

Planned but not present yet: Redis + BullMQ (AI job queue) and an independent FastAPI (Python)
inference service.

---

## Repository layout

```
UniPrep/
├── package.json             root scripts + husky/lint-staged (NOT npm workspaces)
├── lint-staged.config.mjs   per-package lint/format commands for staged files
├── .husky/pre-commit        runs `npx lint-staged`
├── backend/                 NestJS API
│   ├── src/
│   │   ├── auth/            register/login/refresh/logout/password flows, Passport strategies,
│   │   │                    token service, auth DTOs, entities (refresh/reset tokens)
│   │   ├── user/            user service/controller/mapper (E1: profile by id + status change)
│   │   ├── common/          response envelope, exception filter, base entity, union types,
│   │   │                    guards (@Public/@Roles/@OwnResource), pipes, validators, transformers
│   │   ├── config/          Swagger config shared by `main.ts` and the OpenAPI export script
│   │   ├── database/        data-source.ts (TypeORM CLI) + migrations/ + seeds/
│   │   ├── health/          GET /api/health (pings the database)
│   │   ├── <domain>/entities/  one folder per future module (course, lesson, exercise,
│   │   │                       discussion, learning-activity, analytics, ai-gateway,
│   │   │                       intervention, notification, admin)
│   │   ├── app.module.ts    config + TypeORM wiring, global guards, feature module imports
│   │   └── main.ts          global prefix, CORS, pipes, Swagger bootstrap
│   └── .env.example         copy to .env and fill in
├── frontend/                React SPA
│   ├── src/
│   │   ├── apis/            one folder per feature, wraps queryMethod
│   │   ├── components/      shared UI kit (see components/README.md)
│   │   ├── config/          axios wrapper (+ token refresh interceptor), antd theme, sidebar menu
│   │   ├── contexts/        theme provider + auth provider (hydrates the session)
│   │   ├── layouts/auth/    public shell for login/register/forgot/reset
│   │   ├── layouts/private/ Header + Sider + <Outlet /> (role-filtered menu)
│   │   ├── mocks/           temporary mock data (courses)
│   │   ├── pages/           one folder per route (auth/* for the sign-in flow)
│   │   ├── routes/          createBrowserRouter route table + ProtectedRoute
│   │   ├── store/           Redux Toolkit store (auth slice) + typed hooks
│   │   ├── styles/          M3 tokens, scrollbar, table, editor CSS
│   │   ├── types/           shared domain types
│   │   └── utils/           lazy(), token storage helpers
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
npm run migration:run     # creates the 25 core tables + password_reset_tokens (and drops legacy `students`)
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

Opening `http://localhost:5173` while signed out redirects to `/login`. Sign in with one of the
seeded demo accounts (password = `SEED_DEMO_PASSWORD` in `backend/.env`, default `UniPrep@2026`):

| Account | Role |
|---|---|
| `hocvien@uniprep.test` | student |
| `giangvien1@uniprep.test`, `giangvien2@uniprep.test` | teacher |
| `admin@uniprep.test` | admin |

The session (access + refresh token + profile) is kept in `localStorage` under `uniprep.auth` and
restored on reload; an expired access token is refreshed in the background without kicking you out
of the page. `POST /api/auth/forgot-password` prints the one-time reset link to the backend log
(there is no mail module yet).

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

**Authentication:** every route requires `Authorization: Bearer <accessToken>` unless it is marked
`@Public()`. Public routes are exactly: `GET /api`, `GET /api/health`, `POST /api/auth/register`,
`POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/forgot-password`,
`POST /api/auth/reset-password`.

| Aspect | Behaviour |
|---|---|
| Access token | JWT (HS256, `JWT_SECRET`), 15 min (`JWT_ACCESS_TTL`), claims `sub`/`email`/`role`/`type='access'` |
| Refresh token | JWT as well, 7 days (`JWT_REFRESH_TTL`), claims `sub`/`familyId`/`jti`/`type='refresh'`; only a SHA-256 hash is stored in `refresh_tokens` |
| Rotation | `POST /api/auth/refresh` revokes the presented token and issues a new pair; replaying a **rotated** token returns `401` and revokes every session of that user |
| Logout | `POST /api/auth/logout` revokes the given refresh token, or **all** sessions when none is sent; idempotent |
| Roles | `@Roles('admin')` etc. — `RolesGuard` runs globally; a wrong role is `403` |
| Ownership | `@OwnResource('id')` + `OwnershipGuard` reject reading another user's data with `403` (anti-IDOR) |
| Account status | `pending`/`active`/`suspended`/`disabled` plus a 15-minute temporary lock after 10 failed logins; the reason is returned as a specific Vietnamese `403` message |
| Password policy | 8–16 chars with upper, lower, digit and special character — identical regex/messages on both sides (`PasswordInput.tsx` ↔ `@IsStrongPassword()`) |
| Password reset | One-time token in `password_reset_tokens` (30 min, `PASSWORD_RESET_TTL`); in dev the link is written to the server log (`MailService`) |

**Current endpoints:** `GET /api`, `GET /api/health`, the 8 `/api/auth/*` routes above plus
`GET /api/users/:id` (self or admin) and `PATCH /api/users/:id/status` (admin only). The reference
`student` CRUD module was removed together with its legacy `students` table — the real schema uses
`users` + `enrollments`. `npm run openapi:export` reports the exact path count.

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
6. **Sessions live in Redux + `localStorage`, never in a component.** Read the session through
   `useAuth()` (`contexts/auth-context`) and let the axios wrapper attach the token — pages must not
   touch `localStorage` or build `Authorization` headers themselves. Every API error goes through
   `getApiErrorMessage(error)` so the Vietnamese `message` from the envelope is shown as-is.
7. **A route that only some roles may open wraps its children in
   `<ProtectedRoute allowedRoles={[...]} />`** and its menu entry declares the same `roles` in
   `config/sider-options`. The guard is UX only — the backend guard remains the real check.

Formatting: `.prettierrc` (tabs, single quotes, trailing commas) applies to the frontend too, and
the pre-commit hook runs `eslint --fix` + `prettier --write` on staged files.

---

## Routes

| Path | Page | Access | Data source |
|---|---|---|---|
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Auth pages (`layouts/auth`, single column) | Public | `apis/auth` |
| `/` | My courses | Any signed-in role | `mocks/course.ts` (mock — to be replaced by the real catalog API in E3-T6) |
| `/courses/:courseId` | Course content | Any signed-in role | `mocks/course.ts` (mock) |
| `*` | Not found | Any signed-in role | — |

Any other path while signed out redirects to `/login?redirect=<original path>`, and the original path
is restored after a successful sign-in.

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
- [x] **Auth & RBAC** — `AuthModule`/`UserModule`, JWT access + refresh with rotation, Passport
      `local`/`jwt` strategies, global `JwtAuthGuard` + `RolesGuard`, anti-IDOR `OwnershipGuard`,
      account status management, forgot/reset/change password.
- [x] **Client state store** — Redux Toolkit store (`src/store/`) holds the session; `AuthProvider`
      hydrates it from `localStorage` and the axios interceptor refreshes tokens transparently.
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

- Every endpoint except the public list above requires a token; authorization is enforced in the
  services/guards, not only in the UI.
- No test suite yet (deferred by decision on 2026-10-03); the CI `test` job is not present.
- IP-based rate limiting (`429`) is not implemented — only the per-account login lockout is; the IP
  part is deferred to E13-T4.
- The dev password-reset email is a server log line, not a real email (no mail module yet).
- Course pages read mock data.
- `risk_feature_contributions`, `course_instructors`, `cohorts` and the two analytics materialized
  views are **not** in the baseline migration — the epics that need them (E8, E9, E2/E3) add their own
  migrations.
- `enrollments.cohort_id` is a plain nullable `uuid` column without a foreign key until `cohorts`
  exists (tracked as `TODO(E2-T3)` in the entity).
- UI copy and API messages are in Vietnamese. Code comments are mixed: older files use Vietnamese,
  newer ones English. This README is English; `frontend/src/components/README.md` is Vietnamese.
