# CashDash — Full-Stack Expense Tracker & Group Debt Settlement

[![CI](https://github.com/Nittaany/CashDash/actions/workflows/ci.yml/badge.svg?branch=v2)](https://github.com/Nittaany/CashDash/actions/workflows/ci.yml)
[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://cash-dash-one.vercel.app)
![Node 22](https://img.shields.io/badge/node-22-brightgreen)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **TL;DR** — A personal wallet and group expense splitter handling NPR, INR, and USD with **integer money math** (no floating-point drift), **ACID transactions** for wallet operations, and **greedy debt simplification** that minimizes transfers. Built with React 19 + Express 5 + MongoDB, deployed on Vercel/Render/Atlas free tiers with same-origin cookie auth. Backed by **246 tests (91% coverage)**, a 4-job GitHub Actions CI pipeline, and **0 secret leaks** via gitleaks.

**[Live Demo](https://cash-dash-one.vercel.app)** — Click "Try Instant Demo" for a pre-seeded sandbox (no signup, 2h TTL auto-cleanup).

---

## At a Glance

| Specification | Details |
|:--|:--|
| **Author** | Satyam Chaudhary ([@Nittaany](https://github.com/Nittaany)) |
| **Stack** | React 19 · Vite 6 · Tailwind CSS 3 · Node 22 · Express 5 · MongoDB (Mongoose 8) · Zod 4 |
| **Auth** | JWT access tokens (15min) + SHA-256 hashed rotating refresh cookies (7d, HttpOnly) |
| **DevOps** | Docker multi-stage · GitHub Actions (4 jobs) · Vercel Edge · Render · MongoDB Atlas M0 |
| **Verification** | 180 server + 66 client tests · 90.6% stmt / 91.0% line coverage · gitleaks in CI |

---

## Engineering Challenges & Decisions

Building a money-handling app that actually works required solving five core problems:

### 1. Floating-Point Money Drift → Integer Minor Units

**Problem:** `₹100 / 3` in JavaScript gives `33.333...`, and three of those sum to `99.999...`—a paisa disappears.

**Decision:** Store all amounts as integer minor units (paisa/cents). The `splitCalculator.js` service divides with `Math.floor`, then distributes the remainder deterministically to the first N participants.

**Evidence:** `10000` split three ways yields `[3334, 3333, 3333]`—sum equals total, every time. Unit tests cover rounding, percent splits, and edge cases.

### 2. Race Conditions on Wallet Updates → MongoDB Transactions

**Problem:** Creating an expense requires debiting the wallet and inserting the expense record. Two separate writes = lost updates if one fails.

**Decision:** Wrap wallet debit + expense insert in `session.withTransaction()`. The wallet uses a conditional `$inc` that fails if balance goes negative.

**Evidence:** Integration test runs 10 parallel `₹100` expenses on a `₹500` wallet—exactly 5 succeed, final balance is `₹0`, no overdraft.

### 3. Third-Party Cookie Blocking → Same-Origin Proxy

**Problem:** Safari and Chrome block cross-origin cookies. A separate API domain breaks HttpOnly refresh tokens.

**Decision:** Vercel rewrites `/api/*` to the Render backend. Browser sees one origin (`cash-dash-one.vercel.app`), cookies work with `SameSite=Lax`.

**Evidence:** Hard-refresh on any route stays logged in. Session survives across browser restarts.

### 4. Settlement Concurrency → Optimistic Locking

**Problem:** Two users settling the same debt simultaneously could both succeed, double-paying.

**Decision:** Each `Group` has a `settlementVersion` counter. Settlements run inside a transaction with `$inc: { settlementVersion: 1 }`. MongoDB's document-level atomicity forces one to retry and fail validation.

**Evidence:** Concurrent settlement test confirms only one succeeds; the other gets a conflict error.

### 5. Demo Blast Radius → Ephemeral TTL Isolation

**Problem:** Anyone can mint a demo user. Without isolation, they could fill the 512MB free database or access other users' data.

**Decision:** Demo users get a 2h TTL via MongoDB's `expiresAt` TTL index. The `expiryFor(user)` helper propagates this to every record they create. Demo users cannot add real members.

**Evidence:** TTL tests assert demo records expire and real user records never get `expiresAt`.

---

## System Architecture

```
Browser (React 19 SPA)
    │  access token in memory, refresh token in HttpOnly cookie
    ▼
Vercel Edge
    │  /api/* → rewrite to Render (same-origin proxy)
    │  /*     → /index.html (SPA fallback)
    ▼
Render (Express 5, Node 22, Docker)
    │  helmet → CORS → rate limit → JWT auth → Zod validation
    ▼
MongoDB Atlas M0 (replica set for transactions)
```

| Module | Responsibility |
|:--|:--|
| `server/src/services/splitCalculator.js` | Integer splits: equal, exact, percent—sum always equals total |
| `server/src/services/debtSimplifier.js` | Net balance per user → greedy largest-debtor/creditor matching → fewest transfers |
| `server/src/middleware/auth.js` | JWT verification (HS256), refresh token rotation, `crypto.timingSafeEqual` |
| `server/src/services/mailer.js` | Resend API adapter (mock transport when `RESEND_API_KEY` unset) |
| `client/src/context/AuthContext.jsx` | Silent refresh on 401, demo session detection, auto-logout on expiry |

---

## API Surface (28 Endpoints)

| Group | Purpose |
|:--|:--|
| `/api/auth/*` | Register, login, refresh, logout, demo, profile, password reset, email verification |
| `/api/wallet/*` | Balance with monthly summary, category breakdown, top-up |
| `/api/expenses/*` | Personal expenses with atomic wallet debit/refund |
| `/api/groups/*` | Members, expenses, settlements, paginated summary, CSV export |

<details>
<summary><strong>Full endpoint reference</strong></summary>

| Endpoint | Method | Description |
|:--|:--|:--|
| `/api/auth/register` | POST | Create account + send verification email |
| `/api/auth/login` | POST | Authenticate + set refresh cookie |
| `/api/auth/refresh` | POST | Rotate refresh token |
| `/api/auth/logout` | POST | Invalidate session |
| `/api/auth/demo` | POST | Create ephemeral 2h demo account |
| `/api/auth/me` | GET | Current profile |
| `/api/auth/me` | PATCH | Update profile |
| `/api/auth/forgot-password` | POST | Request reset email |
| `/api/auth/reset-password` | POST | Reset with SHA-256 hashed 15min token |
| `/api/auth/verify-email` | POST | Verify with SHA-256 hashed 24h token |
| `/api/auth/resend-verification` | POST | Resend verification (anti-enumeration) |
| `/api/wallet` | GET | Balance + summaries |
| `/api/wallet/topup` | POST | Add funds |
| `/api/expenses` | GET | List with filters |
| `/api/expenses` | POST | Create (atomic wallet debit) |
| `/api/expenses/:id` | DELETE | Delete (atomic refund) |
| `/api/groups` | GET | User's groups |
| `/api/groups` | POST | Create group |
| `/api/groups/:id/members` | POST | Add member by email |
| `/api/groups/:id/members/:mid` | DELETE | Remove member (requires 0 balance) |
| `/api/groups/:id/summary` | GET | Balances + simplified transfers (paginated) |
| `/api/groups/:id/expenses` | POST | Add group expense |
| `/api/groups/:id/expenses/:eid` | DELETE | Delete expense |
| `/api/groups/:id/settlements` | POST | Record settlement |
| `/api/groups/:id/export.csv` | GET | Export expenses CSV |
| `/api/groups/:id/balances.csv` | GET | Export balances CSV |
| `/api/health` | GET | DB state, uptime, mail status |

</details>

---

## Verification & Reproducibility

| Command | Result |
|:--|:--|
| `cd server && npm test` | 180 tests passing (36s) |
| `cd server && npm run test:coverage` | 90.63% statements / 90.99% lines |
| `cd client && npm test` | 66 tests passing |
| `cd client && npm run build` | 106 kB JS / 4.3 kB CSS gzip |
| `gitleaks detect --source . --verbose` | 0 leaks |

**What's tested:**
- **Money math:** `splitCalculator` integer rounding, remainder distribution, percent validation
- **Concurrency:** 10 parallel wallet operations, settlement race conditions
- **Auth:** Refresh token rotation, reuse rejection, `timingSafeEqual` comparison
- **Authorization:** Cross-group access blocked, membership checks, settlement validation
- **Demo safety:** TTL expiry, real users never get `expiresAt`

---

## Quick Start

**Docker (full stack):**
```bash
docker compose up --build
# UI: localhost:8080  API: localhost:5001
```

**Local development:**
```bash
# Server
cd server && cp .env.example .env  # Set MONGODB_URI + JWT secrets
npm install && npm run dev

# Client  
cd client && npm install && npm run dev
```

---

## Limitations & Tradeoffs (Intentional)

| Limitation | Rationale | Future Path |
|:--|:--|:--|
| **One session per user** | Single hashed refresh token = O(1) revocation. New login signs out other devices. | Multi-device cap (5 sessions) with Redis session store |
| **Balances computed on read** | No drift from stale balance rows; correct for <1000 expenses/group | Materialized snapshots for high-volume groups |
| **In-memory rate limiting** | Works for single API instance | Redis-backed limiter for horizontal scaling |
| **Free-tier cold starts** | 30-50s Render wake time on idle | Same Docker images deploy to always-on host |
| **Payments recorded, not processed** | UPI/eSewa/cash settled outside app | Gateway webhooks add complexity without core value at this scale |

---

## Project Evolution

This project evolved from DevOps coursework to a production full-stack application:

| Version | Focus | Outcome |
|:--|:--|:--|
| **v1** | CI/CD pipeline automation | Jenkins → AWS S3/CloudFront (15-20min manual → 3-5min automated) |
| **v2** | Full-stack application | Express API + React SPA + MongoDB + Docker + GitHub Actions |

The [`v1` branch](https://github.com/Nittaany/CashDash/tree/v1) preserves the original Jenkins/AWS pipeline as a standalone DevOps case study. v2 is a ground-up rebuild addressing the security and reliability gaps discovered when auditing v1 for public deployment.

---

## License

[MIT](LICENSE) © 2026 Satyam Chaudhary

---

<details>
<summary>Machine-readable metadata</summary>

```yaml
project: CashDash
version: 2.0.0
live_url: https://cash-dash-one.vercel.app
api_health: https://cashdash-api.onrender.com/api/health
stack:
  frontend: React 19, Vite 6, Tailwind CSS 3
  backend: Node 22, Express 5, Mongoose 8, Zod 4
  database: MongoDB Atlas M0 (replica set)
  auth: JWT access + rotating SHA-256 hashed refresh cookie
  devops: Docker, GitHub Actions (4 jobs), Vercel, Render
tests:
  server: 180
  client: 66
  coverage_statements: 90.63%
  coverage_lines: 90.99%
bundle_gzip: { js: 106kb, css: 4.3kb }
endpoints: 28
```

</details>
