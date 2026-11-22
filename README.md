# CashDash — Full-Stack Expense Ledger & Group Debt Settlement

[![CI](https://github.com/Nittaany/CashDash/actions/workflows/ci.yml/badge.svg?branch=v2)](https://github.com/Nittaany/CashDash/actions/workflows/ci.yml)
![Node 22](https://img.shields.io/badge/node-22-brightgreen)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://cash-dash-one.vercel.app)

Personal wallet tracking with multi-currency (`NPR`/`INR`/`USD`) group expense splitting. Integer minor-unit arithmetic eliminates float drift; MongoDB ACID transactions ensure consistency; greedy min-cash-flow algorithm simplifies settlements. **192 automated tests** (145 server + 47 client), ephemeral 2-hour TTL instant demo, Docker Compose local stack, and CI/CD to Vercel + Render.

---

## 🚀 Live Demo

**[https://cash-dash-one.vercel.app](https://cash-dash-one.vercel.app)**

Click **"Try Instant Demo (No Signup)"** to get an isolated sandbox with sample data (a "Pokhara Weekend Trip" group with teammates Aarav and Priya). Demo accounts auto-expire after 2 hours via MongoDB TTL indexes.

> **Note:** The free-tier Render backend sleeps after 15 minutes of inactivity. First request may take 30–50 seconds to wake.

---

## 📋 At a Glance

| Aspect | Details |
|--------|---------|
| **Live App** | [cash-dash-one.vercel.app](https://cash-dash-one.vercel.app) |
| **Author** | Satyam Chaudhary |
| **Frontend** | Vite 6 + React 19 + Tailwind CSS 3 + Vitest |
| **Backend** | Node.js 22 + Express 5 + Mongoose 8 + Zod 4 + Vitest/Supertest |
| **Database** | MongoDB Atlas M0 (Replica Set for ACID transactions) |
| **Auth & Security** | JWT access (15m) + `jti` SHA-256 refresh rotation (7d) + `crypto.timingSafeEqual` + `SameSite=lax` HttpOnly cookie via Vercel same-origin `/api` proxy |
| **DevOps & CI** | GitHub Actions + Multi-stage Docker + Replica-Set Compose + Parameterized Jenkins/AWS reference |
| **Test Coverage** | Server: 145 tests, 92% statement coverage · Client: 47 tests · gitleaks secret scan |
| **Bundle Size** | JS: 95 KB gzip · CSS: 4 KB gzip |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRODUCTION FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Browser ──► Vercel Edge CDN ──► Render Docker Container ──► MongoDB Atlas │
│              (React SPA +         (Express API, Helmet,      M0 Replica Set │
│               /api/* rewrite)      Rate Limiter, Zod)        (ACID + TTL)   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

| Path | Description |
|------|-------------|
| `client/` | Vite + React 19 + Tailwind frontend |
| `server/` | Express API with Mongoose models, Zod validation |
| `server/src/services/` | `splitCalculator.js`, `debtSimplifier.js`, `demoSeed.js` |
| `infra/jenkins/` | `Dockerfile.jenkins` + `Jenkinsfile` (AWS S3/CloudFront reference) |
| `docker-compose.yml` | Full local stack with MongoDB replica set |
| `render.yaml` | Render Blueprint for API deployment |
| `client/vercel.json` | Vercel rewrites (API proxy + SPA fallback) |
| `.github/workflows/ci.yml` | GitHub Actions: secret-scan, server-test, client-test-build, docker-build |

---

## ⚙️ Engineering Design & Financial Guarantees

### Integer Minor-Unit Accounting

All amounts stored as integers (paisa/paise/cents). `splitCalculator.js` uses deterministic penny-remainder distribution:

```javascript
// EQUAL split: distribute remainder to first N participants
const base = Math.floor(amountMinor / n);
const remainder = amountMinor % n;
splits[i] = base + (i < remainder ? 1 : 0);
```

Locale-aware formatting: `en-IN` for NPR/INR (lakh grouping), `en-US` for USD.

### ACID Transactions & Concurrency Control

Personal expense create/delete atomically updates wallet balance inside `session.withTransaction()`. Group settlements:
1. Load expenses + existing settlements within transaction
2. Compute pairwise outstanding debt
3. Reject if amount exceeds debt
4. Bump `settlementVersion` counter on Group document (forces write-conflict on concurrent duplicates)
5. Create settlement

### Derived Balances & Min-Cash-Flow Simplification

Group debts computed dynamically from immutable expenses + settlements via `debtSimplifier.js`. No stale balance drift when expenses are deleted. Greedy algorithm sorts debtors/creditors by amount, pairs largest debtor with largest creditor, minimizing transaction count.

### Auth & Session Model

Each user has **one active refresh session**. Login or refresh:
1. Generates new `jti` via `crypto.randomUUID()`
2. Hashes with SHA-256
3. Compares via `crypto.timingSafeEqual` (timing-attack resistant)
4. Invalidates prior token by overwriting hash

Cookies: `SameSite=lax`, `HttpOnly`, scoped to `/api/auth`, proxied same-origin via Vercel.

### Security Measures

- **Non-enumerating responses**: Group invite returns generic "Invitation sent" whether email exists or not
- **CSV export**: RFC 4180 compliant with formula-injection neutralization (`=`, `+`, `-`, `@`, `\t`, `\r` prefixed with `'`)
- **Rate limiting**: 10 auth attempts / 15 min, 5 demo logins / min
- **gitleaks CI gate**: Blocks commits with secrets

### Isolated Ephemeral Demo Accounts

Instant Demo provisions an isolated user + sample group with **2-hour MongoDB TTL** (`expiresAt` index). The `expiryFor(user)` helper applies TTL exclusively to demo-owned records (verified by automated tests so real users' data never expires).

---

## 📡 API Surface

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check (DB status, uptime) |
| `/api/auth/register` | POST | Create account |
| `/api/auth/login` | POST | Login (returns access token, sets refresh cookie) |
| `/api/auth/refresh` | POST | Rotate refresh token |
| `/api/auth/logout` | POST | Clear refresh token |
| `/api/auth/demo` | POST | Create ephemeral demo account |
| `/api/auth/me` | GET | Get current user profile |
| `/api/auth/me` | PATCH | Update profile |
| `/api/wallet` | GET | Get wallet balance |
| `/api/wallet/topup` | POST | Add funds to wallet |
| `/api/expenses` | GET | List personal expenses (paginated, filterable) |
| `/api/expenses` | POST | Create expense (deducts from wallet) |
| `/api/expenses/:id` | DELETE | Delete expense (refunds to wallet) |
| `/api/groups` | GET | List user's groups |
| `/api/groups` | POST | Create group |
| `/api/groups/:groupId/members` | POST | Add member to group |
| `/api/groups/:groupId/summary` | GET | Group summary with simplified debts |
| `/api/groups/:groupId/expenses` | POST | Create group expense |
| `/api/groups/:groupId/expenses/:expenseId` | DELETE | Delete group expense |
| `/api/groups/:groupId/settlements` | POST | Record settlement |
| `/api/groups/:groupId/export.csv` | GET | Export expenses as CSV |

---

## 📜 Legacy v1 Architecture & Engineering Postmortem

CashDash evolved from its November 2025 college release (`v1` branch) into the current `v2` architecture.

### Original v1 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           v1 ARCHITECTURE (Nov 2025)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Browser ──► React 19 (CRA 5) ──► Supabase JS Client ──► Postgres          │
│              CI=false build        (Auth + 6 tables +     (unversioned,     │
│                                     update_balance RPC)    no migrations)   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                           v1 CI/CD PIPELINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GitHub ──► Jenkins Container ──► npm install ──► CI=false ──► S3 sync     │
│             (Docker + Node +       --legacy-peer    npm run     --delete    │
│              AWS CLI v2)            -deps            build                   │
│                                                                    │        │
│                                                                    ▼        │
│                                                          CloudFront CDN     │
│                                                          (/* invalidation)  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### AWS & DevOps Engineering Wins (Preserved in `infra/jenkins/`)

1. **Containerized Jenkins**: `jenkins/jenkins:lts` with Node.js 22, AWS CLI v2, persistent `/var/jenkins_home` volume (~250–400 MB RAM idle, up to 800 MB peak)

2. **S3 `AccessControlListNotSupported` Fix**: Resolved by removing `--acl public-read` and applying read-only `s3:GetObject` bucket policy (caused by S3 Block Public Access defaults)

3. **Measured DevOps Impact**:
   - Deploy time: **15–20 min manual → 3–5 min automated** (70–80% faster)
   - Page load: **2.5–3.2 s (S3 alone) → 1.1–1.6 s (CloudFront edge caching)**

### v1 Flaws Diagnosed & Fixed in v2

| Issue | v1 Problem | v2 Fix |
|-------|------------|--------|
| **Build System** | CRA 5 + React 19 mismatch, broken `package-lock.json`, `npm ci` failing, `CI=false` hiding 18 ESLint warnings | Vite + React 19 + Vitest, zero warnings |
| **Security** | Hardcoded Supabase key in Git history, missing RLS/migrations | Scrubbed history (`git filter-repo`), Zod-validated env vars, Express API + Mongoose, CI gitleaks gate |
| **Financial Integrity** | Non-transactional writes, drifting `balances` table, floating-point splits, orphaned balances on delete | Integer minor-unit math, MongoDB ACID transactions, derived min-cash-flow settlements |
| **Auth Architecture** | Browser-side `bcryptjs` alongside Supabase Auth, duplicated `profiles`/`users` tables, full-table `users` fetch | Server-side auth, `jti` refresh rotation, membership-scoped APIs |
| **Code Quality** | Untouched CRA placeholder test, artificial 2–3s `setTimeout` loaders, auth hard-refresh race, server packages (`nodemailer`, `bcrypt`) in client | 192 automated tests, zero fake delays, unified navigation, clean dependencies |
| **Infrastructure** | Expired AWS Free Tier, hardcoded `Jenkinsfile` IDs | Zero-cost stack (Vercel + Render + Atlas M0), parameterized Jenkinsfile, Docker Compose for local dev |

---

## 🚀 Quick Start

### Option A: Docker Compose (Full Stack)

```bash
docker compose up --build
```

Opens at `http://localhost:8080`. API on host port `5001` (avoids macOS AirPlay Receiver conflict on `5000`). MongoDB replica set auto-initialized for ACID transactions.

### Option B: Local Development

**Prerequisites:** Node.js 22+, MongoDB 7+ (running as replica set)

```bash
# Terminal 1: Server
cd server
cp ../.env.example .env  # Edit MONGODB_URI, JWT secrets
npm install
npm run dev              # http://localhost:5001

# Terminal 2: Client
cd client
npm install
npm run dev              # http://localhost:3000
```

### Verification Commands

| Command | Expected Output |
|---------|-----------------|
| `cd server && npm test` | 145 tests passing |
| `cd server && npm run test:coverage` | 92% statement coverage |
| `cd client && npm test` | 47 tests passing |
| `cd client && npm run build` | JS: 95 KB gzip, CSS: 4 KB gzip |
| `gitleaks detect --source . --verbose` | No leaks found |

---

## 🌿 Branches

| Branch | Description |
|--------|-------------|
| `v2` (default) | Active modernized full-stack application |
| `v1` | Archived legacy release (CRA + Supabase + Jenkins/AWS S3/CloudFront) |

---

## 📄 License

[MIT](LICENSE) © 2026 Satyam Chaudhary
