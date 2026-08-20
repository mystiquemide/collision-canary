import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const verificationRunStatus = pgEnum("verification_run_status", [
  "created",
  "armed",
  "released",
  "evaluating",
  "failed",
  "verified",
  "infra_error",
]);

export const actorStatus = pgEnum("actor_status", [
  "created",
  "armed",
  "released",
  "claiming",
  "succeeded",
  "rejected",
  "errored",
]);

export const claimResult = pgEnum("claim_result", [
  "succeeded",
  "rejected",
  "errored",
]);

export const invariantVerdict = pgEnum("invariant_verdict", [
  "violated",
  "satisfied",
  "infra_error",
]);

export const verificationRuns = pgTable(
  "verification_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scenarioKey: text("scenario_key").notNull(),
    invariantKey: text("invariant_key").notNull(),
    status: verificationRunStatus("status").notNull().default("created"),
    repairCycleId: uuid("repair_cycle_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("verification_runs_created_at_idx").on(table.createdAt),
    index("verification_runs_status_idx").on(table.status),
  ],
);

export const scenarioResources = pgTable(
  "scenario_resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => verificationRuns.id, { onDelete: "cascade" }),
    capacity: integer("capacity").notNull(),
    remaining: integer("remaining").notNull(),
    version: integer("version").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("scenario_resources_run_id_unique").on(table.runId),
    check(
      "scenario_resources_capacity_positive",
      sql`${table.capacity} > 0`,
    ),
    check(
      "scenario_resources_remaining_valid",
      sql`${table.remaining} >= 0 AND ${table.remaining} <= ${table.capacity}`,
    ),
  ],
);

export const runActors = pgTable(
  "run_actors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => verificationRuns.id, { onDelete: "cascade" }),
    actorKey: text("actor_key").notNull(),
    displayName: text("display_name").notNull(),
    status: actorStatus("status").notNull().default("created"),
    armedAt: timestamp("armed_at", { withTimezone: true }),
    requestAt: timestamp("request_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    outcomeCode: text("outcome_code"),
  },
  (table) => [
    unique("run_actors_run_id_actor_key_unique").on(
      table.runId,
      table.actorKey,
    ),
    index("run_actors_run_id_idx").on(table.runId),
    index("run_actors_status_idx").on(table.status),
  ],
);

export const runBarriers = pgTable(
  "run_barriers",
  {
    runId: uuid("run_id")
      .primaryKey()
      .references(() => verificationRuns.id, { onDelete: "cascade" }),
    expectedCount: integer("expected_count").notNull().default(2),
    arrivedCount: integer("arrived_count").notNull().default(0),
    releaseVersion: integer("release_version").notNull().default(0),
    releasedAt: timestamp("released_at", { withTimezone: true }),
  },
  (table) => [
    check("run_barriers_expected_count_positive", sql`${table.expectedCount} > 0`),
    check(
      "run_barriers_arrived_count_valid",
      sql`${table.arrivedCount} >= 0 AND ${table.arrivedCount} <= ${table.expectedCount}`,
    ),
    check(
      "run_barriers_release_version_non_negative",
      sql`${table.releaseVersion} >= 0`,
    ),
  ],
);

export const claimAttempts = pgTable(
  "claim_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => verificationRuns.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => runActors.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => scenarioResources.id, { onDelete: "cascade" }),
    result: claimResult("result").notNull(),
    observedRemaining: integer("observed_remaining").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("claim_attempts_actor_id_unique").on(table.actorId),
    index("claim_attempts_run_id_idx").on(table.runId),
  ],
);

export const invariantEvaluations = pgTable(
  "invariant_evaluations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => verificationRuns.id, { onDelete: "cascade" }),
    verdict: invariantVerdict("verdict").notNull(),
    successfulClaims: integer("successful_claims").notNull(),
    persistedClaims: integer("persisted_claims").notNull(),
    finalRemaining: integer("final_remaining").notNull(),
    reasonCode: text("reason_code").notNull(),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("invariant_evaluations_run_id_unique").on(table.runId),
    index("invariant_evaluations_verdict_idx").on(table.verdict),
    check(
      "invariant_evaluations_counts_non_negative",
      sql`${table.successfulClaims} >= 0 AND ${table.persistedClaims} >= 0 AND ${table.finalRemaining} >= 0`,
    ),
  ],
);

export const repairCycles = pgTable(
  "repair_cycles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    failedRunId: uuid("failed_run_id")
      .notNull()
      .references(() => verificationRuns.id, { onDelete: "restrict" }),
    verifiedRunId: uuid("verified_run_id").references(
      () => verificationRuns.id,
      { onDelete: "restrict" },
    ),
    packetSha256: text("packet_sha256").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("repair_cycles_failed_run_id_unique").on(table.failedRunId),
    unique("repair_cycles_verified_run_id_unique").on(table.verifiedRunId),
  ],
);

export type VerificationRun = typeof verificationRuns.$inferSelect;
export type NewVerificationRun = typeof verificationRuns.$inferInsert;
export type ScenarioResource = typeof scenarioResources.$inferSelect;
export type NewScenarioResource = typeof scenarioResources.$inferInsert;
export type RunActor = typeof runActors.$inferSelect;
export type NewRunActor = typeof runActors.$inferInsert;
export type RunBarrier = typeof runBarriers.$inferSelect;
export type ClaimAttempt = typeof claimAttempts.$inferSelect;
export type InvariantEvaluation = typeof invariantEvaluations.$inferSelect;
export type RepairCycle = typeof repairCycles.$inferSelect;
