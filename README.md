# Loanlo — Loan Management System

A production-ready, SaaS-style lending platform with role-based access, EMI
scheduling, collections and analytics. Built with the Next.js App Router,
MongoDB, Prisma and BetterAuth.

![Stack](https://img.shields.io/badge/Next.js-16-black) ![TS](https://img.shields.io/badge/TypeScript-5-blue) ![Prisma](https://img.shields.io/badge/Prisma-6-2D3748) ![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248)

## ✨ Features

- **Auth** — Email/password + Google OAuth via BetterAuth, signed cookie
  sessions, protected routes and role-based authorization.
- **Roles** — `SUPER_ADMIN`, `ADMIN`, `AGENT` with a capability matrix. Agents
  are scoped to their own customers/loans; admins see everything.
- **Dashboard** — KPIs (total/active/closed/overdue loans, customers,
  collection, disbursement), collection-vs-disbursement area chart and a loan
  status donut (Recharts).
- **Customers** — CRUD, KYC (Aadhaar/PAN, masked), address, documents, soft
  delete, agent assignment.
- **Loans** — Auto-generated loan numbers, live EMI preview, reducing-balance
  amortization, approval/disbursement workflow, status lifecycle.
- **EMI** — Auto-generated schedules, collection with penalty/interest/principal
  waterfall, overdue tracking, repayment progress.
- **Collections** — Daily/monthly totals, recent payments, overdue customers,
  one-click overdue recompute.
- **Reports** — Profit/interest/fees summary + CSV exports (loans, collections,
  customers).
- **Admin** — Team management (create agents/admins, activate/deactivate) and a
  full audit activity log.
- **UI** — Premium fintech aesthetic: bento grid, glassmorphism, purple/blue
  gradients, Inter type, dark mode, loading/empty/error states.

## 🧱 Tech stack

| Layer | Choice |
|------|--------|
| Framework | Next.js 16 (App Router, Server Actions) |
| Language | TypeScript |
| Database | MongoDB (Atlas / replica set) |
| ORM | Prisma 6 |
| Auth | BetterAuth |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Forms | React Hook Form + Zod |
| Data | TanStack Query + Server Actions |
| State | Zustand |
| Charts | Recharts |
| Package manager | pnpm |

> **Why Prisma 6?** Prisma 7 removed the `url` datasource in favour of
> `prisma.config.ts` + driver adapters, which MongoDB and the BetterAuth Prisma
> adapter don't cleanly support yet. v6 is the stable choice for this stack.

## 🚀 Getting started

```bash
pnpm install

# 1. Configure environment
cp .env.example .env        # fill in DATABASE_URL, BETTER_AUTH_SECRET, Google keys

# 2. Sync the schema + indexes to MongoDB
pnpm db:push

# 3. Seed demo data (staff, customers, loans, EMIs, payments)
pnpm db:seed

# 4. Run
pnpm dev
```

Open http://localhost:3000.

### Demo credentials (password: `Password123`)

| Role | Email |
|------|-------|
| Super Admin | `superadmin@loanlo.com` |
| Admin | `admin@loanlo.com` |
| Agent | `priya@loanlo.com` / `rahul@loanlo.com` |

> MongoDB + Prisma needs a **replica set** for transactions (payment
> collection runs in a transaction). MongoDB Atlas satisfies this by default.

## 🔑 Environment variables

| Key | Description |
|-----|-------------|
| `DATABASE_URL` | MongoDB connection string (replica set required) |
| `BETTER_AUTH_SECRET` | Session signing secret (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | App origin, e.g. `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | Public app origin (used by the auth client) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |

Google OAuth redirect URI: `http://localhost:3000/api/auth/callback/google`.

## 📁 Project structure

```
src/
├── app/
│   ├── (auth)/                 # login, register (public)
│   ├── (dashboard)/            # protected app shell + feature pages
│   │   ├── dashboard/
│   │   ├── customers/[id]/
│   │   ├── loans/[id], loans/new/
│   │   ├── emi/  collections/  reports/
│   │   └── admin/agents, admin/activity
│   ├── api/auth/[...all]/      # BetterAuth handler
│   ├── api/reports/[type]/     # CSV export endpoints
│   └── unauthorized/
├── actions/                    # "use server" mutations (auth + validation + audit)
├── components/
│   ├── ui/                     # shadcn/ui primitives
│   ├── layout/                 # app shell, sidebar, topbar, nav config
│   ├── shared/                 # StatCard, StatusBadge, states, pagination…
│   └── providers.tsx           # TanStack Query + theme + toaster
├── features/                   # feature-scoped client components (forms, charts)
├── hooks/
├── lib/                        # prisma, auth, finance, rbac, session, utils, csv
├── services/                   # server-only data access layer
├── types/
└── validations/                # Zod schemas

prisma/                         # schema.prisma + seed.ts
```

## 🏛️ Architecture notes

- **Clean layering** — `services/` (server-only DB access) ← `actions/` (auth +
  Zod validation + revalidation + audit logging) ← UI. Pages read through
  services; mutations go through server actions returning a typed
  `ActionResult`.
- **Authorization** — `src/proxy.ts` (Next 16 proxy/middleware) does an
  optimistic cookie check at the edge; fine-grained role/permission checks run
  server-side via `requireRole` / `requirePermission` and `lib/rbac.ts`.
- **Money math** — `lib/finance.ts` implements reducing-balance EMI, full
  amortization (last installment absorbs rounding), and daily-rate penalties.
- **Sequences** — atomic `Counter` documents generate `CUS-000001` /
  `LN-2026-000001` codes safely under concurrency.
- **Soft delete** — `deletedAt` on Customer/Loan/Payment/Document; all reads
  filter it out.

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm db:push` | Sync schema + indexes to MongoDB |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:generate` | Regenerate Prisma client |

## 🔒 Production checklist

- Set a strong `BETTER_AUTH_SECRET` and real OAuth credentials.
- Bootstrap a `SUPER_ADMIN` (the seed creates one; new self-sign-ups default to
  `AGENT`).
- Add file storage (S3/Cloudinary) for document uploads.
- Schedule `refreshOverdueAction` (or an equivalent cron) to keep overdue
  statuses current.
- Enable rate limiting on auth routes and configure email verification.
