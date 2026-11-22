# CashDash

**Full-Stack Expense Ledger & Group Debt Settlement**

[![CI](https://github.com/Nittaany/CashDash/actions/workflows/ci.yml/badge.svg?branch=v2)](https://github.com/Nittaany/CashDash/actions/workflows/ci.yml)
![Node 22](https://img.shields.io/badge/node-22-brightgreen)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://cash-dash-one.vercel.app)

> **TL;DR** — Personal wallet + multi-currency group expense splitting (NPR / INR / USD). Integer minor-unit arithmetic eliminates float drift; MongoDB ACID transactions guarantee consistency; greedy min-cash-flow algorithm simplifies settlements. 192 tests (92% coverage), ephemeral 2-hour TTL demo accounts, Docker Compose local stack, CI/CD to Vercel + Render.

---

## Live Demo

**https://cash-dash-one.vercel.app**

Click **"Try Instant Demo (No Signup)"** to get an isolated sandbox with sample data—a "Pokhara Weekend Trip" group with teammates Aarav and Priya. Demo accounts auto-expire after 2 hours via MongoDB TTL indexes.

*Free-tier Render backend sleeps after 15 min idle. First request may take 30–50 s to wake.*

---

## At a Glance

| | |
|---|---|
| **Live App** | [cash-dash-one.vercel.app](https://cash-dash-one.vercel.app) |
| **Frontend** | Vite 6 · React 19 · Tailwind CSS 3 · Vitest |
| **Backend** | Node.js 22 · Express 5 · Mongoose 8 · Zod 4 |
| **Database** | MongoDB Atlas M0 Replica Set |
| **Auth** | JWT access (15m) + `jti` SHA-256 refresh rotation (7d) + `crypto.timingSafeEqual` |
| **DevOps** | GitHub Actions · Multi-stage Docker · Replica-Set Compose · Jenkins/AWS reference |

---

## Architecture

```
Browser → Vercel CDN (React SPA, /api/* rewrite) → Render (Express, Helmet, Zod) → MongoDB Atlas
```

| Path | Purpose |
|------|---------|
| `client/` | Vite + React frontend |
| `server/` | Express API, Mongoose models, Zod validation |
| `server/src/services/` | `splitCalculator.js`, `debtSimplifier.js`, `demoSeed.js` |
| `infra/jenkins/` | `Dockerfile.jenkins`, `Jenkinsfile` (AWS S3/CloudFront reference) |
| `docker-compose.yml` | Full local stack with MongoDB replica set |

---

## Engineering Design

**Integer Minor-Unit Accounting** — Amounts stored as integers (paisa/cents). Deterministic penny-remainder distribution in `splitCalculator.js`; locale-aware formatting (`en-IN` for NPR/INR, `en-US` for USD).

**ACID Transactions** — Personal expense create/delete atomically updates wallet balance. Group settlements bump a `settlementVersion` counter inside transactions to reject concurrent duplicates.

**Derived Balances** — Group debts computed on-read from immutable expenses + settlements via `debtSimplifier.js`. No stale balance drift when expenses are deleted.

**Single Active Refresh Session** — Login rotates `jti`, hashes with SHA-256, compares via `crypto.timingSafeEqual`, invalidates prior token.

**Security** — Non-enumerating group invites, RFC 4180 CSV export with formula-injection neutralization, rate limiting (10 auth / 15 min), gitleaks CI gate.

**Ephemeral Demo** — 2-hour MongoDB TTL on demo-owned records via `expiryFor(user)` helper (verified by tests so real data never expires).

---

## Verification & Benchmarks

| Metric | Value |
|--------|-------|
| Server tests | 145 passed, 0 skipped |
| Server coverage | 92.33% statements, 92.73% lines |
| `splitCalculator.js` | 94.84% stmt, 93.90% lines |
| `debtSimplifier.js` | 94.31% stmt, 95.77% lines |
| Client tests | 47 passed |
| Production bundle | JS 95 KB gzip, CSS 4 KB gzip |
| Secret scan | gitleaks: 0 leaks |

---

## API

| Route Group | Description |
|-------------|-------------|
| `GET /api/health` | Health check |
| `/api/auth/*` | Register, login, refresh, logout, demo, profile |
| `/api/wallet/*` | Balance, top-up |
| `/api/expenses/*` | Personal expenses (CRUD, wallet debit/refund) |
| `/api/groups/*` | Groups, members, expenses, settlements, CSV export |

<details>
<summary><strong>View Full API Reference (21 Endpoints)</strong></summary>

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check (DB status, uptime) |
| `/api/auth/register` | POST | Create account |
| `/api/auth/login` | POST | Login |
| `/api/auth/refresh` | POST | Rotate refresh token |
| `/api/auth/logout` | POST | Clear refresh token |
| `/api/auth/demo` | POST | Create ephemeral demo account |
| `/api/auth/me` | GET | Get current user profile |
| `/api/auth/me` | PATCH | Update profile |
| `/api/wallet` | GET | Get wallet balance |
| `/api/wallet/topup` | POST | Add funds to wallet |
| `/api/expenses` | GET | List personal expenses |
| `/api/expenses` | POST | Create expense |
| `/api/expenses/:id` | DELETE | Delete expense |
| `/api/groups` | GET | List user's groups |
| `/api/groups` | POST | Create group |
| `/api/groups/:groupId/members` | POST | Add member |
| `/api/groups/:groupId/summary` | GET | Summary with simplified debts |
| `/api/groups/:groupId/expenses` | POST | Create group expense |
| `/api/groups/:groupId/expenses/:expenseId` | DELETE | Delete group expense |
| `/api/groups/:groupId/settlements` | POST | Record settlement |
| `/api/groups/:groupId/export.csv` | GET | Export as CSV |

</details>

---

## Legacy v1 & Engineering Postmortem

CashDash evolved from its November 2025 college release (`v1` branch) to `v2`.

### v1 Architecture

```
Browser → React 19 (CRA 5, CI=false build) → Supabase JS Client → Postgres (6 unversioned tables)
```

### v1 CI/CD Pipeline

```
GitHub → Jenkins Container (NodeSource Node, Python3 AWS CLI) → npm install --legacy-peer-deps → S3 sync → CloudFront invalidation
```

### DevOps Wins Preserved

- **Containerized Jenkins:** `jenkins/jenkins:lts` with persistent `/var/jenkins_home` (~250–400 MB RAM idle)
- **S3 ACL Fix:** Removed `--acl public-read`, applied `s3:GetObject` bucket policy
- **Measured Impact:**
  - Deploy time: 15–20 min manual → 3–5 min automated
  - Page load: 2.5–3.2 s (S3) → 1.1–1.6 s (CloudFront)

*Note: The original `jenkins-aws-arm` container used NodeSource Node + Python3 AWS CLI. `infra/jenkins/Dockerfile.jenkins` in v2 modernizes this to Node 22 + AWS CLI v2.*

### v1 Flaws Fixed in v2

| Issue | v1 | v2 |
|-------|----|----|
| Build | CRA 5 + React 19 mismatch, `CI=false` hiding warnings | Vite + zero warnings |
| Security | Hardcoded Supabase key in history | Scrubbed history, Zod env validation, gitleaks gate |
| Financial | Floating-point splits, drifting balances | Integer math, ACID transactions, derived balances |
| Auth | Browser-side bcrypt, duplicated tables | Server-side auth, `jti` rotation |
| Testing | 1 placeholder test | 192 automated tests |
| Infra | Expired AWS Free Tier | Zero-cost: Vercel + Render + Atlas M0 |

---

## Quick Start

### Option A: Docker Compose

```bash
docker compose up --build
```

Opens at `http://localhost:8080`. API on host port `5001` (avoids macOS AirPlay conflict). MongoDB replica set auto-initialized for ACID transactions.

### Option B: Local Development

```bash
# Server (port 5001)
cd server
cp ../.env.example .env  # Set MONGODB_URI (Atlas M0 or use Option A), JWT secrets
npm install && npm run dev

# Client (port 3000)
cd client
npm install && npm run dev
```

*Tip: Use Option A's `docker compose up --build` to auto-provision a local replica set, or point `MONGODB_URI` to a free MongoDB Atlas M0 cluster.*

### Verify

```bash
cd server && npm test                    # 145 tests
cd server && npm run test:coverage       # 92% coverage
cd client && npm test                    # 47 tests
cd client && npm run build               # 95 KB JS, 4 KB CSS
gitleaks detect --source . --verbose     # 0 leaks
```

---

## Design Tradeoffs & Known Limitations

- **Single Active Refresh Session:** One hashed `jti` per user keeps revocation O(1). Tradeoff: signs out earlier devices. Multi-device session list (capped at 5) is on the roadmap.

- **Derived-on-Read Group Balances:** Recomputing from immutable records prevents drift; scales for normal groups. Thousands of expenses would need periodic materialized snapshots.

- **Off-Band Settlement Recording:** Payments (UPI / eSewa / Fonepay / cash) recorded manually, not verified via payment-gateway webhooks.

- **Free-Tier Cold Starts:** Render sleeps after 15 min (30–50 s wake). Dockerfiles and `render.yaml` make migration to always-on infrastructure a config-only change.

---

## Branches

| Branch | Description |
|--------|-------------|
| `v2` | Active production (default) |
| `v1` | Archived legacy (CRA + Supabase + Jenkins/AWS) |

---

## License

[MIT](LICENSE) © 2026 Satyam Chaudhary

---

<details>
<summary>Machine-readable project metadata (YAML)</summary>

```yaml
project: CashDash
version: 2.0.0
live_url: https://cash-dash-one.vercel.app
repository: https://github.com/Nittaany/CashDash

stack:
  frontend: Vite 6, React 19, Tailwind CSS 3
  backend: Node.js 22, Express 5, Mongoose 8, Zod 4
  database: MongoDB Atlas M0 (Replica Set)
  auth: JWT + jti refresh rotation + crypto.timingSafeEqual
  devops: GitHub Actions, Docker, Vercel, Render

test_counts:
  server: 145
  client: 47
  total: 192

coverage:
  statements: 92.33%
  lines: 92.73%
  splitCalculator: { statements: 94.84%, lines: 93.90% }
  debtSimplifier: { statements: 94.31%, lines: 95.77% }

bundle_gzip_kb:
  js: 95
  css: 4

reproduce:
  full_stack: docker compose up --build
  server_test: cd server && npm test
  server_coverage: cd server && npm run test:coverage
  client_test: cd client && npm test
  client_build: cd client && npm run build
  secret_scan: gitleaks detect --source . --verbose
```

</details>
