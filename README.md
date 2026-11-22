# CashDash v1 — Automated Cloud & DevOps CI/CD Pipeline on AWS

> This branch hosts **CashDash v1**, a Cloud & DevOps engineering project focused on automating React web application deployments to **AWS S3 and CloudFront** using **Jenkins inside Docker** (with Supabase handling authentication and database storage). Because the original AWS Free Tier and Supabase sandbox were later retired, this branch is preserved as a complete DevOps case study.
>
> Looking for the separate, live full-stack rebuild? See the default **[`v2` branch](https://github.com/Nittaany/CashDash/tree/v2)** or try **[cash-dash-one.vercel.app](https://cash-dash-one.vercel.app)**.

---

## What This Project Does (In Plain English)

**The Application:** A personal wallet and shared bill-splitting web app. Users can track daily spending, split group bills equally, by percentage, or by exact amount, export transaction history as CSV files, and trigger mobile UPI payments. The frontend is built with React, and Supabase provides managed authentication, a Postgres database, and file storage.

**The DevOps Goal:** Normally, updating a live website means manually building files on a laptop, logging into AWS, uploading folders, and clearing caches—a slow, repetitive 15–20 minute routine where small mistakes can break production. This project automated that entire release process into a repeatable, containerized pipeline that runs the same way every time.

---

## At a Glance

| Aspect | Details |
|--------|---------|
| **Project Focus** | Automated CI/CD & Cloud Static Delivery (4-credit DevOps coursework) |
| **Frontend** | React / Create React App + Tailwind CSS |
| **Managed Backend** | Supabase (Auth, Postgres database, Storage for payment QR codes) |
| **CI/CD Orchestrator** | Jenkins LTS running inside Docker |
| **Cloud Hosting & CDN** | AWS S3 Static Website Hosting + AWS CloudFront |
| **Pipeline Stages** | Checkout → Install → Build → S3 Sync → CloudFront Cache Invalidation |
| **Measured Speedup** | 15–20 min manual → 3–5 min automated; 2.5–3.2 s page load → 1.1–1.6 s via CloudFront |

---

## Cloud & CI/CD Architecture

### Deployment Pipeline

```
Developer Push (GitHub)
    ↓
Dockerized Jenkins (custom image + persistent volume)
    ↓
Build React App (npm install → npm run build)
    ↓
AWS S3 Bucket (static hosting + read-only bucket policy)
    ↓
AWS CloudFront CDN (global edge cache)
    ↓
End Users
```

### Dual-Cloud App Flow

```
Users → AWS CloudFront / S3 (Frontend UI) + Supabase (Auth, Database & QR Storage)
```

### Pipeline Stages Walkthrough

The `Jenkinsfile` defines four stages that run automatically on every trigger:

1. **Checkout** — Jenkins pulls the latest code from the GitHub repository.
2. **Install Dependencies** — Runs `npm install --legacy-peer-deps` to fetch all React packages.
3. **Build** — Runs `npm run build` to compile the React app into optimized static files.
4. **Deploy to S3 + CloudFront Invalidation** — Syncs the build folder to the S3 bucket, then tells CloudFront to clear its cached copies so users see the new version immediately.

---

## Containerized Jenkins Setup

Jenkins was run inside a custom Docker image (`jenkins-aws-arm`, extending `jenkins/jenkins:lts` with Node.js, npm, Python3, Git, and AWS CLI) instead of being installed directly on a laptop. This means anyone cloning the project gets the exact same build environment—no "works on my machine" surprises.

Mapping a persistent Docker volume keeps Jenkins jobs, plugins, and AWS credentials intact across container restarts:

```bash
docker run -d \
  -p 8080:8080 \
  -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  jenkins-aws-arm
```

AWS access keys were stored securely in **Jenkins Credentials Manager** rather than written directly into the pipeline script, so sensitive credentials never appear in version control.

---

## Real Engineering Challenges Solved

### AWS S3 Permission Error (`AccessControlListNotSupported`)

Modern AWS S3 buckets disable legacy per-file public ACLs by default (a setting called "Object Ownership enforced"). This caused uploads with `--acl public-read` to fail with an access error.

**Solution:** Removed the ACL flag from the upload command and attached a targeted, read-only `s3:GetObject` bucket policy. This lets visitors view the website while only authorized AWS credentials can modify files.

### Python & AWS CLI Packaging Conflict (PEP 668)

Installing AWS CLI inside the Debian-based Jenkins container triggered `externally-managed-environment` pip errors—a safety mechanism preventing system-wide Python package conflicts.

**Solution:** Used a user-level pip installation inside the Docker image, avoiding conflicts with system packages.

### Dependency & CI Build Friction

React peer-dependency version conflicts caused `npm install` to fail in the automated environment, and non-blocking ESLint warnings were halting the build.

**Solution:** Used `npm install --legacy-peer-deps` to resolve dependency tree conflicts, and `CI=false npm run build` to prevent warnings from being treated as fatal errors.

### Container Lifecycle & Port Clashes

Rebuilding the Jenkins container sometimes failed because ports `8080` or `50000` were still bound by a previous instance.

**Solution:** Standardized a clean container recreation workflow backed by the persistent `jenkins_home` volume, ensuring Jenkins state survives while avoiding port conflicts.

---

## Measured Results & Performance

*Author-measured benchmarks while the AWS environment was active:*

| Metric | Before (Manual) | After (Automated) |
|--------|-----------------|-------------------|
| **Deployment Time** | 15–20 min | **3–5 min** (70–80% faster) |
| **Page Load Speed** | 2.5–3.2 s (S3 origin) | **1.1–1.6 s** (CloudFront edge) |
| **Pipeline Reliability** | — | **10/10** consecutive successful runs |
| **Container Footprint** | — | ~250–400 MB RAM idle, up to ~800 MB during builds |

**Breakdown of automated pipeline time:** ~10–15 s checkout, ~60–90 s dependency install, ~40–50 s React build, ~20–30 s S3 sync + CloudFront invalidation.

---

## What We Discovered Later

CashDash v1 succeeded at its DevOps mission: automating builds and deployments to AWS. Auditing it later revealed what it would take to run a financial app safely for real public users:

- **Exposed Configuration & Security Hygiene:** Early prototype shortcuts left backend connection details hardcoded in source files instead of environment variables, and handled extra password hashing in the browser instead of a dedicated server. *(Sanitized on this archive branch.)*

- **Money Math Running in the Browser:** Because there was no custom backend server, expense logging and wallet updates happened as separate requests from the browser—meaning a dropped connection could leave balances out of sync, deleting an expense did not undo the debt it created, and standard decimal math could drop a cent on uneven splits.

- **Shared User Pool & Privacy:** All registered users appeared in one shared pool rather than isolated groups, and exports needed stricter per-user boundaries.

- **No Automated Tests Before Deploying:** The Jenkins pipeline automated building and shipping, but did not run automated tests to catch bugs before code went live.

- **Expiring Free-Tier Hosting:** Once the AWS Free Tier and college Supabase instance ended, the live demo went offline.

To solve these backend, security, testing, and permanent-hosting challenges from scratch, a separate full-stack version was built on the [`v2` branch](https://github.com/Nittaany/CashDash/tree/v2).

---

## Local Setup (Archive)

```bash
git clone https://github.com/Nittaany/CashDash.git
cd CashDash
git checkout v1
npm install --legacy-peer-deps

# Copy .env.example to .env.local and add your Supabase credentials
cp .env.example .env.local

npm start
```

**Note:** This branch requires a Supabase project with the original v1 schema. The production Supabase instance has been retired.

---

## License

[MIT](LICENSE) — See the `v2` branch for the current license file.
