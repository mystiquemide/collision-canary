# Collision Canary architecture

Collision Canary runs a paired last-seat scenario against one isolated Postgres
resource. The application records each actor, coordinates a shared barrier,
applies a guarded claim, and evaluates the persisted result against the
declared invariant.

## System boundary

```text
Browser actors or HTTP verifier
          |
          v
Next.js route handlers
          |
          v
Neon Postgres  <--- local repair packet + Codex adapter
```

Neon is the authority for run state. Vercel function memory is never used for
barriers, resource capacity, actor state, or proof data. The repair adapter is a
local script and is not imported by the web runtime.

## Runtime pieces

| Piece | Responsibility |
|---|---|
| Run service | Creates a run, one shared resource, two actors, and a barrier. |
| Token service | Signs short-lived HMAC actor tokens scoped to one run and actor. |
| Barrier service | Records one arrival per actor and releases both actors at the expected count. |
| Claim service | Serializes the actor transition, then performs the conditional resource update and records the outcome in one transaction. |
| Evaluator | Cross-checks actor states, claim attempts, and final resource state. |
| Proof projection | Returns reviewer-safe state without tokens or raw request data. |
| Repair packet | Converts one violated proof into a hashed, allowlisted backend task. |
| Repair cycle linker | Connects a failed proof to a satisfied rerun after packet validation. |

## State model

### Verification run

```text
created -> armed -> released -> failed | verified | infra_error
```

The run starts as `armed` when the first actor arrives and becomes `released`
when the barrier reaches its expected count. Evaluation writes one terminal
verdict and completion time.

### Actor

```text
created -> armed -> released -> claiming -> succeeded | rejected | errored
```

State changes use conditional updates. A terminal actor has one claim attempt,
and a repeated request returns that recorded result.

### Shared resource

`scenario_resources.remaining` is constrained to `0..capacity`. The repaired
claim path decrements it only when `remaining > 0`, and increments `version` on
each successful decrement.

## Paired run flow

1. `POST /api/v1/runs` creates all run records in one database batch and returns
   actor URLs. Tokens are placed in URL fragments, not query parameters.
2. Each actor sends its token in an `Authorization` header to the arm route.
3. The barrier transaction changes only a first-time `created` actor and
   increments `arrived_count` once. The second arrival releases all armed
   actors.
4. Released actors call the claim route concurrently.
5. The claim statement serializes the actor row, conditionally updates the
   shared resource, inserts one attempt, and writes the final actor outcome.
6. Evaluation stores a verdict. A proof request returns the redacted persisted
   projection.

The local repair-cycle linker validates the failed and verified terminal proofs,
checks the packet digest, and records one cycle linking both runs. It updates
both run projections without allowing a cycle to be relinked to different data.

## Claim atomicity

The production path uses one short Neon transaction. It first changes the
released actor to `claiming`, then runs this parameterized resource and outcome
statement:

```sql
UPDATE scenario_resources
SET remaining = remaining - 1,
    version = version + 1,
    updated_at = now()
WHERE id = $resource_id
  AND run_id = $run_id
  AND remaining > 0
RETURNING remaining;
```

The statement records `succeeded` when the update returns a row and
`rejected` otherwise. A row lock on the actor prevents two simultaneous
requests from consuming capacity twice for one actor. The unique actor-attempt
constraint is a second persistence guard.

The controlled failure fixture uses a deliberately unsafe check-then-write
sequence only outside production. It exists to create a reproducible violated
proof for the repair packet flow.

## Invariant evaluation

V1 evaluates `capacity-at-most-one-v1` for `last-seat-v1`:

```text
successful actor outcomes <= resource capacity
successful claim attempts == successful actor outcomes
final remaining == capacity - successful actor outcomes
```

Two successful outcomes produce `violated / non_linearizable_outcome`. One
success, one rejection, and zero remaining capacity produce
`satisfied / capacity_invariant_satisfied`. Missing or incomplete records
produce `infra_error` instead of being presented as a product failure.

## Trust boundary

- `LAB_SIGNING_SECRET` signs expiring actor tokens. Verification checks version,
  signature, expiry, run, and actor scope.
- Production actor URLs use the configured application URL or Vercel deployment
  URL. Development may fall back to the request origin for local testing.
- Proof responses use an explicit allowlist. They omit actor tokens, credentials,
  database URLs, cookies, and raw request headers.
- Public routes never spawn processes or invoke Codex.
- Repair packets contain only the failed run summary, reason code, acceptance
  criteria, and two allowlisted backend paths. The packet includes a SHA-256
  hash before a local adapter can read it.
- The proof scope is one observed run. It does not claim exhaustive coverage of
  every possible schedule.

## API surface

All routes use `/api/v1` and return `{ data, error, requestId }` with
`Cache-Control: no-store`.

| Route | Auth | Purpose |
|---|---|---|
| `GET /health` | None | Check database readiness. |
| `POST /runs` | None | Create the isolated scenario. |
| `POST /runs/:runId/actors/:actorKey/arm` | Actor bearer token | Register barrier arrival. |
| `GET /runs/:runId/actors/:actorKey/barrier` | Actor bearer token | Read release state. |
| `POST /runs/:runId/actors/:actorKey/claim` | Actor bearer token | Attempt one shared claim. |
| `POST /runs/:runId/evaluate` | None | Persist the invariant verdict. |
| `GET /runs/:runId/proof` | None | Read the redacted proof. |
| `GET /runs/:runId/repair-packet` | None | Build a packet for a violated proof. |

## Verification commands

```bash
pnpm db:check
pnpm lint
pnpm exec tsc --noEmit
pnpm audit --prod
pnpm test:public-base-url
pnpm test:actor-guards
pnpm test:atomic-claims
pnpm test:invariant-evaluator
pnpm test:repair-cycle
COLLISION_CANARY_BASE_URL=http://127.0.0.1:3001 pnpm test:backend-http
```

The HTTP verifier expects a running local server. It exercises creation,
fragment-only token handoff, the barrier, concurrent claims, evaluation, proof
redaction, and the satisfied-run repair guard.

## Environment

| Variable | Use |
|---|---|
| `DATABASE_URL` | Runtime Neon connection. |
| `DATABASE_URL_UNPOOLED` | Direct connection used by Drizzle migrations. |
| `LAB_SIGNING_SECRET` | At least 32 characters, used for actor-token HMACs. |
| `COLLISION_CANARY_FAILURE_FIXTURE` | Local-only failure fixture switch. It is rejected in production. |

See [.env.example](../.env.example) for the local template.

## Scope limits

The current implementation covers one versioned last-seat scenario and its
backend proof path. Browser UI work is a separate client of these routes. A
proof is evidence for the captured run, not a universal concurrency theorem.
