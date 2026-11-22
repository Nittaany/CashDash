# CashDash — Full-Stack Expense Ledger & Group Debt Settlement

[![CI](https://github.com/Nittaany/CashDash/actions/workflows/ci.yml/badge.svg?branch=v2)](https://github.com/Nittaany/CashDash/actions/workflows/ci.yml)
![Node 22](https://img.shields.io/badge/node-22-brightgreen)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://cash-dash-one.vercel.app)

> **TL;DR.** CashDash is a personal wallet plus a group expense splitter that settles debts in `NPR`, `INR` or `USD`.
> v2 is a ground-up rebuild of my v1 coursework project. Before writing any code I audited v1 line by line and
> logged 24 concrete risks (money drift, missing security boundary, race conditions, no tests, expiring hosting).
> v2 closes or deliberately removes each one: an Express 5 / Mongoose 8 API, integer money math, MongoDB transactions,
> rotating `HttpOnly` refresh cookies, a React 19 + Vite client, multi-stage Docker images, and a GitHub Actions pipeline,
> deployed live on Vercel, Render and MongoDB Atlas.
>
> Measured at commit `7787855` (23 Nov 2026): **180 server tests, 66 client tests, 0 secret leaks**, server coverage **90.63% statements / 90.99% lines**.

---

## Live Demo and 30-Second Walkthrough

**App:** https://cash-dash-one.vercel.app  
**API health:** https://cashdash-api.onrender.com/api/health

1. Click **Try Instant Demo**. It creates a private, pre-seeded sandbox user with a sample *Pokhara Weekend Trip* group. No signup.
2. On `/expenses` add and delete an expense and watch the wallet change. Then open the trip group, record an expense or a settlement, and export the CSV.
3. Hard-refresh (`Cmd+R`) on `/dashboard`. The page reloads on the same route and you stay signed in: the Vercel SPA fallback works, and the session survives through a first-party `HttpOnly` cookie.

Demo data carries a 2-hour TTL and is deleted by MongoDB itself. The Render free tier sleeps after about 15 minutes idle, so the first request can take 30 to 50 seconds. The client calls `/api/health` on load and shows a "Waking server…" state instead of a dead page.

---

## At a Glance

| | |
|---|---|
| **Author** | Satyam Chaudhary ([@Nittaany](https://github.com/Nittaany)) |
| **Architecture** | SPA on Vercel, same-origin `/api` rewrite to a Dockerized Express API on Render, MongoDB Atlas replica set |
| **Frontend** | React 19, Vite 6, Tailwind CSS 3, Vitest 5 |
| **Backend** | Node 22, Express 5, Mongoose 8, Zod 4, Vitest + Supertest + `mongodb-memory-server` |
| **Database** | MongoDB Atlas M0 (replica set, so multi-document transactions work) |
| **Auth and security** | bcryptjs on the server, JWT (HS256 pinned), SHA-256-hashed rotating refresh token in an `HttpOnly` cookie, email verification flow, password reset with hashed single-use tokens, Helmet defaults, CORS allowlist, rate limits, Zod validation |
| **Cloud and DevOps** | Multi-stage Dockerfiles, Compose with a self-initialising replica set, GitHub Actions (4 jobs), gitleaks, `render.yaml`, `client/vercel.json` |
| **Verification** | 180 server + 66 client tests, 106 kB JS / 4.3 kB CSS gzip, CI green on `v2` |

---

## Origin and Forensic Audit

**v1 deserves its own credit.** It is a Cloud and DevOps coursework project: a React + Supabase app deployed through a Dockerized Jenkins server to AWS S3 and CloudFront. Its report records manual deploys of 15 to 20 minutes falling to 3 to 5 minutes automated, and load times of 2.5 to 3.2 s improving to 1.1 to 1.6 s behind CloudFront. Those figures are self-reported in the course report; the AWS account has since been deleted, so I can no longer reproduce them. v1 is preserved unchanged on the [`v1` branch](https://github.com/Nittaany/CashDash/tree/v1).

v1 was never meant to hold other people's money. When I wanted to show it publicly I audited it file by file and logged **24 risks (S1 to S20 for the application, D1 to D4 for delivery)**. Patching on top of a thick client that writes balances straight from the browser would have kept the structural problems, so I rebuilt around five themes.

| # | Failure mode in v1 | Why it matters | v2 fix |
|---|---|---|---|
| 1 | Money logic in the browser: float splits (`₹100 / 3` lost a paisa), wallet and expense written in separate calls, N+1 debt updates that could double-count, debts left behind when an expense was deleted | Balances silently disagree with the ledger | Integer minor units (`splitCalculator.js`), MongoDB transactions, balances derived on read from immutable records (`debtSimplifier.js`) |
| 2 | No backend boundary: a bcrypt hash written to a `profiles` table from the browser, whole-table queries for every user, CSV export of everyone's rows | One global user pool and no enforceable authorization | Server-only auth, membership-scoped groups, group-scoped CSV with formula-injection neutralisation |
| 3 | Reliability and UX: fixed `setTimeout` loaders, spinners that never cleared after an early `return`, redirect races on refresh, mismatched mobile and desktop routes | Real failures looked like hangs | Async state with error paths, `ProtectedRoute` plus a silent session refresh, one route table |
| 4 | No verification gate: the only test was the CRA placeholder, `CI=false` hid build warnings, `NODE_ENV=production` before `npm install` skips dev dependencies | Nothing stopped a bad change shipping | Tests, `npm audit`, gitleaks and Docker builds on every push and PR |
| 5 | Hosting and auth tied to a deleted AWS account and hard-coded Vercel redirect URLs | The project could not be shown, and a split frontend/backend breaks third-party cookies | Vercel, Render and Atlas with a same-origin proxy; env-driven origins and cookie flags |

<details>
<summary><strong>Audit closure matrix (24 risks, with honest status)</strong></summary>

"Removed" means the feature no longer exists, so the risk is gone but the capability is too.

| ID | v1 risk | Status | How |
|---|---|---|---|
| S1 | Browser-side bcrypt hash stored in `profiles.password` | Closed | Hash is computed server-side; `passwordHash` is `select: false` |
| S2 | No RLS in the repo, whole-table reads | Closed by design | No browser database access; all reads go through authorised routes |
| S3 | CSV export leaked all users' expenses | Closed | `GET /api/groups/:id/export.csv` requires membership |
| S4 | Group expense = N+1 non-atomic writes | Closed | A group expense is one document; balances are not stored |
| S5 | Possible double-counted debts (RPC plus fallback insert) | Closed | No mutable debt rows to double-count |
| S6 | Deleting an expense left debts; "Paid" deleted the debt with no record | Closed | Balances recompute after delete; settlements are immutable records |
| S7 | Wallet read-modify-write lost updates | Closed | Transaction plus a conditional `$inc` |
| S8 | Float money, lost paisa | Closed | Integer minor units, remainder distributed deterministically |
| S9 | Netting double-counted and was only pairwise | Closed | Net per user, greedy largest-debtor / largest-creditor matching |
| S10 | Stale participant values, no `amount > 0` check | Closed | `calculateSplits` rejects stale, non-integer and non-positive input |
| S11 | Infinite spinners after early returns | Closed by rewrite | New async state with error paths |
| S12 | Broken UPI deep links (malformed Android intent string) | Closed | Valid encoded `upi://pay` URI with client-side QR generation via `qrcode.react`; zero storage/upload risk |
| S13 | QR preview not reloaded after upload | Closed | Client-side QR modal generates dynamic QR from `paymentHandle` + owed amount; no public file upload |
| S14 | Register wrote profile rows unauthenticated, errors ignored | Closed | One server-side register creates one `User` document |
| S15 | Reset page treated any session as recovery | Closed | Server-side password reset with SHA-256 hashed 15-min single-use tokens; revokes active refresh session; email delivery via Resend API or mock transport |
| S16 | Supabase URL and anon key committed | Closed | History rewritten, env-validated config, gitleaks in CI |
| S17 | Hard-coded Vercel redirect URLs | Closed | Origins come from `CLIENT_URL` |
| S18 | Confusable, unversioned table names | Closed | Five Mongoose models with explicit schemas |
| S19 | `alert()`, fake delays, dead code | Closed | No `alert()` or artificial delays; native `confirm()` prompts replaced with accessible `ConfirmModal` component |
| S20 | Route races, mobile/desktop nav mismatch | Closed | `ProtectedRoute`, silent refresh, one route table |
| D1 | No test gate, `CI=false`, hard-coded IDs, deleted infra | Closed | CI gates, parameterised Jenkins, new hosting |
| D2 | Missing `tailwindcss`, Node-only packages, peer-dependency conflicts | Closed | Vite, trimmed dependencies |
| D3 | Four project names | Closed | One name: CashDash |
| D4 | Sitemap with wrong and auth-gated routes | Not applicable | v2 is an authenticated web application, not a public marketing site; no crawlable public routes exist |

</details>

---

## System Architecture and Module Map

### Production request flow

```text
 Browser (React 19 SPA)
  - access token kept in memory only; refresh token is an HttpOnly cookie JS cannot read
  - GET /api/health on load; shows "Waking server…" while Render wakes up
        |  same-origin requests to https://cash-dash-one.vercel.app
        v
 Vercel  (client/vercel.json)
  - /api/:path*  -> rewrite to the Render API host   (the browser still sees one origin)
  - /(.*)        -> /index.html                       (SPA fallback: deep links and refresh work)
        |  proxied request
        v
 Render web service  (server/Dockerfile: node:22-alpine, non-root, TRUST_PROXY=2)
  helmet -> CORS allowlist (CLIENT_URL) -> express.json(10kb) -> cookie-parser -> rate limiter
  routers : /api/auth  /api/wallet  /api/expenses  /api/groups  /api/health
  per route: authenticate (JWT, HS256 pinned)  +  validate (Zod, results in req.validated)
  services : splitCalculator  debtSimplifier  demoSeed        (money logic: no DB imports)
  errors   : errorHandler (AppError, Zod, Mongoose, duplicate key, malformed JSON, 404)
        |  Mongoose
        v
 MongoDB Atlas M0 (replica set)
  - session.withTransaction(): expense + wallet, settlement + Group.settlementVersion
  - TTL index on expiresAt, set only on demo-owned documents
```

### Local parity and CI

```text
 docker compose up --build                       GitHub Actions (.github/workflows/ci.yml)
 ------------------------------                  -------------------------------------------------
 client  nginx   :8080  --/api--> server         secret-scan  (gitleaks, full history)
 server  express :5001 (container :5000)         server-test  (npm test, npm audit)
 mongo   replica set rs0 (--replSet)             client-test-build (npm test, npm run build)
 mongo-init  one-shot rs.initiate (idempotent)   docker-build (both images)
```

### Module map

| Path | Responsibility |
|---|---|
| `server/src/config/env.js` | Zod-validated environment; fails fast, including a strict `CLIENT_URL` origin list |
| `server/src/app.js` | Middleware order, CORS allowlist, trust proxy, global rate limit, routers |
| `server/src/middleware/auth.js` | JWT verification (HS256 pinned) and the `expiryFor(user)` TTL helper |
| `server/src/middleware/` | `validate.js` (Zod to `req.validated`), `errorHandler.js`, `rateLimit.js` |
| `server/src/models/` | `User`, `PersonalExpense`, `Group`, `GroupExpense`, `Settlement` |
| `server/src/services/splitCalculator.js` | Equal / exact / percent splits in integer minor units; sum always equals the total |
| `server/src/services/debtSimplifier.js` | Net balance per user, then greedy matching into the fewest simple transfers |
| `server/src/services/demoSeed.js` | Ephemeral demo user and sample data with relative dates |
| `server/src/routes/` | `auth`, `wallet`, `expenses`, `groups` routers |
| `client/src/` | Pages, `AuthContext` (silent refresh), API client (one retry after 401), `ProtectedRoute`, `ErrorBoundary`, currency utilities |
| `docker-compose.yml` | Client, server, Mongo and a replica-set initialiser |
| `render.yaml`, `client/vercel.json` | Backend blueprint; frontend rewrites |
| `.github/workflows/ci.yml`, `.gitleaks.toml` | CI jobs; secret-scan config (test fixtures allowlisted) |
| `infra/jenkins/` | Jenkins reference files (see the DevOps section) |

---

## Engineering Process

### Sprint log

Built iteratively across four specification-driven sprints, with each sprint audited against the codebase, automated tests, and security checks before moving on.

| Sprint | What shipped | Evidence |
|---|---|---|
| 0 | Forensic audit of v1; history scrubbed of committed credentials; v1 preserved on its own branch | The audit register above |
| 1 | Express / Mongoose / Zod core, integer `splitCalculator`, greedy `debtSimplifier`, unit tests | `b356ef5`; Zod 4 upgrade after an `npm audit` advisory (`149bb0c`) |
| 2 | Transactional wallet and expense APIs, scoped groups, settlements, rotating auth, CSV export, integration and concurrency tests | `b64061f`; refresh-token fix in `bbd1b68` |
| 2.1 | Review-driven tests and fixes, gitleaks config, coverage | `dd97583`, `b0656a9` |
| 3 | Vite + React 19 + Tailwind client, locale-aware money formatting, client tests | `6724610`, `d3eee83` |
| 4 | Dockerfiles, replica-set Compose, CI, Render and Vercel deploy, demo-data safety, live wiring | `b15e4eb`, `eb7e9e4`, `c924d7d`, `1f78a88`, `5bb1992`, `edee2b7` |
| 5 | Password reset (SHA-256 hashed 15-min single-use tokens), dynamic UPI QR (client-side generation), accessible `ConfirmModal`, X-Request-Id observability | `20dc29f` |
| 6 | Email verification flow, Resend mailer adapter, safe group member removal, expense pagination, compound indexes for 10k-user scale | `feat/sprint-6-scale-and-mailer` |

### Hardening amendments: what changed and why

These came out of audit rounds, not from a first draft.

| Area | First version | Amendment | Why |
|---|---|---|---|
| Refresh tokens | A `tokenVersion` field in the payload | A random `jti` (`crypto.randomUUID()`); the server stores a SHA-256 hash of the token and compares with `crypto.timingSafeEqual` | JWTs sign `iat` in whole seconds. A login and refresh in the same second produced a byte-identical token, so "rotation" rotated nothing. A test now refreshes twice and expects the old cookie to be rejected |
| Cookies across two hosts | Cross-origin API calls and a `sameSite` ternary on `NODE_ENV` | Vercel rewrites `/api/*` to Render, so the browser sees one origin. Cookie flags come from `COOKIE_SECURE` and `COOKIE_SAMESITE` (live: `Secure; HttpOnly; SameSite=Lax; Path=/api/auth`), and `TRUST_PROXY=2` counts both proxies | Safari and Chrome increasingly block third-party cookies, and `SameSite=None` or `localStorage` tokens would weaken security |
| Concurrent settlements | Read the debt, check it, insert | Inside `session.withTransaction()` the code does `$inc: { settlementVersion: 1 }` on the `Group` first | Two parallel requests wrote different documents, so MongoDB saw no conflict. The shared counter forces one to retry and then fail validation |
| Startup config | Lenient string for `CLIENT_URL` | A Zod refinement: comma-separated `http(s)` origins, no path, no trailing slash | The browser sends `https://x.app`, never `https://x.app/`, so a stray slash silently breaks CORS |
| Demo blast radius | One shared demo account | One ephemeral user per visit; `expiryFor(user)` copies the owner's expiry onto every record they create, and only for demo owners; TTL tests assert real users never get `expiresAt`; demo users cannot add members; add-member answers `Invitation sent` whether or not the email exists; an expired session redirects to login with "Demo session ended" | Anyone can mint a demo user, which could otherwise fill the 512 MB free database, and unconditional TTLs could delete real data |
| Express 5 and toolchain | `req.query = parsed` in the validator | Validators write to `req.validated`; Node 22 aligned across CI, Dockerfiles and `engines`; `wget` healthchecks on Alpine; Vitest 5; local API on host port `5001` | In Express 5 `req.query` is read-only; Alpine has no `curl`; macOS AirPlay Receiver holds port 5000 |

---

## Cloud and DevOps Evolution (v1 → v2 → v3)

### v1: Cloud & DevOps Coursework (AWS S3 + CloudFront + Dockerized Jenkins)

v1 is a standalone Cloud & DevOps project: a React + Supabase app deployed through a Dockerized Jenkins server to AWS S3 and CloudFront. It proved the pipeline concept—automated builds, containerised CI, object storage plus a CDN—and cut deploy times from 15–20 min manual to 3–5 min automated (self-reported in the course report; AWS account since deleted). v1 is preserved on the [`v1` branch](https://github.com/Nittaany/CashDash/tree/v1).

### v2: Portable Full-Stack + Docker + CI/CD (Current, ~100–1,000 Users)

v2 is a full-stack application designed to run identically anywhere:

| Capability | Implementation |
|---|---|
| **Container portability** | `docker compose up --build` runs the full stack locally: `client` (Nginx on `:8080`), `server` (Node 22 on `:5001`), and an auto-initialized MongoDB replica set for ACID transactions |
| **4-job GitHub Actions CI** | `gitleaks` secret scan, server tests + `npm audit`, client tests + production build, Docker image builds—all run on every push and PR |
| **Zero-cost production hosting** | Vercel Edge (SPA + same-origin `/api/*` proxy), Render Docker (Express API), MongoDB Atlas M0 (replica set)—permanent free tiers with declarative `render.yaml` and `client/vercel.json` |
| **Frontend observability** | Vercel Analytics integrated for page-view and performance metrics |
| **Cloud portability** | The same Docker images can deploy to any VM, AWS ECS, GCP Cloud Run, or self-hosted Kubernetes with a config change |

**Sized for:** Small-to-mid teams (~100–1,000 active users). Single API instance, in-process rate limiting, and derived-on-read balances are correct and simple at this scale.

### v3 Vision: Horizontal Scale (100,000 Users)

v2 intentionally avoids premature distributed complexity. The clean service boundaries (`splitCalculator.js`, `debtSimplifier.js`, `auth.js`) are ready for horizontal scaling when needed. A future v3 would add:

| Challenge at scale | v3 approach |
|---|---|
| **Stateless horizontal API instances** | Move session/token stores to Redis; API containers become interchangeable |
| **Shared rate limiting** | Redis-backed rate limiter (`express-rate-limit` + `rate-limit-redis`) works across instances |
| **High-volume groups** | Materialized balance snapshots or read models computed by background jobs, refreshed on expense/settlement events |
| **Background job queues** | Email delivery (password reset, notifications), PDF/CSV export for large groups, cleanup tasks |
| **Observability & IaC** | Structured logging, distributed tracing, Terraform/Pulumi for infra-as-code |

**v2 keeps the architecture ready** without building v3 infrastructure prematurely.

### v1 → v2 Feature Comparison

| Feature | v1 | v2 |
|---|---|---|
| **Auth** | Supabase Auth (email/password) | Server-side bcrypt + JWT + rotating refresh tokens |
| **Email verification** | Supabase-managed | Server-side SHA-256 hashed 24h tokens |
| **Password reset** | Supabase-managed | Server-side SHA-256 hashed 15min single-use tokens |
| **Demo mode** | — | 1-click instant demo with 2h TTL auto-cleanup |
| **Multi-currency** | — | NPR, INR, USD with locale-aware formatting |
| **Rate limiting** | — | Per-route rate limits (auth, general) |
| **UPI payments** | Broken intent URLs, public QR uploads | Valid `upi://pay` URI, client-side QR (zero storage risk) |
| **Expense filtering** | — | Category, payment mode, date filters |
| **Group member removal** | — | Safe removal (requires 0 balance) |
| **Expense pagination** | — | Server-side pagination (default 20, max 100) |
| **Observability** | — | X-Request-Id, structured JSON logging, Vercel Analytics |
| **Tests** | CRA placeholder | 175 server + 58 client tests (91% coverage) |
| **CI/CD** | Jenkins to S3 | GitHub Actions (4 jobs), Docker builds |
| **Email delivery** | — | Resend API adapter (mock transport for dev/test) |

**15+ additional features** in v2 beyond v1 parity.

### v1 → v2 Infrastructure Comparison

| | v1 (AWS and Jenkins coursework) | v2 (this repo) |
|---|---|---|
| Scope | React static build | SPA, REST API and database |
| Containers | Jenkins server only | Multi-stage client (nginx) and server (non-root Node) images; Compose with a self-initialising replica set |
| Gates | Build and deploy | gitleaks, server and client tests, `npm audit`, production build, Docker image builds |
| Hosting | AWS S3 and CloudFront (account since deleted) | Vercel, Render and Atlas M0, declared in `client/vercel.json` and `render.yaml` |
| Cost model | Free-tier AWS sandbox | Permanent free tiers; the same images can move to an always-on VM |

**About `infra/jenkins/`.** The v1 pipeline (checkout, install, build, `aws s3 sync --delete`, CloudFront invalidation) is preserved on the `v1` branch, with the committed credential ID redacted. The `Jenkinsfile` in this branch is a *different* pipeline: it takes a repository URL parameter and runs server install and test, client install, test and build, and Docker image builds. It has no AWS deploy stage. `Dockerfile.jenkins` is a **reconstruction** (a `jenkins/jenkins:lts` image for Jenkins builds); the original `jenkins-aws-arm` file was not recovered. Neither has been executed since the AWS account was removed.

---

## Tests, Benchmarks and API

### What the suites cover

- **Money math** (`server/tests/unit/splitCalculator.test.js`): `10000` split three ways gives `3334 / 3333 / 3333`, percent rounding, exact-share validation, stale participants, zero and negative amounts.
- **Debt simplification** (`debtSimplifier.test.js`): mutual cancellation, transitive chains, partial settlements, conservation of total net balance.
- **Config and abuse controls** (`env.test.js`, `rateLimit.test.js`, `integration/cors.test.js`): strict `CLIENT_URL` parsing, a limiter built with `max: 3` returning 429, multi-origin CORS allowlist.
- **Transactions and concurrency** (`integration/walletAndExpenses.test.js`): atomic create and delete, insufficient-balance rollback, 10 parallel `100` expenses on a `500` wallet produce exactly 5 successes and a final balance of 0.
- **Auth and groups** (`integration/auth.test.js`, `groupsAndSettlements.test.js`, `demoRestrictions.test.js`): refresh-token reuse rejected, cross-group delete returns 404, settlement by a non-party blocked, settlement concurrency, CSV neutralisation.
- **Demo safety** (`integration/ttl.test.js`): demo records expire, normal records never get `expiresAt`.
- **Client** (`client/src/tests/`, 7 files): `AuthContext` silent refresh, API client single retry after a 401, `ProtectedRoute`, login and register flows, group expense form totals, currency round-trips.

### Reproducible results

Measured at commit `7787855` (23 Nov 2026):

| Command | Result |
|---|---|
| `cd server && npm test` | 180 tests passing (36s) |
| `cd server && npm run test:coverage` | 90.63% statements / 90.99% lines |
| `cd client && npm test` | 66 tests passing |
| `cd client && npm run build` | 106 kB JS and 4.3 kB CSS gzip |
| `gitleaks detect --source . --verbose` | 0 leaks |

### API surface

| Group | Purpose |
|---|---|
| `GET /api/health` | Database state and uptime |
| `/api/auth/*` | Register, login, refresh, logout, demo, profile, password reset, email verification |
| `/api/wallet/*` | Balance with monthly summary and category breakdown, top-up |
| `/api/expenses/*` | Personal expenses with atomic wallet debit and refund |
| `/api/groups/*` | Groups, members, expenses, settlements, summary (paginated), CSV export |

<details>
<summary><strong>Full API reference (28 endpoints)</strong></summary>

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/auth/register` | POST | Create an account; sends verification email |
| `/api/auth/login` | POST | Log in; sets the refresh cookie |
| `/api/auth/refresh` | POST | Rotate the refresh token, issue a new access token |
| `/api/auth/logout` | POST | Invalidate the refresh token |
| `/api/auth/demo` | POST | Create an ephemeral demo account (auto-verified) |
| `/api/auth/me` | GET | Current profile |
| `/api/auth/me` | PATCH | Update profile (allow-listed fields only) |
| `/api/auth/forgot-password` | POST | Request password reset email |
| `/api/auth/reset-password` | POST | Reset password with token |
| `/api/auth/verify-email` | POST | Verify email with token |
| `/api/auth/resend-verification` | POST | Resend verification email |
| `/api/wallet` | GET | Balance, monthly summary, and category breakdown |
| `/api/wallet/topup` | POST | Add funds |
| `/api/expenses` | GET | List (filters and pagination) |
| `/api/expenses` | POST | Create; debits the wallet in one transaction |
| `/api/expenses/:id` | DELETE | Delete; refunds in one transaction |
| `/api/groups` | GET | The caller's groups |
| `/api/groups` | POST | Create a group |
| `/api/groups/:groupId/members` | POST | Add a member by email |
| `/api/groups/:groupId/members/:memberId` | DELETE | Remove a member (safe: requires 0 balance) |
| `/api/groups/:groupId/summary` | GET | Net balances and simplified transfers (paginated expenses) |
| `/api/groups/:groupId/expenses` | POST | Create a group expense |
| `/api/groups/:groupId/expenses/:expenseId` | DELETE | Delete (payer or group creator) |
| `/api/groups/:groupId/settlements` | POST | Record a settlement |
| `/api/groups/:groupId/export.csv` | GET | CSV export |
| `/api/groups/:groupId/balances.csv` | GET | Net balances and simplified transfers CSV |

</details>

---

## Quick Start

**Option A: whole stack in one command**

```bash
docker compose up --build
```

UI at `http://localhost:8080`, API at `http://localhost:5001`. A single-node MongoDB replica set is initialised for you, because transactions need one.

**Option B: local development**

```bash
# server (port 5001): copy server/.env.example to server/.env, set MONGODB_URI (Atlas M0 or a local
# replica set) and two JWT secrets of at least 32 characters
# Optional: RESEND_API_KEY for real email delivery, REQUIRE_EMAIL_VERIFICATION=true to enforce
cd server && npm install && npm run dev

# client (port 3000)
cd client && npm install && npm run dev
```

---

## Architecture Tradeoffs & Planned Upgrades

### Current Tradeoffs (Intentional for v2 Scale)

- **One active session per user.** Storing one hashed refresh token keeps revocation O(1) and simple. A new login signs out older devices. Multi-device session cap (5) is queued for the next feature pass.
- **Balances computed on read.** Eliminates drift from stale balance rows; correct and fast for normal groups. High-volume groups (thousands of expenses) would need materialized snapshots in v3.
- **Payments recorded, not processed.** UPI, eSewa, Fonepay, and cash are settled outside the app. Gateway webhooks would add external dependencies without core value at this scale.
- **Free-tier cold starts.** 30–50 s Render wake on idle. The same containers can move to an always-on host (AWS ECS, GCP Cloud Run, self-hosted VM) with a config change.
- **In-memory rate limiting.** Works correctly for a single API instance. Redis-backed limiter planned for v3 horizontal scaling.

### Next Feature Pass (v2.x)

| Feature | Why |
|---|---|
| Richer demo seeding | Multi-group, multi-currency, multi-month sample data for compelling first impression |
| E2E browser tests | Playwright or Cypress covering critical flows |
| UI polish + screenshots | README visuals, mobile responsiveness pass |
| Multi-device session cap | Allow up to 5 concurrent sessions per user |

---

## Branches

| Branch | Description |
|---|---|
| `v2` (default) | The full-stack application described here |
| `v1` | The standalone AWS and Jenkins Cloud and DevOps project |

---

## License

[MIT](LICENSE) © 2026 Satyam Chaudhary

---

<details>
<summary>Machine-readable metadata</summary>

```yaml
project: CashDash
version: 2.0.0
measured_at: 8f1baa9 (2026-11-23)
live_url: https://cash-dash-one.vercel.app
api_health: https://cashdash-api.onrender.com/api/health
stack:
  frontend: React 19, Vite 6, Tailwind CSS 3, Vitest 5
  backend: Node 22, Express 5, Mongoose 8, Zod 4
  database: MongoDB Atlas M0 (replica set)
  auth: JWT access token + rotating hashed refresh cookie (HttpOnly, Secure, SameSite=Lax)
  devops: Docker multi-stage, Docker Compose, GitHub Actions (4 jobs), Vercel, Render
tests: { server: 145, client: 47 }
coverage: { statements: 92.33, splitCalculator: 94.84, debtSimplifier: 94.31 }
bundle_gzip_kb: { js: 96, css: 4 }
reproduce:
  full_stack: docker compose up --build
  server_test: cd server && npm test
  client_test: cd client && npm test
  secret_scan: gitleaks detect --source . --verbose
```

</details>
