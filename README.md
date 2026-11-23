# CashDash

[![CI](https://github.com/Nittaany/CashDash/actions/workflows/ci.yml/badge.svg?branch=v2)](https://github.com/Nittaany/CashDash/actions/workflows/ci.yml)
[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://cash-dash-one.vercel.app)
![Node 22](https://img.shields.io/badge/node-22-brightgreen)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **TL;DR** — A personal wallet and group expense splitter handling NPR, INR, and USD with **integer money math** (no floating-point drift), **ACID transactions** for wallet operations, and **greedy debt simplification** that minimizes transfers. Built with React 19 + Express 5 + MongoDB, deployed on Vercel/Render/Atlas free tiers. Backed by **258 tests (91% coverage)**, 4-job CI pipeline, and **0 secret leaks**.

**[Live Demo](https://cash-dash-one.vercel.app)** — Click "Try Instant Demo" for a pre-seeded sandbox with 25 expenses and 10 groups (no signup, 2h auto-cleanup).

---

## What It Does

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CASHDASH                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   👤 PERSONAL WALLET              👥 GROUP EXPENSES                         │
│   ─────────────────               ────────────────                          │
│   • Track daily spending          • Split bills (equal/exact/percent)       │
│   • Categories & filters          • Multi-currency (NPR/INR/USD)            │
│   • Monthly summaries             • Debt simplification algorithm           │
│   • Atomic transactions           • Settlement tracking                     │
│                                   • CSV export                              │
│                                                                             │
│   🔐 AUTH & SECURITY              📱 UX                                     │
│   ─────────────────               ────                                      │
│   • JWT + HttpOnly cookies        • 1-click instant demo                    │
│   • Email verification            • UPI QR code generation (INR)            │
│   • Password reset flow           • Mobile-responsive UI                    │
│   • Rate limiting                 • Server wake indicator (cold starts)     │
│                                   • Real-time balance updates               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                   BROWSER                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │  React 19 SPA (Vite + Tailwind)                                              │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │  │
│  │  │ AuthContext │ │   Pages     │ │ Components  │ │ API Client              │ │  │
│  │  │ (JWT in    │ │ • Dashboard │ │ • Navbar    │ │ • Auto-retry on 401     │ │  │
│  │  │  memory)   │ │ • Expenses  │ │ • Forms     │ │ • Silent token refresh  │ │  │
│  │  │             │ │ • Groups    │ │ • Modals    │ │                         │ │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ HTTPS (same-origin)
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│                              VERCEL EDGE                                           │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │  vercel.json rewrites:                                                       │  │
│  │  • /api/*  →  proxy to Render API (same-origin cookies work!)                │  │
│  │  • /*      →  /index.html (SPA fallback for client-side routing)             │  │
│  └──────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ Proxied request
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│                         RENDER (Docker Container)                                  │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │  Express 5 API (Node 22)                                                     │  │
│  │                                                                              │  │
│  │  REQUEST PIPELINE:                                                           │  │
│  │  ┌─────────┐ ┌──────┐ ┌───────────┐ ┌──────┐ ┌──────┐ ┌─────────┐           │  │
│  │  │ Helmet  │→│ CORS │→│Rate Limit │→│ JSON │→│Cookie│→│ Routes  │           │  │
│  │  │(security)│ │check │ │(per-route)│ │parse │ │parse │ │         │           │  │
│  │  └─────────┘ └──────┘ └───────────┘ └──────┘ └──────┘ └─────────┘           │  │
│  │                                                              │               │  │
│  │  ┌───────────────────────────────────────────────────────────┘               │  │
│  │  ▼                                                                           │  │
│  │  ROUTES:                                                                     │  │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                │  │
│  │  │ /api/auth       │ │ /api/wallet     │ │ /api/expenses   │                │  │
│  │  │ • register      │ │ • GET balance   │ │ • GET list      │                │  │
│  │  │ • login         │ │ • POST topup    │ │ • POST create   │                │  │
│  │  │ • refresh       │ │                 │ │ • DELETE        │                │  │
│  │  │ • logout        │ │                 │ │   (atomic       │                │  │
│  │  │ • demo          │ │                 │ │    refund)      │                │  │
│  │  │ • verify-email  │ └─────────────────┘ └─────────────────┘                │  │
│  │  │ • reset-password│                                                        │  │
│  │  └─────────────────┘ ┌─────────────────────────────────────┐                │  │
│  │                      │ /api/groups                         │                │  │
│  │                      │ • CRUD groups & members             │                │  │
│  │                      │ • expenses (EQUAL/EXACT/PERCENT)    │                │  │
│  │                      │ • settlements                       │                │  │
│  │                      │ • summary (paginated)               │                │  │
│  │                      │ • CSV export                        │                │  │
│  │                      └─────────────────────────────────────┘                │  │
│  │                                                                              │  │
│  │  SERVICES (Business Logic - No DB imports):                                  │  │
│  │  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐          │  │
│  │  │ splitCalculator   │ │ debtSimplifier    │ │ mailer            │          │  │
│  │  │ ─────────────────│ │ ────────────────── │ │ ───────────────── │          │  │
│  │  │ Integer math only │ │ Net balance/user  │ │ Resend API or     │          │  │
│  │  │ ₹100÷3 =          │ │ Greedy matching   │ │ mock transport    │          │  │
│  │  │ [3334,3333,3333]  │ │ Min # of transfers│ │ (dev/test)        │          │  │
│  │  └───────────────────┘ └───────────────────┘ └───────────────────┘          │  │
│  │                                                                              │  │
│  └──────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ Mongoose ODM
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│                        MONGODB ATLAS (Replica Set)                                 │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │  WHY REPLICA SET? → Enables multi-document ACID transactions                 │  │
│  │                                                                              │  │
│  │  COLLECTIONS:                                                                │  │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐                   │  │
│  │  │ users          │ │ personalexp... │ │ groups         │                   │  │
│  │  │ • email (uniq) │ │ • userId (idx) │ │ • members[]    │                   │  │
│  │  │ • passwordHash │ │ • category     │ │ • currency     │                   │  │
│  │  │ • refreshToken │ │ • amountMinor  │ │ • settlement   │                   │  │
│  │  │   Hash         │ │ • date (idx)   │ │   Version      │                   │  │
│  │  │ • expiresAt    │ │ • expiresAt    │ │ • expiresAt    │                   │  │
│  │  │   (TTL index)  │ │   (TTL index)  │ │   (TTL index)  │                   │  │
│  │  └────────────────┘ └────────────────┘ └────────────────┘                   │  │
│  │  ┌────────────────┐ ┌────────────────┐                                      │  │
│  │  │ groupexpenses  │ │ settlements    │  TTL indexes auto-delete             │  │
│  │  │ • groupId (idx)│ │ • groupId (idx)│  demo data after 2 hours             │  │
│  │  │ • splits[]     │ │ • from/toUser  │                                      │  │
│  │  │ • splitType    │ │ • amountMinor  │                                      │  │
│  │  └────────────────┘ └────────────────┘                                      │  │
│  └──────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technologies |
|:------|:-------------|
| **Frontend** | React 19, Vite 6, Tailwind CSS 3, React Router 7 |
| **Backend** | Node 22, Express 5, Mongoose 8, Zod 4 |
| **Database** | MongoDB Atlas M0 (replica set for ACID transactions) |
| **Auth** | JWT (15min) + SHA-256 hashed refresh cookies (7d, HttpOnly) |
| **Email** | Resend API (mock transport in dev/test) |
| **DevOps** | Docker multi-stage, GitHub Actions (4 jobs), Vercel, Render |
| **Testing** | Vitest, Supertest, mongodb-memory-server |

---

## Engineering Challenges & Decisions

### 1. Floating-Point Money Drift → Integer Minor Units

**Problem:** `₹100 / 3` in JavaScript = `33.333...` — three of those sum to `99.999`, losing a paisa.

**Solution:** Store all amounts as integer minor units (paisa/cents). The `splitCalculator.js` divides with `Math.floor`, then distributes remainder to first N participants.

**Result:** `10000` split 3 ways → `[3334, 3333, 3333]` — sum always equals total.

### 2. Race Conditions → MongoDB Transactions

**Problem:** Creating expense = debit wallet + insert record. Two writes = lost updates if one fails.

**Solution:** `session.withTransaction()` wraps both operations. Wallet uses conditional `$inc` that fails if balance goes negative.

**Result:** 10 parallel ₹100 expenses on ₹500 wallet → exactly 5 succeed, final balance = ₹0.

### 3. Third-Party Cookie Blocking → Same-Origin Proxy

**Problem:** Safari/Chrome block cross-origin cookies. Separate API domain breaks HttpOnly refresh tokens.

**Solution:** Vercel rewrites `/api/*` to Render backend. Browser sees one origin, cookies work with `SameSite=Lax`.

**Result:** Hard-refresh on any route stays logged in.

### 4. Settlement Concurrency → Optimistic Locking

**Problem:** Two users settling same debt simultaneously could both succeed (double-pay).

**Solution:** `Group.settlementVersion` counter + `$inc` inside transaction. MongoDB atomicity forces one to retry and fail.

**Result:** Concurrent settlement test confirms only one succeeds.

### 5. Demo Blast Radius → TTL Isolation

**Problem:** Anyone can create demo user. Without isolation, could fill 512MB free database.

**Solution:** Demo users get 2h TTL via MongoDB `expiresAt` index. `expiryFor(user)` propagates to all their records.

**Result:** Demo data auto-deletes; real user records never get `expiresAt`.

---

## API Reference (28 Endpoints)

| Group | Endpoints |
|:------|:----------|
| **Auth** | register, login, refresh, logout, demo, me, forgot-password, reset-password, verify-email, resend-verification |
| **Wallet** | GET balance/summary, POST topup |
| **Expenses** | GET list (filtered), POST create (atomic debit), DELETE (atomic refund) |
| **Groups** | CRUD groups, members, expenses, settlements, paginated summary, CSV exports |

<details>
<summary><strong>Full endpoint list</strong></summary>

| Endpoint | Method | Description |
|:---------|:-------|:------------|
| `/api/auth/register` | POST | Create account + verification email |
| `/api/auth/login` | POST | Authenticate + set refresh cookie |
| `/api/auth/refresh` | POST | Rotate refresh token |
| `/api/auth/logout` | POST | Invalidate session |
| `/api/auth/demo` | POST | Create 2h ephemeral demo account |
| `/api/auth/me` | GET | Current profile |
| `/api/auth/me` | PATCH | Update profile |
| `/api/auth/forgot-password` | POST | Request reset email |
| `/api/auth/reset-password` | POST | Reset with 15min SHA-256 token |
| `/api/auth/verify-email` | POST | Verify with 24h SHA-256 token |
| `/api/auth/resend-verification` | POST | Resend (anti-enumeration) |
| `/api/wallet` | GET | Balance + monthly summary |
| `/api/wallet/topup` | POST | Add funds |
| `/api/expenses` | GET | List with filters |
| `/api/expenses` | POST | Create (atomic wallet debit) |
| `/api/expenses/:id` | DELETE | Delete (atomic refund) |
| `/api/groups` | GET | User's groups |
| `/api/groups` | POST | Create group |
| `/api/groups/:id/members` | POST | Add member |
| `/api/groups/:id/members/:mid` | DELETE | Remove (requires 0 balance) |
| `/api/groups/:id/summary` | GET | Balances + transfers (paginated) |
| `/api/groups/:id/expenses` | POST | Add group expense |
| `/api/groups/:id/expenses/:eid` | DELETE | Delete expense |
| `/api/groups/:id/settlements` | POST | Record settlement |
| `/api/groups/:id/export.csv` | GET | Export expenses |
| `/api/groups/:id/balances.csv` | GET | Export balances |
| `/api/health` | GET | DB state, uptime |

</details>

---

## Test Coverage

```
┌─────────────────────────────────────────────────────────────────┐
│                     TEST SUMMARY                                │
├─────────────────────────────────────────────────────────────────┤
│  Server: 180 tests │ 91.15% statements │ 91.52% lines          │
│  Client:  78 tests │                                            │
│  Total:  258 tests │ 0 secret leaks (gitleaks)                  │
│  Bundle: 106 kB JS │ 4.3 kB CSS (gzip)                          │
└─────────────────────────────────────────────────────────────────┘
```

| Test Suite | What It Covers |
|:-----------|:---------------|
| `splitCalculator.test.js` | Integer splits, rounding, percent validation, edge cases |
| `debtSimplifier.test.js` | Mutual cancellation, transitive chains, partial settlements |
| `walletAndExpenses.test.js` | Atomic transactions, concurrent operations (10 parallel) |
| `auth.test.js` | Token rotation, refresh reuse rejection, timing-safe comparison |
| `groupsAndSettlements.test.js` | Membership checks, settlement validation, optimistic locking |
| `emailVerification.test.js` | Token verify, single-use rejection, expiry, anti-enumeration |
| `memberRemoval.test.js` | Safe removal (0 balance required), authorization |
| `ttl.test.js` | Demo expiry, real users never get `expiresAt` |
| `PaymentQRModal.test.jsx` | Integer formatting, VPA validation, INR-only QR |
| `Footer.test.jsx` | Copyright, external links, accessibility |
| `ServerWakeIndicator.test.jsx` | Wake states, progress timer, auto-dismiss |

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

**Run tests:**
```bash
cd server && npm test                    # 180 tests
cd server && npm run test:coverage       # 91.15% statements
cd client && npm test                    # 66 tests
gitleaks detect --source . --verbose     # 0 leaks
```

---

## Demo Data

The instant demo seeds realistic data for exploration:

| Category | Count | Details |
|:---------|:------|:--------|
| **Personal Expenses** | 25 | 3 months, 7 categories, 5 payment modes |
| **Groups** | 10 | 2-6 members each, NPR/INR/USD currencies |
| **Group Expenses** | 25+ | EQUAL, EXACT, PERCENT splits |
| **Settlements** | 1 | Partial payment example |
| **Teammates** | 9 | For group variety |

Groups include: Pokhara Trip, Flatmates, Office Lunch Club, Remote Team Offsite (USD), Wedding Gift (INR), Hiking Club, Book Club, Birthday Party, Gaming Setup, and an empty planning group.

---

## Limitations & Future Work

| Current Limitation | Rationale | Future Path |
|:-------------------|:----------|:------------|
| One session per user | O(1) revocation with single hashed token | Multi-device cap (5) + Redis |
| Balances computed on read | No drift; correct for <1000 expenses/group | Materialized snapshots |
| In-memory rate limiting | Works for single instance | Redis-backed for horizontal scale |
| Free-tier cold starts | 30-50s Render wake | Same Docker → always-on host |

---

## Project Evolution

| Version | Focus | Stack |
|:--------|:------|:------|
| **v1** | CI/CD pipeline | React + Supabase → Jenkins → AWS S3/CloudFront |
| **v2** | Full-stack app | React + Express + MongoDB + Docker + GitHub Actions |

The [`v1` branch](https://github.com/Nittaany/CashDash/tree/v1) preserves the original Jenkins/AWS pipeline. v2 is a ground-up rebuild addressing security and reliability gaps.

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
stack:
  frontend: React 19, Vite 6, Tailwind CSS 3
  backend: Node 22, Express 5, Mongoose 8, Zod 4
  database: MongoDB Atlas M0 (replica set)
  auth: JWT + SHA-256 hashed refresh cookie (HttpOnly)
tests:
  server: 180
  client: 78
  coverage_statements: 91.15%
  coverage_lines: 91.52%
bundle_gzip: { js: 106kb, css: 4.3kb }
endpoints: 28
demo_data: { expenses: 25, groups: 10 }
```

</details>
