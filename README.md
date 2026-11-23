# CashDash

[![CI](https://github.com/Nittaany/CashDash/actions/workflows/ci.yml/badge.svg?branch=v2)](https://github.com/Nittaany/CashDash/actions/workflows/ci.yml)
[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://cash-dash-one.vercel.app)
![Node 22](https://img.shields.io/badge/node-22-brightgreen)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A full-stack expense tracker and group debt settlement app. Track personal spending, split bills with friends, and settle debts in NPR, INR, or USD.

**[Live Demo](https://cash-dash-one.vercel.app)** — Click "Try Instant Demo" for a pre-seeded sandbox (no signup required).

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, Vite 6, Tailwind CSS 3 |
| **Backend** | Node 22, Express 5, MongoDB (Mongoose 8), Zod 4 |
| **Auth** | JWT + HttpOnly refresh cookies, bcrypt, SHA-256 token hashing |
| **DevOps** | Docker, GitHub Actions CI, Vercel, Render, MongoDB Atlas |
| **Testing** | Vitest, Supertest, mongodb-memory-server (246 tests, 91% coverage) |

---

## Key Features

- **Personal Wallet** — Track expenses by category with atomic wallet transactions
- **Group Expense Splitting** — Equal, exact amount, or percentage splits with integer math (no floating-point drift)
- **Debt Simplification** — Greedy algorithm minimizes number of transfers needed
- **Multi-Currency** — NPR, INR, USD with locale-aware formatting
- **UPI Payments** — QR code generation for INR settlements
- **Email Verification** — Resend API integration with secure token flow
- **CSV Export** — Group expenses and balances with formula-injection protection

---

## Architecture

```
Browser (React SPA)
    │
    ▼  same-origin via Vercel rewrite
Vercel Edge ──/api/*──▶ Render (Express API)
                              │
                              ▼
                       MongoDB Atlas (replica set)
```

**Why this setup:**
- Same-origin requests avoid third-party cookie issues
- Replica set enables ACID transactions for money operations
- Free-tier hosting with zero config (Vercel + Render + Atlas M0)
- Same Docker images deploy anywhere (ECS, Cloud Run, self-hosted)

---

## Quick Start

**Docker (full stack):**
```bash
docker compose up --build
# UI: localhost:8080 | API: localhost:5001
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

## API Overview

28 endpoints across 5 route groups:

| Group | Endpoints |
|-------|-----------|
| `/api/auth` | Register, login, refresh, logout, demo, profile, password reset, email verification |
| `/api/wallet` | Balance, monthly summary, category breakdown, top-up |
| `/api/expenses` | CRUD with atomic wallet transactions |
| `/api/groups` | Members, expenses, settlements, paginated summary, CSV export |
| `/api/health` | Database state, uptime |

<details>
<summary>Full endpoint list</summary>

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create account + send verification email |
| `/api/auth/login` | POST | Authenticate + set refresh cookie |
| `/api/auth/refresh` | POST | Rotate refresh token |
| `/api/auth/logout` | POST | Invalidate session |
| `/api/auth/demo` | POST | Create ephemeral demo account |
| `/api/auth/me` | GET/PATCH | Get/update profile |
| `/api/auth/forgot-password` | POST | Request reset email |
| `/api/auth/reset-password` | POST | Reset with token |
| `/api/auth/verify-email` | POST | Verify email token |
| `/api/auth/resend-verification` | POST | Resend verification |
| `/api/wallet` | GET | Balance + summaries |
| `/api/wallet/topup` | POST | Add funds |
| `/api/expenses` | GET/POST | List/create expenses |
| `/api/expenses/:id` | DELETE | Delete + refund |
| `/api/groups` | GET/POST | List/create groups |
| `/api/groups/:id/members` | POST | Add member |
| `/api/groups/:id/members/:mid` | DELETE | Remove member (requires 0 balance) |
| `/api/groups/:id/summary` | GET | Balances + transfers (paginated) |
| `/api/groups/:id/expenses` | POST | Add group expense |
| `/api/groups/:id/expenses/:eid` | DELETE | Delete expense |
| `/api/groups/:id/settlements` | POST | Record settlement |
| `/api/groups/:id/export.csv` | GET | Export expenses |
| `/api/groups/:id/balances.csv` | GET | Export balances |
| `/api/health` | GET | Health check |

</details>

---

## Testing

```bash
cd server && npm test           # 180 tests
cd server && npm run test:coverage  # 90.63% statements
cd client && npm test           # 66 tests
gitleaks detect --source .      # 0 leaks
```

**What's tested:**
- Money math edge cases (integer splits, rounding, remainder distribution)
- Concurrent wallet operations (10 parallel transactions)
- Auth flows (token rotation, refresh reuse rejection)
- Group authorization (membership checks, settlement validation)
- Demo isolation (TTL expiry, blast radius containment)

---

## Project Evolution

This project evolved from a DevOps coursework submission to a production-ready full-stack application:

| Version | Focus | Stack |
|---------|-------|-------|
| **v1** | CI/CD pipeline | React + Supabase → Jenkins → AWS S3/CloudFront |
| **v2** | Full-stack app | React + Express + MongoDB + Docker + GitHub Actions |

The [`v1` branch](https://github.com/Nittaany/CashDash/tree/v1) preserves the original Jenkins/AWS pipeline as a standalone DevOps case study.

---

## Security Considerations

- Passwords hashed server-side with bcrypt (cost 10)
- JWT access tokens (15min) + rotating refresh tokens (7d, SHA-256 hashed)
- HttpOnly cookies prevent XSS token theft
- Rate limiting on auth endpoints
- Zod validation on all inputs
- Formula-injection protection in CSV exports
- Demo accounts isolated with 2h TTL auto-cleanup

---

## Tradeoffs & Future Work

**Current limitations (intentional for scale):**
- Single session per user (new login signs out other devices)
- Balances computed on read (correct for <1000 expenses/group)
- In-memory rate limiting (single instance)
- Free-tier cold starts (30-50s wake time)

**Planned:**
- Multi-device sessions (cap: 5)
- Redis-backed rate limiting
- Materialized balance snapshots for high-volume groups
- E2E tests with Playwright

---

## License

[MIT](LICENSE) © 2026 Satyam Chaudhary

---

<details>
<summary>Build metrics</summary>

```
Server: 180 tests, 90.63% statements, 90.99% lines
Client: 66 tests, 106 kB JS / 4.3 kB CSS (gzip)
CI: 4 jobs (gitleaks, server tests, client build, Docker)
```

</details>
