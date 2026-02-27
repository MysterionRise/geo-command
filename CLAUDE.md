PROJECT_NAME: geo-command
LANGUAGE_STACK: TypeScript (Hono API + Next.js 15 frontend)
REPO_PATH: /Users/konstantinp/projects/geo-command
PACKAGE_MANAGER: pnpm (workspaces)
BUILD_SYSTEM: Turborepo

## Monorepo Structure
- `apps/api` — Hono API server (port 4000)
- `apps/web` — Next.js 15 frontend (port 3000)
- `packages/config` — Shared tsconfig, eslint, tailwind configs
- `packages/types` — Zod schemas (enums, API request/response types, webhooks)
- `packages/db` — Prisma + PostgreSQL (schema, client singleton, tenant-scoped queries)
- `packages/auth` — Clerk integration (webhook verification, RBAC helpers)
- `packages/ui` — Component library (shadcn/ui components, sidebar, org-switcher)

TESTING_FRAMEWORK: vitest (unit/integration) + playwright (e2e)

## Key Commands
- `pnpm dev` — Start all services
- `pnpm build` — Build all packages/apps
- `pnpm test` — Run vitest tests
- `pnpm db:generate` — Generate Prisma client
- `pnpm db:migrate` — Run Prisma migrations

## Critical Invariants
- Tenant isolation enforced via orgContext middleware + tenantDb() scoped queries
- Webhook signatures verified via svix before processing
- Mutations require ADMIN+ role (requireRole middleware)
- No PII in logs (pino redact config)
- X-Request-ID on every response
- Zod validation on all request bodies
