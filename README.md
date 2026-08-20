# Collision Canary

Collision Canary makes two real browser actors share one state, then checks whether the result satisfies a declared business invariant.

The first scenario is a last-seat booking flow:

1. Alice and Bob arm against one shared seat.
2. A database barrier releases both actors.
3. The claim path produces a persisted outcome for each actor.
4. The evaluator classifies the observed state as satisfied or violated.
5. A violated run produces a redacted repair packet for a local Codex repair.

## Current backend surface

| Route | Purpose |
|---|---|
| `GET /api/v1/health` | Database readiness |
| `POST /api/v1/runs` | Create an isolated run |
| `POST /api/v1/runs/:runId/actors/:actorKey/arm` | Arm one actor |
| `GET /api/v1/runs/:runId/actors/:actorKey/barrier` | Read barrier state |
| `POST /api/v1/runs/:runId/actors/:actorKey/claim` | Attempt the shared claim |
| `POST /api/v1/runs/:runId/evaluate` | Persist an invariant verdict |
| `GET /api/v1/runs/:runId/proof` | Read the redacted proof projection |
| `GET /api/v1/runs/:runId/repair-packet` | Read a violated-run repair packet |

The browser surface is a separate client of these routes, so the proof path can
also be verified directly over HTTP.

## Setup

Requirements: Node.js 22+, pnpm 11+, Vercel CLI, and PostgreSQL-compatible Neon credentials.

```bash
pnpm install
vercel env pull .env.local --environment development
pnpm db:migrate
pnpm dev -- --port 3001
```

The database schema is defined in [src/db/schema.ts](src/db/schema.ts) and migrations are stored in [drizzle](drizzle).

## Verification

With the development server running:

```bash
COLLISION_CANARY_BASE_URL=http://127.0.0.1:3001 pnpm test:backend-http
```

The same verifier can exercise the local failure fixture and repair packet:

```bash
COLLISION_CANARY_FAILURE_FIXTURE=true COLLISION_CANARY_BASE_URL=http://127.0.0.1:3001 pnpm test:backend-http
```

Focused backend checks:

```bash
pnpm test:public-base-url
pnpm test:actor-guards
pnpm test:atomic-claims
pnpm test:invariant-evaluator
pnpm test:repair-cycle
```

The local failure fixture is deliberately disabled in production. To capture the controlled failure used by the repair flow, run the local server with:

```bash
COLLISION_CANARY_FAILURE_FIXTURE=true pnpm dev -- --port 3001
```

The production claim path remains atomic even if the fixture variable is accidentally present.

## Repair flow

Build a packet from a violated run:

```bash
pnpm build:repair-packet -- --run <violated-run-id> --out .collision-canary/runs/<run-id>
pnpm repair:codex -- --packet .collision-canary/runs/<run-id>/repair-packet.json
pnpm link:repair-cycle -- --failed-run <violated-run-id> --verified-run <verified-run-id> --packet .collision-canary/runs/<run-id>/repair-packet.json
```

The Codex adapter defaults to dry-run. `--apply` is an explicit local operation, restricted to the backend files named by the packet. It never commits or pushes.

## Architecture

![Collision Canary architecture](assets/diagrams/architecture.png)

Read the system decisions and trust boundaries in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). The formal visual system is [docs/DESIGN.md](docs/DESIGN.md).

## Trust boundary

- Neon Postgres is the shared-state authority.
- Actor tokens are scoped and handed off through URL fragments, then sent in `Authorization` headers.
- Production actor URLs use `NEXT_PUBLIC_APP_URL` or Vercel's deployment URL, never an untrusted host header.
- Proof projections exclude tokens, credentials, and raw request headers.
- Codex execution is local-only and is never imported by a public route.
- A proof describes one observed run. It does not claim exhaustive verification of every possible schedule.

## License

MIT. See [LICENSE](LICENSE).
