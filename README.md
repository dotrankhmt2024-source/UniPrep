# UniPrep

**UniPrep – An Online Learning Platform.**

UniPrep is a learning platform whose long-term goal is *Learning Analytics and early warning*:
dashboards for learning behaviour and results, detection of learners at risk of falling behind,
and explainable interventions for teachers. The LMS itself (courses, lessons, materials, quizzes,
progress tracking) is the source of the behavioural data that feeds analytics. Lesson content is
text, slides and video — the platform is not tied to any particular subject.

> **Status: early scaffold.** The business backend exposes a reference CRUD module and a health
> check; the frontend has a design-system foundation, a private layout and three pages (two of them
> still mock-driven). Authentication, course/lesson APIs, the queue and the AI service are **not
> implemented yet** — see [Roadmap](#roadmap).

---

## Table of contents

- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [API conventions](#api-conventions)
- [Frontend conventions](#frontend-conventions)
- [Routes](#routes)
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
| ORM / DB | TypeORM 0.3 + PostgreSQL | `synchronize: true` in dev (no migrations yet) |
| Validation | `class-validator` / `class-transformer` | Global `ValidationPipe` with flattened error messages |
| CI/CD | GitHub Actions | CI on push/PR, deploy through a self-hosted Windows runner |

Planned but not present yet: Redis + BullMQ (AI job queue), an independent FastAPI (Python)
inference service, JWT/Passport auth with RBAC.

---

## Repository layout

```
UniPrep/
├── backend/                 NestJS API
│   ├── src/
│   │   ├── common/          response envelope, exception filter, base entity
│   │   ├── health/          GET /api/health (pings the database)
│   │   ├── student/         reference CRUD module (entity, DTO, service, controller)
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
└── .github/workflows/       ci.yml, deploy.yml
```

---

## Prerequisites

- **Node.js 20+** (CI uses Node 24) and npm
- **PostgreSQL 14+**, running locally, with an empty database created:

  ```sql
  CREATE DATABASE uniprep;
  ```

- Windows only if you intend to use the scripts in `deploy/`.

---

## Getting started

### 1. Backend

```bash
cd backend
cp .env.example .env      # Windows: copy .env.example .env
npm ci
npm run dev               # nest start --watch
```

The API listens on `http://localhost:3000`, Swagger UI is served at
`http://localhost:3000/docs`. Tables are created automatically by TypeORM from the entities
(`synchronize: true`), so no migration step is required in development.

Other scripts: `npm run build`, `npm run prod` (runs `dist/main.js`), `npm run lint`
(ESLint with `--fix`), `npm test`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env      # Windows: copy .env.example .env
npm ci
npm run dev
```

The app runs on `http://localhost:5173`. Vite proxies `/api` to `http://localhost:3000`, so
requests work both with the absolute URL in `.env.example` and with a relative `/api` base URL.

Other scripts: `npm run build` (`tsc -b && vite build`), `npm run lint`, `npm run preview`.

### 3. Verify

```bash
curl http://localhost:3000/api/health
# {"error":false,"data":{"status":"ok","uptimeSeconds":12.3,"timestamp":"...","database":"up"},"message":"Thành công"}
```

A `database: "down"` value means the API process is up but the Postgres connection failed —
check the `DB_*` values in `backend/.env`.

---

## API conventions

**Base path:** every route is prefixed with `/api` (`app.setGlobalPrefix('api')`).

**Response envelope:** every response — success or failure — has the same shape, produced by
`TransformResponseInterceptor` and `AllExceptionsFilter`:

```jsonc
// success
{ "error": false, "data": { /* payload */ }, "message": "Thành công" }

// failure
{ "error": true, "data": null, "message": "Không tìm thấy sinh viên với ID ..." }
```

Failures keep their HTTP status code, but the body always carries a human-readable Vietnamese
`message`; the filter substitutes a sensible default when the exception has no message of its own.

**Validation:** a global `ValidationPipe` runs with `transform` and `whitelist` (unknown fields are
stripped). Validation errors are flattened to `"<field path>: <constraint message>"` strings, so a
DTO nested error surfaces as `profile.address: address should not be empty`.

**Reference module** — `student`:

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/students` | Create a student |
| `GET` | `/api/students` | List students (newest first) |
| `GET` | `/api/students/:id` | Student detail |
| `PATCH` | `/api/students/:id` | Partial update |
| `DELETE` | `/api/students/:id` | Delete |
| `GET` | `/api/health` | Liveness + database connectivity |

Entities extend `BaseEntityCustom`, which supplies a UUID `id` and the `created_at` / `updated_at`
`timestamptz` columns. Column names are declared explicitly as snake_case on every `@Column`
(`@CreateDateColumn({ name: 'created_at' })`, …) because the project does not register a
`SnakeNamingStrategy` — dropping `name` would make TypeORM emit camelCase columns and mix two naming
conventions in one schema.

> **If you already created tables with an older checkout**, `synchronize` may have produced camelCase
> `createdAt` / `updatedAt` columns. After pulling this change, check with `\d students`: if both
> spellings exist, drop the table and let `synchronize` recreate it (`DROP TABLE students;`). Only
> sample data is at risk.

---

## Frontend conventions

Read **`frontend/src/components/README.md` before writing any page.** The short version:

1. **Data flow is always `apis/<feature>` → `types/<feature>` → `pages/<feature>`.**
   `pages/student/index.tsx` is the reference implementation.
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
   Scrollbars are already styled globally; add `scrollbar-hidden` when you need scrolling without
   a visible bar.

---

## Routes

| Path | Page | Data source |
|---|---|---|
| `/` | My courses | `mocks/course.ts` (mock) |
| `/courses/:courseId` | Course content | `mocks/course.ts` (mock) |
| `/students` | Students | `GET /api/students` |

---

## CI/CD and deployment

**CI** (`.github/workflows/ci.yml`) runs on pushes and pull requests to `develop`, `main` and
`Thien_dev`, with a concurrency group that cancels superseded runs. Two jobs, each on Node 24:
frontend `npm ci → lint → build`, backend `npm ci → npx eslint "src/**/*.ts" → build`.

> The backend CI step deliberately calls `npx eslint` directly instead of `npm run lint`: that
> script targets `{src,apps,libs,test}/**/*.ts`, and the missing directories make ESLint 9 exit
> with code 2. CI must also report problems rather than auto-fix them.

**Deploy** (`.github/workflows/deploy.yml`) runs on pushes to `main` or manually via
`workflow_dispatch`, on the self-hosted Windows runner labelled `uniprep`. It deliberately does
**not** use `actions/checkout`, because the default `git clean -ffdx` would delete gitignored
runtime files (`.env`, `node_modules`, `dist`). Instead it calls `deploy/deploy.bat`, which:

1. stops the running services (`deploy/stop.ps1`, kills whatever listens on ports 3000/5173),
2. `git fetch` + `git checkout <branch>` + `git pull --ff-only` — this **refuses** instead of
   overwriting if the live tree has uncommitted changes,
3. `npm ci` + `npm run build` in `backend/`, `npm ci` in `frontend/`,
4. restarts both services detached (`deploy/start.vbs`), each with its own log file.

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

Ordered roughly by dependency. Nothing below exists in the codebase yet.

- [ ] **Client state store** — `@reduxjs/toolkit` + `react-redux` are installed, but `src/store/`
      does not exist yet. Create the store (`configureStore` + slices) with the first feature that
      needs state shared across pages (login/session).
- [ ] **Auth & RBAC** — `AuthModule`/`UserModule`, JWT access + refresh tokens, Passport
      strategies, `student` / `teacher` / `admin` roles, route guards.
- [ ] **Course domain** — `Course` / `Lesson` / `Exercise` entities and modules, replacing
      `frontend/src/mocks/course.ts` with a real `apis/course`.
- [ ] **Learning activity** — record behavioural events (lesson started, submission, time on task,
      attempts, recency) into `learning_events`.
- [ ] **Migrations** — replace `synchronize: true` with TypeORM migrations and a seed script.
- [ ] **Analytics** — aggregation endpoints (trends, cohort comparison) for the teacher dashboard.
- [ ] **AI service** — independent FastAPI service for at-risk prediction and result explanations,
      reachable only from the internal network.
- [ ] **Queue** — Redis + BullMQ so NestJS never blocks on a heavy inference job; job status
      returned by polling/callback/WebSocket.
- [ ] **Explainability & interventions** — persist `risk_score`, `risk_level`, feature
      contributions and the resulting intervention/audit trail.
- [ ] **Notifications** — in-app/email/WebSocket alerts when a learner is flagged.
- [ ] **Tests** — Jest is configured on the backend but there are no specs yet; add unit and e2e
      coverage for every new module.

---

## Known limitations

- No authentication or authorisation anywhere — every endpoint is public.
- No test suite, no lint/format pre-commit hook.
- `synchronize: true` is development-only; do not run it against production data.
- Course pages read mock data; `/students` falls back to a small in-file mock if the API call fails.
- UI copy and API messages are in Vietnamese. Code comments are mixed: older files use Vietnamese,
  newer ones English. This README is English; `frontend/src/components/README.md` is Vietnamese.
