# CashDash (v1 — Archived Legacy Release)

> **Archived Branch (`v1`)** — This branch preserves the original November 2025 college prototype (Create React App + Supabase + containerized Jenkins to AWS S3/CloudFront) for historical reference. The original AWS free-tier infrastructure and Supabase project have been retired.
>
> **Active Production Version:** Switch to the default **[`v2` branch](https://github.com/Nittaany/CashDash/tree/v2)** or try the live modernized app at **[https://cash-dash-one.vercel.app](https://cash-dash-one.vercel.app)**.

---

## What v1 Was

CashDash v1 was a personal expense ledger and shared bill-splitting app built for a 4-credit DevOps coursework project. Users could track wallet transactions, create group expenses, and see simplified debts. The primary objective was demonstrating automated React deployments via Dockerized Jenkins to AWS S3 + CloudFront.

---

## Historical v1 Architecture

### Runtime

```
Browser (React 19 / CRA 5 SPA) → Supabase JS Client (Auth, Postgres tables, update_balance RPC, payment_qrs Storage)
```

### Legacy CI/CD Pipeline

```
GitHub → Jenkins in Docker (jenkins/jenkins:lts, persistent /var/jenkins_home)
       → npm install --legacy-peer-deps
       → CI=false npm run build
       → aws s3 sync --delete
       → CloudFront /* invalidation
```

---

## DevOps Challenges Solved in v1

- **Containerized Jenkins:** Extended `jenkins/jenkins:lts` with Node.js and AWS CLI. Used persistent `/var/jenkins_home` volume for reproducible builds. Resolved PEP 668 externally-managed-environment warnings via user-level pip install.

- **S3 ACL Fix:** AWS S3 buckets with Block Public Access and Object Ownership enforced reject `--acl public-read`. Fixed by removing the ACL flag and applying a read-only `s3:GetObject` bucket policy instead.

- **Measured DevOps Impact** (historical benchmarks while AWS free-tier was active):
  - Manual deploy: ~15–20 min → Automated Jenkins pipeline: ~3–5 min
  - S3 origin load: ~2.5–3.2 s → CloudFront cached: ~1.1–1.6 s

---

## Known Limitations (Resolved in v2)

| Issue | v1 | v2 |
|-------|----|----|
| Build tooling | CRA 5 + React 19 peer mismatch (`--legacy-peer-deps`, `CI=false`) | Vite + React 19 + zero warnings |
| API architecture | Direct client-to-Supabase writes, unversioned schema, browser-side `bcryptjs` | Express API + Mongoose + Zod + server-side auth + `jti` refresh rotation |
| Financial integrity | Non-transactional balance updates, floating-point splits, mutable debt rows | Integer minor-unit accounting, MongoDB ACID transactions, derived min-cash-flow |
| Testing | Untouched CRA placeholder test, no CI gate | 192 automated tests (92% server coverage) + GitHub Actions + gitleaks |
| Code quality | Artificial loading delays, client-wide data scoping, broken mobile edge cases | Scoped groups, RFC 4180 CSV neutralization, clean routing |
| Infrastructure | Retired AWS free-tier | Vercel + Render + MongoDB Atlas M0 (never-expiring) |

---

## Local Development (Archive)

```bash
# Clone and install
git clone https://github.com/Nittaany/CashDash.git
cd CashDash
git checkout v1
npm install --legacy-peer-deps

# Configure Supabase (copy .env.example to .env.local and fill in credentials)
cp .env.example .env.local

# Run development server
npm start
```

**Note:** This branch requires a Supabase project with the original v1 schema (6 tables + `update_balance` RPC). The production Supabase project has been retired.

---

## License

[MIT](LICENSE) — See the `v2` branch for the current license file.
